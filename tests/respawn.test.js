// Reaparición tras la destrucción y protección posterior (RF-039, RF-040, RF-041 parcial, RF-042, RN-01,
// RN-04, CA-04 parcial).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { carsOverlap } from '../src/logic/carContacts.js';
import { touchesScenery } from '../src/logic/collisions.js';
import { createWreck } from '../src/logic/destruction.js';
import { createCarState } from '../src/logic/driving.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { ImpactSeverity, createDamage } from '../src/logic/impact.js';
import { relocateProgress, validDistanceCap } from '../src/logic/progress.js';
import { ParticipantStatus, stepRace } from '../src/logic/race.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createSeededRandom } from '../src/logic/random.js';
import { createProtection, findRespawnSpot, stepProtection } from '../src/logic/respawn.js';
import { trackDefinitions } from '../src/logic/trackCatalog.js';
import { forwardOf, nearestOnCenterline, pointAtDistance, rightOf, signedDistance } from '../src/logic/track.js';
import { autopilot, CORNERING_AUTOPILOT } from './helpers/autopilot.js';

const P = CONFIG.carPerformance;
const CAR = CONFIG.race.car;
const RESPAWN = CONFIG.respawn;
const STRONG_SPEED = CONFIG.impact.strongSpeed;
const LOCK = CONFIG.destruction.lockDuration;
const { DESTRUIDO, EN_CARRERA } = ParticipantStatus;
const DT = 1 / 60;
const LOCK_STEPS = Math.round(LOCK / DT);
const PROTECTION_STEPS = Math.round(RESPAWN.protectionDuration / DT);
const NONE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { ...NONE, accelerate: true };
const OPEN = Object.freeze({ bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000 }, obstacles: [] });

const playerIndex = CONFIG.grid.playerSlotIndex;
const rivalIndex = playerIndex === 0 ? 1 : 0;

const held = (race) => Object.fromEntries(race.participants.map((p) => [p.id, NONE]));

/** Un paso en el que solo actúa lo indicado en `inputs`. */
const step = (race, inputs = {}, config = CONFIG, dt = DT) => stepRace(race, { ...held(race), ...inputs }, dt, config);

/** Punto del circuito a `along` metros de la meta y `lateral` a la derecha. */
function poseAt(track, along, lateral = 0) {
  const center = pointAtDistance(track, along);
  const right = rightOf(center.heading);
  return { x: center.x + right.x * lateral, z: center.z + right.z * lateral, heading: center.heading };
}

/** Progreso de un coche que ha llegado en orden a `along` metros de la meta con `laps` vueltas completas. */
function progressAt(track, along, laps = 0) {
  const { x, z } = poseAt(track, along);
  return {
    started: true,
    laps,
    checkpointIndex: track.checkpoints.filter((gate) => gate.distance < along).length,
    lapPosition: along,
    lapDistance: along,
    progress: laps * track.length + along,
    x,
    z,
  };
}

function place(race, participant, along, { lateral = 0, speed = 0, laps = 0 } = {}) {
  const pose = poseAt(race.track, along, lateral);
  Object.assign(participant, createCarState(pose), { speed, surfaceSample: null, offRoad: false });
  participant.progress = relocateProgress(progressAt(race.track, along, laps), race.track, pose);
}

/**
 * Carrera de diez con la señal de salida ya dada y todos aparcados fuera de la pista, para que no
 * estorben. El escenario es el del circuito.
 */
function openRace(trackId = 'llanura', config = CONFIG, laps = 3) {
  const race = createRaceFromSetup(config, { carModelId: 'rayo', trackId, laps }, createSeededRandom(1));
  while (!stepRace(race, held(race), DT, config).started);
  race.participants.forEach((p, i) => Object.assign(p, { x: 1000 + i * 10, z: -1000, speed: 0 }));
  return race;
}

/** Destruye un coche donde está, como lo deja un golpe fuerte. */
function wreck(participant, config = CONFIG) {
  Object.assign(participant, createCarState(participant), { status: DESTRUIDO, wreck: createWreck(config.destruction) });
}

/** Avanza la carrera hasta que el coche deja de estar destruido; devuelve los pasos dados. */
function waitRespawn(race, car, config = CONFIG) {
  let steps = 0;
  while (car.status === DESTRUIDO && steps < 10 * LOCK_STEPS) {
    step(race, {}, config);
    steps++;
  }
  assert.equal(car.status, EN_CARRERA, 'ha reaparecido');
  return steps;
}

/** Coloca una roca justo delante del coche, para que se estrelle contra ella. */
function rockAhead(race, car) {
  const forward = forwardOf(car.heading);
  const reach = CAR.length / 2 + 1.1;
  race.scenery = {
    bounds: race.scenery.bounds,
    obstacles: [{ type: 'rock', x: car.x + forward.x * reach, z: car.z + forward.z * reach, radius: 1 }],
  };
}

/** Comprueba que el sitio de un coche reaparecido cumple las condiciones de RF-039 y RN-04. */
function assertSafeSpot(race, car, label = car.id) {
  const nearest = nearestOnCenterline(race.track, car.x, car.z);
  assert.ok(nearest.distance <= (race.track.width - CAR.width) / 2 + 1e-6, `${label}: entero a lo ancho de la calzada`);
  const heading = pointAtDistance(race.track, nearest.along).heading;
  const error = Math.atan2(Math.sin(car.heading - heading), Math.cos(car.heading - heading));
  assert.ok(Math.abs(error) < 0.2, `${label}: mira en el sentido de la carrera (${error.toFixed(2)} rad)`);
  assert.equal(touchesScenery(car, CAR, race.scenery), false, `${label}: no toca el escenario`);
  for (const other of race.participants) {
    if (other !== car) assert.equal(carsOverlap(car, other, CAR), false, `${label}: no solapa con ${other.id}`);
  }
  const advance = signedDistance(race.track, nearest.along - car.progress.lapDistance);
  assert.ok(advance <= 0.01, `${label}: no queda por delante de su distancia válida (${advance.toFixed(2)} m)`);
}

test('los parámetros de la reaparición están en la configuración, congelados y sin depender del modelo (RF-042)', () => {
  assert.ok(Object.isFrozen(CONFIG.respawn));
  assert.ok(RESPAWN.protectionDuration > 0);
  assert.ok(RESPAWN.exitSpeed >= 0 && RESPAWN.exitSpeed < STRONG_SPEED);
  assert.ok(RESPAWN.maxSearchDistance > CONFIG.race.maxParticipants * (CAR.length + RESPAWN.clearance));
  for (const model of CONFIG.cars.models) assert.equal(model.respawn, undefined);
});

test('tras un golpe fuerte reaparece intacto a los tres segundos activos, no antes, en el centro de la calzada (RF-039, CA-04 parcial)', () => {
  const race = openRace();
  const { player } = race;
  place(race, player, 25, { lateral: 4, speed: P.maxSpeed, laps: 1 });
  rockAhead(race, player);
  step(race);
  assert.equal(player.status, DESTRUIDO);
  assert.equal(player.damage.worst, ImpactSeverity.STRONG);
  const { progress } = player;

  for (let i = 0; i < LOCK_STEPS - 1; i++) step(race, { [player.id]: GAS });
  assert.equal(player.status, DESTRUIDO, 'un paso antes sigue destruido');
  step(race, { [player.id]: GAS });
  assert.equal(player.status, EN_CARRERA);
  assert.equal(player.wreck, null);
  assert.deepEqual(player.damage, createDamage(), 'coche nuevo, sin daños');
  assert.deepEqual(
    [player.speed, player.steer, player.slideX, player.slideZ, player.impactSpeed],
    [RESPAWN.exitSpeed, 0, 0, 0, 0],
  );
  assert.deepEqual(player.protection, { timeLeft: RESPAWN.protectionDuration });
  assert.equal(player.offRoad, false);
  assertSafeSpot(race, player);
  assert.ok(nearestOnCenterline(race.track, player.x, player.z).distance < 1e-6, 'sitio preferido: el centro');
  assert.ok(Math.abs(player.progress.lapPosition - progress.lapDistance) < 0.01, 'junto a su último avance válido');
});

test('conserva piloto, modelo, vueltas, checkpoints y distancia válida, sin sumar vueltas ficticias (RF-040)', () => {
  const race = openRace();
  const car = race.participants[rivalIndex];
  const along = race.track.checkpoints[2].distance + 5;
  place(race, car, along, { laps: 2 });
  const before = { id: car.id, name: car.name, carModelId: car.carModelId, gridIndex: car.gridIndex, isPlayer: car.isPlayer };
  const { progress } = car;
  wreck(car);
  waitRespawn(race, car);
  for (const [key, value] of Object.entries(before)) assert.equal(car[key], value, key);
  for (const key of ['started', 'laps', 'checkpointIndex', 'lapDistance', 'progress']) {
    assert.equal(car.progress[key], progress[key], key);
  }
  assert.equal(car.finished, false);
  assert.equal(car.finishTime, null);
});

test('quien ya había terminado reaparece conservando su llegada y su tiempo (RF-027, RF-040)', () => {
  const race = openRace('llanura', CONFIG, 1);
  const car = race.participants[rivalIndex];
  place(race, car, 0, { laps: 1 });
  car.progress = { ...car.progress, checkpointIndex: 0 };
  Object.assign(car, { finished: true, finishTime: 12.5 });
  const { progress } = car;
  wreck(car);
  waitRespawn(race, car);
  assert.equal(car.finished, true);
  assert.equal(car.finishTime, 12.5);
  assert.equal(car.progress.laps, 1);
  assert.equal(car.progress.progress, progress.progress);
  assertSafeSpot(race, car);
});

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: en cualquier punto del circuito hay un sitio en la calzada, bien orientado y libre (RF-039)`, () => {
    const race = openRace(definition.id);
    const car = race.participants[rivalIndex];
    for (let along = 0; along < race.track.length; along += 3) {
      place(race, car, along);
      const spot = findRespawnSpot(race, car.progress, [], RESPAWN);
      assert.ok(spot, `sin sitio en ${along}`);
      const respawned = { ...car, ...spot, progress: relocateProgress(car.progress, race.track, spot) };
      assertSafeSpot({ ...race, participants: [respawned] }, respawned, `${definition.id} en ${along}`);
    }
  });

  test(`${definition.id}: si su distancia válida es la del checkpoint pendiente, reaparece detrás y cruzarlo cuenta (RN-01)`, () => {
    const race = openRace(definition.id);
    const car = race.participants[playerIndex];
    for (const gate of race.track.checkpoints) {
      place(race, car, gate.distance, { laps: 1 });
      car.progress = { ...car.progress, checkpointIndex: gate.index };
      assert.equal(validDistanceCap(car.progress, race.track), gate.distance);
      wreck(car);
      waitRespawn(race, car);
      const forward = forwardOf(gate.heading);
      assert.ok((car.x - gate.x) * forward.x + (car.z - gate.z) * forward.z < 0, `puerta ${gate.index}: detrás`);
      assert.equal(car.progress.checkpointIndex, gate.index);
      for (let i = 0; i < 90 && car.progress.checkpointIndex === gate.index; i++) {
        step(race, { [car.id]: autopilot(race, car, CORNERING_AUTOPILOT) });
      }
      assert.equal(car.progress.checkpointIndex, gate.index + 1, `puerta ${gate.index}: cuenta al cruzarla`);
    }
  });

  test(`${definition.id}: tras reaparecer se puede completar la vuelta, y solo esa (RF-040, RN-01)`, () => {
    // En mitad de la vuelta, justo después de la meta (donde el sitio puede quedar por detrás de ella) y
    // antes de llegar a ella.
    for (const [fraction, blocked] of [[0.5, false], [0, true], [0.97, false]]) {
      const race = openRace(definition.id);
      const car = race.participants[playerIndex];
      const along = fraction * race.track.length;
      place(race, car, along, { laps: 1 });
      if (blocked) {
        // La anchura entera ocupada en el sitio preferido: tiene que irse por detrás de la meta.
        const limit = (race.track.width - CAR.width) / 2;
        const laterals = [0];
        for (let offset = RESPAWN.lateralStep; offset <= limit; offset += RESPAWN.lateralStep) laterals.push(offset, -offset);
        laterals.forEach((lateral, i) => place(race, race.participants[i], along, { lateral }));
      }
      wreck(car);
      waitRespawn(race, car);
      assert.equal(car.progress.laps, 1, 'reaparecer no suma vueltas');
      if (blocked) assert.ok(car.progress.lapPosition < 0, 'ha quedado antes de la meta');
      race.participants.forEach((p) => p !== car && Object.assign(p, { x: 1000 + p.gridIndex * 10, z: -1000 }));
      let steps = 0;
      while (car.progress.laps === 1 && steps++ < 60 * 200) step(race, { [car.id]: autopilot(race, car, CORNERING_AUTOPILOT) });
      assert.equal(car.progress.laps, 2, `desde ${fraction} de la vuelta`);
      // La vuelta ha sido entera: no se ha cerrado antes de recorrer lo que faltaba.
      const missing = fraction === 0 ? race.track.length : race.track.length - along;
      assert.ok(steps * DT > missing / P.maxSpeed, 'ha recorrido lo que le faltaba');
    }
  });
}

test('con el sitio preferido ocupado elige otro libre a los lados o más atrás, nunca más adelante (RF-039, RF-042)', () => {
  const race = openRace();
  const car = race.participants[playerIndex];
  const [first, ...rest] = race.participants.filter((p) => p !== car);
  place(race, car, 60);
  place(race, first, 60);
  wreck(car);
  waitRespawn(race, car);
  assertSafeSpot(race, car);
  assert.ok(Math.abs(nearestOnCenterline(race.track, car.x, car.z).distance) > 1, 'se ha apartado a un lado');

  // Nueve coches taponan la calzada desde el sitio preferido hacia atrás y por delante.
  place(race, car, 60);
  [first, ...rest].forEach((p, i) => place(race, p, 66 - Math.floor(i / 3) * 5, { lateral: (i % 3 - 1) * 6 }));
  wreck(car);
  waitRespawn(race, car);
  assertSafeSpot(race, car);
  assert.ok(car.progress.lapPosition < 55, `más atrás: ${car.progress.lapPosition}`);
});

test('tampoco aparece dentro de los restos de otro coche destruido', () => {
  const race = openRace();
  const car = race.participants[playerIndex];
  const other = race.participants[rivalIndex];
  place(race, car, 60);
  place(race, other, 60);
  wreck(car);
  step(race); // el otro se destruye algo después, así sigue destruido cuando reaparece el primero
  wreck(other);
  waitRespawn(race, car);
  assert.equal(other.status, DESTRUIDO);
  assertSafeSpot(race, car);
});

test('dos coches destruidos en el mismo sitio y a la vez reaparecen sin solaparse (RF-039)', () => {
  const race = openRace();
  const car = race.participants[playerIndex];
  const other = race.participants[rivalIndex];
  place(race, car, 60);
  place(race, other, 60);
  wreck(car);
  wreck(other);
  waitRespawn(race, car);
  assert.equal(other.status, EN_CARRERA);
  assert.equal(carsOverlap(car, other, CAR), false);
  assertSafeSpot(race, car);
  assertSafeSpot(race, other);
});

test('junto a un obstáculo que invade el sitio preferido busca otro que no lo toque (RF-039)', () => {
  const race = openRace();
  const car = race.participants[playerIndex];
  place(race, car, 60);
  const spot = poseAt(race.track, 60);
  race.scenery = { bounds: race.scenery.bounds, obstacles: [{ type: 'rock', x: spot.x, z: spot.z, radius: 1.6 }] };
  wreck(car);
  waitRespawn(race, car);
  assertSafeSpot(race, car);
});

test('si no queda ningún sitio libre sigue destruido y reaparece en cuanto lo hay', () => {
  const config = { ...CONFIG, respawn: { ...RESPAWN, maxSearchDistance: 0, lateralStep: 100 } };
  const race = openRace('llanura', config);
  const car = race.participants[playerIndex];
  const other = race.participants[rivalIndex];
  place(race, car, 60);
  place(race, other, 60);
  wreck(car, config);
  for (let i = 0; i < LOCK_STEPS + 30; i++) step(race, {}, config);
  assert.equal(car.status, DESTRUIDO);
  assert.equal(car.wreck.readyToRespawn, true);
  Object.assign(other, { x: 1000, z: -1000 });
  step(race, {}, config);
  assert.equal(car.status, EN_CARRERA);
});

test('el jugador reaparecido vuelve a responder a las flechas (RF-039)', () => {
  const race = openRace();
  const { player } = race;
  place(race, player, 25);
  wreck(player);
  waitRespawn(race, player);
  const { x, z, heading } = player;
  for (let i = 0; i < 30; i++) step(race, { [player.id]: { ...GAS, left: true } });
  assert.ok(Math.hypot(player.x - x, player.z - z) > 1);
  assert.ok(player.heading > heading);
});

test('un rival reaparecido sigue las mismas reglas y su piloto IA vuelve a conducir desde cero (RF-039, RF-041 parcial)', () => {
  const race = openRace();
  const car = race.participants[rivalIndex];
  place(race, car, 25);
  race.recoveries[car.id] = Object.freeze({ stuckTime: 0.5, reverseTime: 1, detourTime: 2, attempts: 3 });
  wreck(car);
  waitRespawn(race, car);
  assert.deepEqual(race.recoveries[car.id], { stuckTime: 0, reverseTime: 0, detourTime: 0, attempts: 0 });
  assert.deepEqual(car.protection, { timeLeft: RESPAWN.protectionDuration });
  assert.deepEqual(car.damage, createDamage());
  assertSafeSpot(race, car);
  const { progress } = car.progress;
  const inputs = held(race);
  delete inputs[car.id];
  for (let i = 0; i < 60 * 5; i++) stepRace(race, inputs, DT, CONFIG);
  assert.ok(car.progress.progress > progress + 30, 'conduce y avanza');
});

test('las mismas reglas para los diez participantes, con cualquier modelo (RF-041 parcial, RN-07)', () => {
  const outcome = (car) => [car.status, car.x, car.z, car.heading, car.speed, car.protection, car.damage, car.progress];
  let expected = null;
  const models = new Set();
  for (let index = 0; index < CONFIG.race.maxParticipants; index++) {
    const race = openRace();
    const car = race.participants[index];
    place(race, car, 60);
    wreck(car);
    assert.equal(waitRespawn(race, car), LOCK_STEPS, car.id);
    expected ??= outcome(car);
    assert.deepEqual(outcome(car), expected, car.id);
    assert.equal(new Set(race.standings).size, 10);
    models.add(car.carModelId);
  }
  assert.equal(models.size, CONFIG.cars.models.length);
});

test('la velocidad de salida y la duración de la protección se leen de la configuración', () => {
  const config = { ...CONFIG, respawn: { ...RESPAWN, exitSpeed: 5, protectionDuration: 0.5 } };
  const race = openRace('llanura', config);
  const car = race.participants[playerIndex];
  place(race, car, 25);
  wreck(car, config);
  waitRespawn(race, car, config);
  assert.equal(car.speed, 5);
  assert.deepEqual(car.protection, { timeLeft: 0.5 });
});

test('la protección solo avanza con el tiempo de simulación y se agota (RF-042)', () => {
  const protection = createProtection(RESPAWN);
  assert.equal(stepProtection(protection, 0), protection);
  assert.deepEqual(stepProtection(protection, 0.5), { timeLeft: RESPAWN.protectionDuration - 0.5 });
  assert.equal(protection.timeLeft, RESPAWN.protectionDuration, 'no se modifica el anterior');
  assert.equal(stepProtection(protection, RESPAWN.protectionDuration), null);
  assert.equal(stepProtection(null, 1), null);
  assert.equal(createProtection({ protectionDuration: 0 }), null);
});

/** Coche del jugador recién reaparecido a 25 m de la meta. */
function respawned() {
  const race = openRace();
  const car = race.participants[playerIndex];
  place(race, car, 25);
  wreck(car);
  waitRespawn(race, car);
  return { race, car };
}

test('durante la protección un golpe fuerte contra un obstáculo no destruye y cuenta como leve (RF-042)', () => {
  const { race, car } = respawned();
  car.speed = P.maxSpeed;
  rockAhead(race, car);
  step(race);
  assert.equal(car.status, EN_CARRERA);
  assert.equal(car.wreck, null);
  assert.equal(car.damage.worst, ImpactSeverity.LIGHT);
  assert.equal(car.damage.level, CONFIG.impact.light.damage);
  assert.ok(car.speed < 0, 'rebota como en un golpe leve');
  assert.equal(touchesScenery(car, CAR, race.scenery), false, 'sigue siendo sólido: no atraviesa');
});

test('durante la protección el choque con otro coche no lo destruye; el otro, sin protección, sí (RF-033, RF-042)', () => {
  const { race, car } = respawned();
  const other = race.participants[rivalIndex];
  race.scenery = OPEN;
  Object.assign(other, createCarState(car), {
    x: car.x - Math.sin(car.heading) * (CAR.length + 0.02),
    z: car.z - Math.cos(car.heading) * (CAR.length + 0.02),
    speed: P.maxSpeed,
  });
  step(race);
  assert.equal(other.status, DESTRUIDO);
  assert.equal(car.status, EN_CARRERA);
  assert.equal(car.damage.worst, ImpactSeverity.LIGHT);
  assert.ok(car.speed > 0, 'recibe el empujón');
  assert.equal(carsOverlap(car, other, CAR), false);
});

test('la protección dura lo configurado y después un golpe fuerte vuelve a destruir (RF-042)', () => {
  for (const [steps, destroyed] of [[PROTECTION_STEPS - 1, false], [PROTECTION_STEPS, true]]) {
    const { race, car } = respawned();
    for (let i = 0; i < steps; i++) step(race);
    assert.equal(car.protection === null, destroyed);
    car.speed = P.maxSpeed;
    rockAhead(race, car);
    step(race);
    assert.equal(car.status === DESTRUIDO, destroyed, `tras ${steps} pasos`);
  }
});

test('con la partida en pausa ni el bloqueo ni la protección avanzan (RF-038, RF-042)', () => {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(1) });
  machine.openSelection();
  for (let i = 0; i < 3; i++) session.confirmSelection();
  while (machine.state !== GameState.EN_CARRERA) session.step(DT, {});
  const { player } = session.race;
  wreck(player);
  let steps = 0;
  while (player.status === DESTRUIDO && steps++ < 2 * LOCK_STEPS) session.step(DT, {});
  session.step(DT, {});
  const { protection } = player;
  assert.ok(protection.timeLeft < RESPAWN.protectionDuration);
  machine.transitionTo(GameState.PAUSA);
  for (let i = 0; i < 600; i++) session.step(DT, {});
  assert.equal(player.protection, protection);

  // Y al repetir la carrera nadie empieza destruido ni protegido.
  machine.transitionTo(GameState.EN_CARRERA);
  machine.finishRace();
  machine.repeatRace();
  for (const p of session.race.participants) {
    assert.equal(p.protection, null, p.id);
    assert.equal(p.wreck, null, p.id);
    assert.equal(p.status, ParticipantStatus.PARRILLA, p.id);
  }
});
