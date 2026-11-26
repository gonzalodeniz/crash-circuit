import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { aiDrive, aiInput, createAiRecovery } from '../src/logic/aiDriver.js';
import { resolveSceneryCollision, touchesScenery } from '../src/logic/collisions.js';
import { createCarState, stepCar } from '../src/logic/driving.js';
import { createProgress } from '../src/logic/progress.js';
import { ParticipantStatus, createRace, stepRace } from '../src/logic/race.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createSeededRandom } from '../src/logic/random.js';
import { buildScenery } from '../src/logic/scenery.js';
import { buildTrack, gridSlot, nearestOnCenterline, pointAtDistance } from '../src/logic/track.js';
import { requireTrackDefinition, trackDefinitions } from '../src/logic/trackCatalog.js';
import { withoutDestruction } from './helpers/withoutDestruction.js';

const P = CONFIG.carPerformance;
const CAR = CONFIG.race.car;
const PARAMS = CONFIG.collision;
const IMPACT = CONFIG.impact;
const DT = 1 / 60;
// Para las pruebas de rebotes y de salir del choque: sin destrucción, que no deja seguir hasta #92.
const NO_WRECKS = withoutDestruction();
const NONE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { ...NONE, accelerate: true };
const BRAKE = { ...NONE, brake: true };

/** Escenario de pruebas: un límite amplio y los obstáculos indicados. */
function sceneryWith(obstacles, size = 200) {
  return { bounds: { minX: -size, maxX: size, minZ: -size, maxZ: size }, obstacles };
}

const carAt = (x, z, heading = 0, speed = 0) => ({ ...createCarState({ x, z, heading }), speed });

/** Un paso de conducción con sus colisiones. */
function advance(car, input, scenery, dt = DT) {
  return resolveSceneryCollision(car, stepCar(car, input, dt, P), CAR, scenery, PARAMS, IMPACT);
}

const roadClearance = (track, point, radius = 0) => nearestOnCenterline(track, point.x, point.z).distance - radius - track.width / 2;

/** Carrera con la señal de salida ya dada y todos quietos. */
function startedRace(trackId, { rivals = false } = {}) {
  const race = rivals
    ? createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId, laps: 1 }, createSeededRandom(1))
    : createRace(CONFIG, [CONFIG.race.player], trackId);
  const held = Object.fromEntries(race.participants.map((p) => [p.id, NONE]));
  while (!stepRace(race, held, DT, CONFIG).started);
  return race;
}

/** Coloca un participante en una pose, con su progreso partiendo de ella. */
function place(race, participant, pose, speed = 0) {
  Object.assign(participant, createCarState(pose), {
    speed, surfaceSample: null, progress: createProgress(race.track, pose), status: ParticipantStatus.EN_CARRERA, wreck: null,
  });
}

/** Avanza la carrera moviendo solo a quien está en `inputs`; los demás quedan quietos. */
function step(race, inputs, dt = DT, config = CONFIG) {
  const held = Object.fromEntries(race.participants.map((p) => [p.id, NONE]));
  return stepRace(race, { ...held, ...inputs }, dt, config);
}

/**
 * Pose desde la que se llega a un obstáculo por el lado de la calzada (`from: 'road'`) o por el contrario,
 * mirando hacia él, a `distance` metros de su superficie.
 */
function facing(race, obstacle, from, distance) {
  const center = pointAtDistance(race.track, nearestOnCenterline(race.track, obstacle.x, obstacle.z).along);
  const length = Math.hypot(obstacle.x - center.x, obstacle.z - center.z);
  const sign = from === 'road' ? -1 : 1;
  const away = { x: ((obstacle.x - center.x) / length) * sign, z: ((obstacle.z - center.z) / length) * sign };
  const gap = obstacle.radius + CAR.length / 2 + distance;
  return {
    x: obstacle.x + away.x * gap,
    z: obstacle.z + away.z * gap,
    heading: Math.atan2(-away.x, -away.z),
  };
}

/** Muestra de obstáculos repartida por todo el circuito: uno de cada cinco y el último. */
function sample(obstacles) {
  return obstacles.filter((_, i) => i % 5 === 0 || i === obstacles.length - 1);
}

test('los parámetros del choque están en la configuración, congelados, y el barrido es más fino que un coche (RF-033)', () => {
  assert.ok(Object.isFrozen(PARAMS));
  assert.ok(PARAMS.headOnCos > 0 && PARAMS.headOnCos < 1);
  assert.ok(PARAMS.bounce >= 0 && PARAMS.bounce < 1);
  assert.ok(PARAMS.scrapeSpeedLoss > 0 && PARAMS.scrapeSpeedLoss <= 1);
  assert.ok(PARAMS.deflectionStep > 0);
  assert.ok(PARAMS.maxSweepStep > 0 && PARAMS.maxSweepStep < CAR.width / 2);
  assert.ok(Number.isInteger(PARAMS.maxPushIterations) && PARAMS.maxPushIterations > 0);
  for (const type of Object.values(CONFIG.tracks.common.obstacleTypes)) assert.ok(type.radius > 0);
  // Todo tipo con radio tiene aspecto, y al revés.
  assert.deepEqual(Object.keys(CONFIG.render.obstacles).sort(), Object.keys(CONFIG.tracks.common.obstacleTypes).sort());
});

for (const definition of trackDefinitions(CONFIG)) {
  const track = buildTrack(definition);
  const { bounds, obstacles } = buildScenery(track, definition);

  test(`${definition.id}: tiene límite exterior y obstáculos fuera de la calzada (RF-015)`, () => {
    assert.ok(obstacles.length > 0);
    assert.deepEqual([...new Set(obstacles.map((o) => o.type))].sort(), ['rock', 'tyres']);
    for (const point of track.points) {
      const margin = track.width / 2 + CONFIG.tracks.common.limitMargin - 1e-9;
      assert.ok(point.x - bounds.minX >= margin && bounds.maxX - point.x >= margin);
      assert.ok(point.z - bounds.minZ >= margin && bounds.maxZ - point.z >= margin);
    }
    // El suelo dibujado llega más allá del muro.
    for (const value of Object.values(bounds)) assert.ok(Math.abs(value) < CONFIG.render.ground.size / 2);
    for (const obstacle of obstacles) {
      assert.ok(obstacle.x > bounds.minX && obstacle.x < bounds.maxX && obstacle.z > bounds.minZ && obstacle.z < bounds.maxZ);
    }
  });

  test(`${definition.id}: ningún obstáculo invade la calzada, la parrilla ni la meta (RF-015, RF-019)`, () => {
    for (const obstacle of obstacles) {
      const clearance = roadClearance(track, obstacle, obstacle.radius);
      assert.ok(clearance >= CONFIG.tracks.common.minObstacleGap, `obstáculo a ${clearance.toFixed(2)} m de la calzada`);
    }
    const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId: definition.id, laps: 1 }, createSeededRandom(1));
    for (let index = 0; index < CONFIG.race.maxParticipants; index++) {
      assert.equal(touchesScenery(gridSlot(race.track, CONFIG.grid, index), CAR, race.scenery), false, `hueco ${index}`);
    }
    // Con el coche atravesado en cualquier punto de la calzada (también la meta) no se toca nada.
    for (let along = 0; along < track.length; along += 2) {
      const center = pointAtDistance(track, along);
      for (const heading of [center.heading, center.heading + Math.PI / 2]) {
        assert.equal(touchesScenery({ ...center, heading }, CAR, race.scenery), false, `distancia ${along}`);
      }
    }
  });

  test(`${definition.id}: las filas de obstáculos forman barreras sin huecos por los que quepa un coche`, () => {
    let first = 0;
    for (const { count = 1 } of definition.obstacles) {
      const row = obstacles.slice(first, first + count);
      assert.equal(row.length, count);
      for (let i = 1; i < row.length; i++) {
        const hole = Math.hypot(row[i].x - row[i - 1].x, row[i].z - row[i - 1].z) - row[i].radius - row[i - 1].radius;
        assert.ok(hole < CAR.width / 2, `hueco de ${hole.toFixed(2)} m`);
      }
      first += count;
    }
    assert.equal(first, obstacles.length);
  });

  test(`${definition.id}: a velocidad máxima y con el paso más largo, el coche no atraviesa ningún obstáculo y pierde velocidad (RF-033)`, () => {
    const race = startedRace(definition.id);
    for (const obstacle of race.scenery.obstacles) {
      const pose = facing(race, obstacle, 'road', 4);
      place(race, race.player, pose, P.maxSpeed);
      const forward = { x: Math.sin(pose.heading), z: Math.cos(pose.heading) };
      let hit = false;
      for (let i = 0; i < 20 && !hit; i++) {
        const before = race.player.speed;
        step(race, { player: GAS }, P.maxStep);
        assert.equal(touchesScenery(race.player, CAR, race.scenery), false, 'nunca queda dentro de un objeto');
        const beyond = (race.player.x - obstacle.x) * forward.x + (race.player.z - obstacle.z) * forward.z;
        assert.ok(beyond < 0, 'no pasa al otro lado');
        // El golpe se reconoce porque quita de golpe bastante más que lo que cambia un paso sin chocar.
        hit = Math.abs(race.player.speed) < Math.abs(before) - 1;
      }
      assert.ok(hit, `no choca con el obstáculo en ${obstacle.x.toFixed(0)}, ${obstacle.z.toFixed(0)}`);
    }
  });

  test(`${definition.id}: el límite exterior detiene al coche a velocidad máxima desde cualquier ángulo`, () => {
    const race = startedRace(definition.id);
    const walls = race.scenery.bounds;
    const middle = { x: (walls.minX + walls.maxX) / 2, z: (walls.minZ + walls.maxZ) / 2 };
    // Un punto despejado junto a cada muro, con distintos ángulos de llegada.
    for (const [x, z, towards] of [
      [walls.minX + 8, middle.z, -Math.PI / 2], [walls.maxX - 8, middle.z, Math.PI / 2],
      [middle.x, walls.minZ + 8, Math.PI], [middle.x, walls.maxZ - 8, 0],
    ]) {
      for (const angle of [0, 0.4, 0.9, 1.3, -0.9]) {
        place(race, race.player, { x, z, heading: towards + angle }, P.maxSpeed);
        let slowest = P.maxSpeed;
        for (let i = 0; i < 60; i++) {
          step(race, { player: GAS }, P.maxStep);
          const { x: px, z: pz } = race.player;
          assert.ok(px > walls.minX && px < walls.maxX && pz > walls.minZ && pz < walls.maxZ, 'sale del límite');
          assert.equal(touchesScenery(race.player, CAR, race.scenery), false);
          slowest = Math.min(slowest, race.player.speed);
        }
        // Cuanto más de frente, más velocidad se pierde; con ángulos muy rasantes apenas.
        assert.ok(slowest < P.maxSpeed * (Math.abs(angle) < 1 ? 0.75 : 0.95), `ángulo ${angle}: ${slowest}`);
      }
    }
  });

  test(`${definition.id}: tras chocar se puede dar marcha atrás y volver a la calzada (RF-033)`, () => {
    const race = startedRace(definition.id);
    for (const obstacle of sample(race.scenery.obstacles)) {
      place(race, race.player, facing(race, obstacle, 'road', 1), 6);
      for (let i = 0; i < 90; i++) step(race, { player: GAS });
      step(race, { player: NONE });
      for (let i = 0; i < 60 && Math.abs(race.player.speed) > P.stopSpeedEpsilon; i++) step(race, { player: NONE });
      for (let i = 0; i < 180 && race.player.offRoad; i++) step(race, { player: BRAKE });
      assert.equal(race.player.offRoad, false, `atascado en ${obstacle.x.toFixed(0)}, ${obstacle.z.toFixed(0)}`);
    }
  });

  test(`${definition.id}: con órdenes al azar junto a los obstáculos el coche nunca queda dentro de un objeto`, () => {
    const race = startedRace(definition.id);
    const random = createSeededRandom(82);
    for (const obstacle of sample(race.scenery.obstacles)) {
      place(race, race.player, facing(race, obstacle, 'road', 2), P.maxSpeed / 2);
      let input = GAS;
      for (let i = 0; i < 600; i++) {
        if (i % 20 === 0) {
          input = {
            accelerate: random() < 0.6, brake: random() < 0.25, left: random() < 0.4, right: random() < 0.4,
          };
        }
        step(race, { player: input }, random() < 0.5 ? DT : P.maxStep, NO_WRECKS);
        assert.equal(touchesScenery(race.player, CAR, race.scenery), false, `paso ${i}`);
      }
    }
  });

  test(`${definition.id}: un rival IA parado detrás de un obstáculo o de cara a él vuelve a la pista y avanza`, () => {
    const race = startedRace(definition.id, { rivals: true });
    const rival = race.participants.find((p) => !p.isPlayer);
    const others = Object.fromEntries(race.participants.filter((p) => p !== rival).map((p) => [p.id, NONE]));
    const rejoins = (pose, label) => {
      place(race, rival, pose);
      race.recoveries[rival.id] = createAiRecovery();
      const from = rival.progress.lapPosition;
      let back = false;
      for (let i = 0; i < 60 * 30 && !back; i++) {
        stepRace(race, others, DT, CONFIG);
        assert.equal(touchesScenery(rival, CAR, race.scenery), false, label);
        back = !rival.offRoad && rival.speed > P.maxSpeed * 0.2 && rival.progress.lapPosition > from + 20;
      }
      assert.ok(back, `${label}: no vuelve (x ${rival.x.toFixed(0)}, z ${rival.z.toFixed(0)}, v ${rival.speed.toFixed(1)})`);
    };
    for (const obstacle of sample(race.scenery.obstacles)) {
      for (const from of ['road', 'behind']) {
        const pose = facing(race, obstacle, from, 0.1);
        if (touchesScenery(pose, CAR, race.scenery)) continue;
        rejoins(pose, `${from} de ${obstacle.x.toFixed(0)}, ${obstacle.z.toFixed(0)}`);
      }
    }
    // De cara a cada muro.
    const walls = race.scenery.bounds;
    const half = CAR.length / 2 + 0.1;
    rejoins({ x: walls.minX + half, z: (walls.minZ + walls.maxZ) / 2, heading: -Math.PI / 2 }, 'muro oeste');
    rejoins({ x: walls.maxX - half, z: (walls.minZ + walls.maxZ) / 2, heading: Math.PI / 2 }, 'muro este');
    rejoins({ x: (walls.minX + walls.maxX) / 2, z: walls.minZ + half, heading: Math.PI }, 'muro sur');
    rejoins({ x: (walls.minX + walls.maxX) / 2, z: walls.maxZ - half, heading: 0 }, 'muro norte');
  });

  test(`${definition.id}: chocar y rebotar fuera de la calzada no suma progreso ni vueltas (RN-01)`, () => {
    const race = startedRace(definition.id);
    for (const obstacle of race.scenery.obstacles) {
      for (const speed of [P.maxSpeed, -P.maxReverseSpeed]) {
        const pose = facing(race, obstacle, 'road', 0.2);
        // Marcha atrás: el coche llega de espaldas.
        if (speed < 0) pose.heading += Math.PI;
        // Solo cuenta lo que ocurre ya fuera de la calzada.
        if (roadClearance(race.track, pose) <= CONFIG.offRoad.margin) continue;
        place(race, race.player, pose, speed);
        const before = race.player.progress;
        for (let i = 0; i < 20; i++) {
          step(race, { player: speed > 0 ? GAS : BRAKE }, DT, NO_WRECKS);
          if (!race.player.offRoad) break;
          assert.equal(race.player.progress.progress, before.progress);
          assert.equal(race.player.progress.laps, 0);
        }
      }
    }
  });
}

test('sin nada al alcance, la colisión no toca el estado que da la conducción', () => {
  const car = carAt(0, 0, 0.3, 20);
  const next = stepCar(car, GAS, DT, P);
  assert.equal(resolveSceneryCollision(car, next, CAR, sceneryWith([{ x: 50, z: 50, radius: 1 }]), PARAMS, IMPACT), next);
});

test('un desplazamiento enorme en un solo paso tampoco atraviesa un obstáculo ni el límite (detección continua)', () => {
  const scenery = sceneryWith([{ x: 0, z: 10, radius: 0.5 }], 30);
  const car = carAt(0, 0, 0, 45);
  const hit = resolveSceneryCollision(car, { ...car, z: 25 }, CAR, scenery, PARAMS, IMPACT);
  assert.ok(hit.z < 10 - 0.5 - CAR.length / 2 + 1e-3, `z ${hit.z}`);
  assert.equal(hit.speed, 0, 'golpe fuerte: se queda donde ha chocado');
  const out = resolveSceneryCollision(
    carAt(20, 0, Math.PI / 2, 45), { ...car, x: 200, z: 0, heading: Math.PI / 2 }, CAR, sceneryWith([], 30), PARAMS, IMPACT,
  );
  assert.ok(out.x <= 30 - CAR.length / 2);
});

test('de frente el coche rebota; de refilón pierde velocidad, se desvía y sigue adelante (RF-033)', () => {
  const wall = sceneryWith([], 20);
  const frontal = advance(carAt(0, 17.7, 0, 15), GAS, wall);
  assert.ok(Math.abs(frontal.speed + (15 + P.acceleration * DT) * PARAMS.bounce) < 1e-9);
  assert.equal(frontal.heading, 0);
  assert.equal(touchesScenery(frontal, CAR, wall), false);

  // Casi paralelo al muro de arriba, avanzando hacia +X y acercándose a él.
  let car = carAt(-10, 18.5, Math.PI / 2 - 0.2, 30);
  let slowest = car.speed;
  for (let i = 0; i < 40; i++) {
    car = advance(car, GAS, wall);
    slowest = Math.min(slowest, car.speed);
    assert.equal(touchesScenery(car, CAR, wall), false);
  }
  assert.ok(slowest < 30 && slowest > 20, `velocidad ${slowest}`);
  assert.ok(Math.abs(car.heading - Math.PI / 2) < 0.02, `rumbo ${car.heading}`);
  assert.ok(car.x > 0, 'se desliza a lo largo del muro');
});

test('un golpe marcha atrás rebota hacia delante', () => {
  const scenery = sceneryWith([{ x: 0, z: -3.2, radius: 0.9 }]);
  const car = advance(carAt(0, 0, 0, -10), BRAKE, scenery);
  assert.ok(car.speed > 0 && car.speed < 10, `velocidad ${car.speed}`);
  assert.equal(touchesScenery(car, CAR, scenery), false);
});

test('el contacto usa el rectángulo del coche: un obstáculo junto a una esquina se detecta y al lado no', () => {
  const rock = (x, z) => sceneryWith([{ x, z, radius: 1 }]);
  const pose = carAt(0, 0, 0);
  const corner = { x: CAR.width / 2, z: CAR.length / 2 };
  assert.equal(touchesScenery(pose, CAR, rock(corner.x + 0.6, corner.z + 0.6)), true);
  assert.equal(touchesScenery(pose, CAR, rock(corner.x + 0.8, corner.z + 0.8)), false);
  assert.equal(touchesScenery(pose, CAR, rock(corner.x + 1.01, 0)), false);
  assert.equal(touchesScenery(pose, CAR, rock(corner.x + 0.99, 0)), true);
  // Girado 90 grados, el largo queda a lo largo de X.
  assert.equal(touchesScenery(carAt(0, 0, Math.PI / 2), CAR, rock(CAR.length / 2 + 0.99, 0)), true);
  assert.equal(touchesScenery(pose, CAR, rock(0, 0)), true, 'obstáculo dentro del coche');
});

test('rivales y jugador chocan igual, con cualquier modelo de coche (RF-032, RN-07)', () => {
  const race = startedRace('sierra', { rivals: true });
  const obstacle = race.scenery.obstacles[0];
  const pose = facing(race, obstacle, 'road', 0.1);
  const results = race.participants.map((participant) => {
    // Cada uno solo en la misma pose: los demás se apartan, porque los coches son sólidos entre sí.
    race.participants.forEach((other, i) => place(race, other, { x: i * 8 - 40, z: 0, heading: 0 }));
    place(race, participant, pose, 20);
    step(race, { [participant.id]: GAS });
    return [participant.x, participant.z, participant.heading, participant.speed];
  });
  assert.equal(new Set(race.participants.map((p) => p.carModelId)).size, CONFIG.cars.models.length);
  assert.ok(results[0][3] < 0, 'ha chocado');
  for (const result of results) assert.deepEqual(result, results[0]);
});

test('un rival que no avanza da marcha atrás con las mismas cuatro entradas y después vuelve a conducir', () => {
  const race = startedRace('ribera', { rivals: true });
  const rival = race.participants.find((p) => !p.isPlayer);
  const driver = race.drivers[rival.id];
  const { stuckAfter, reverseDuration, detourDuration } = CONFIG.ai.recovery;
  const stuck = { ...rival, speed: 0, brakeHeld: false, reverseAllowed: false };
  let memory = createAiRecovery();
  const drive = (car) => {
    const result = aiDrive(memory, driver, car, CONFIG.ai, DT);
    memory = result.recovery;
    return result.input;
  };
  let waited = 0;
  while (!drive(stuck).brake) {
    waited += DT;
    assert.ok(waited <= stuckAfter + DT, 'tarda demasiado en reaccionar');
  }
  assert.ok(waited >= stuckAfter - 2 * DT);
  const input = drive({ ...stuck, speed: -5, brakeHeld: true, reverseAllowed: true });
  assert.deepEqual(Object.keys(input).sort(), ['accelerate', 'brake', 'left', 'right']);
  assert.equal(input.accelerate, false);
  assert.equal(input.brake, true);
  assert.notEqual(input.left, input.right);
  // Un pulso de freno que no admite marcha atrás se suelta para volver a pisarlo.
  assert.equal(drive({ ...stuck, brakeHeld: true, reverseAllowed: false }).brake, false);
  const backwards = { ...stuck, speed: -5, brakeHeld: true, reverseAllowed: true };
  let reversing = 3 * DT;
  while (drive(backwards).brake) reversing += DT;
  assert.ok(Math.abs(reversing - reverseDuration) <= 2 * DT, `marcha atrás ${reversing} s`);
  // Después avanza despacio un trecho y, al terminar, vuelve a conducir con normalidad.
  const rolling = { ...stuck, speed: CONFIG.ai.minTargetSpeed + 1 };
  let detour = DT;
  while (!drive(rolling).accelerate && detour <= detourDuration + 1) detour += DT;
  assert.ok(Math.abs(detour - detourDuration) <= 2 * DT, `rodeo ${detour} s`);
  assert.deepEqual(drive({ ...stuck, speed: 10 }), aiInput(driver, { ...stuck, speed: 10 }, CONFIG.ai));
});

test('los obstáculos salen de la definición del circuito, a los metros de la calzada que se indican', () => {
  const definition = requireTrackDefinition(CONFIG, 'llanura');
  const track = buildTrack(definition);
  const one = buildScenery(track, { ...definition, obstacles: [{ type: 'rock', at: 0.5, side: 1, gap: 6, radius: 2 }] });
  assert.equal(one.obstacles.length, 1);
  assert.equal(one.obstacles[0].radius, 2);
  assert.ok(Math.abs(roadClearance(track, one.obstacles[0], 2) - 6) < 0.1);
  assert.deepEqual(buildScenery(track, { ...definition, obstacles: undefined }).obstacles, []);
  assert.throws(() => buildScenery(track, { ...definition, obstacles: [{ type: 'nada', at: 0, side: 1, gap: 6 }] }), /desconocido/);
  assert.equal(trackDefinitions(CONFIG).every((d) => d.obstacles.length > 0), true);
});
