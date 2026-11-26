import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { applySlide, carsOverlap, resolveCarContacts } from '../src/logic/carContacts.js';
import { touchesScenery } from '../src/logic/collisions.js';
import { createCarState, stepCar } from '../src/logic/driving.js';
import { createProgress } from '../src/logic/progress.js';
import { createRace, stepRace } from '../src/logic/race.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createSeededRandom } from '../src/logic/random.js';
import { rankParticipants } from '../src/logic/standings.js';
import { pointAtDistance, rightOf } from '../src/logic/track.js';
import { trackDefinitions } from '../src/logic/trackCatalog.js';

const P = CONFIG.carPerformance;
const CAR = CONFIG.race.car;
const PARAMS = CONFIG.carContact;
/** Velocidad de la embestida más rápida que aún es un golpe leve contra un coche parado (`impact.js`). */
const FIRM_PUSH = CONFIG.impact.strongSpeed - 1;
const DT = 1 / 60;
const NONE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { ...NONE, accelerate: true };
const BRAKE = { ...NONE, brake: true };
const OPEN = Object.freeze({ bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000 }, obstacles: [] });

const carAt = (x, z, heading = 0, speed = 0) => ({ ...createCarState({ x, z, heading }), speed });

/** Un paso de varios coches sueltos: cada uno conduce con su entrada y se resuelven los contactos. */
function stepCars(cars, inputs, dt = DT, scenery = OPEN) {
  const moves = cars.map((previous, i) => ({
    previous,
    next: applySlide(stepCar(previous, inputs[i] ?? NONE, dt, P), dt, PARAMS),
  }));
  return resolveCarContacts(moves, { car: CAR, scenery }, dt, CONFIG);
}

function assertNoOverlap(cars, label = '') {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      assert.equal(carsOverlap(cars[i], cars[j], CAR), false, `${label}: se solapan ${i} y ${j}`);
    }
  }
}

/** Carrera con la señal de salida ya dada y todos quietos en la parrilla. */
function startedRace(trackId = 'llanura', laps = 1) {
  const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId, laps }, createSeededRandom(1));
  const held = Object.fromEntries(race.participants.map((p) => [p.id, NONE]));
  while (!stepRace(race, held, DT, CONFIG).started);
  return race;
}

/** Coloca un participante en una pose, con su progreso partiendo de ella. */
function place(race, participant, pose, speed = 0) {
  Object.assign(participant, createCarState(pose), { speed, surfaceSample: null, progress: createProgress(race.track, pose) });
}

/** Avanza la carrera: quien no esté en `inputs` queda sin tocar los controles. */
function step(race, inputs = {}, dt = DT) {
  const held = Object.fromEntries(race.participants.map((p) => [p.id, NONE]));
  return stepRace(race, { ...held, ...inputs }, dt, CONFIG);
}

/** Pose a `lateral` metros a la derecha (negativo: izquierda) de la línea central, en la distancia `along`. */
function poseAt(track, along, lateral = 0) {
  const center = pointAtDistance(track, along);
  const right = rightOf(center.heading);
  return { x: center.x + right.x * lateral, z: center.z + right.z * lateral, heading: center.heading };
}

/** Aparta lejos de la calzada a quienes no participan en la prueba, sin tocarse entre sí. */
function parkOthers(race, keep) {
  const { minX, minZ } = race.scenery.bounds;
  race.scenery = OPEN;
  race.participants
    .filter((p) => !keep.includes(p))
    .forEach((p, i) => place(race, p, { x: minX - 100 - i * 10, z: minZ - 100, heading: 0 }));
}

test('los parámetros del contacto están en la configuración, congelados y valen para cualquier modelo (RF-033, RN-07)', () => {
  assert.ok(Object.isFrozen(PARAMS));
  assert.ok(PARAMS.restitution >= 0 && PARAMS.restitution < 1);
  assert.ok(PARAMS.speedLoss >= 0 && PARAMS.speedLoss < 1);
  assert.ok(PARAMS.spinFactor >= 0 && PARAMS.maxSpin >= 0);
  assert.ok(PARAMS.slideDeceleration > 0 && PARAMS.maxSlideSpeed >= 0);
  assert.ok(PARAMS.maxSweepStep > 0 && PARAMS.maxSweepStep < CAR.width / 2);
  assert.ok(Number.isInteger(PARAMS.maxPushIterations) && PARAMS.maxPushIterations > 0);
  for (const model of CONFIG.cars.models) assert.equal(model.carContact, undefined);
});

test('se detecta el solape de los rectángulos de dos coches, de lado, en fila y cruzados', () => {
  const car = carAt(0, 0);
  assert.equal(carsOverlap(car, carAt(CAR.width - 0.01, 0), CAR), true);
  assert.equal(carsOverlap(car, carAt(CAR.width + 0.01, 0), CAR), false);
  assert.equal(carsOverlap(car, carAt(0, CAR.length - 0.01), CAR), true);
  assert.equal(carsOverlap(car, carAt(0, CAR.length + 0.01), CAR), false);
  const crossed = (CAR.length + CAR.width) / 2;
  assert.equal(carsOverlap(car, carAt(crossed - 0.01, 0, Math.PI / 2), CAR), true);
  assert.equal(carsOverlap(car, carAt(crossed + 0.01, 0, Math.PI / 2), CAR), false);
  // En diagonal, la misma distancia entre centros toca o no según la orientación.
  assert.equal(carsOverlap(car, carAt(3, 3, Math.PI / 4), CAR), true);
  assert.equal(carsOverlap(car, carAt(3, 3, -Math.PI / 4), CAR), false);
});

test('a velocidad máxima y con el paso más largo, dos coches en trayectoria de choque no se solapan ni se atraviesan (RF-033)', () => {
  for (const heading of [Math.PI, Math.PI * 0.75, Math.PI / 2, Math.PI / 4, 0]) {
    for (const offset of [0, 0.8, 1.7]) {
      for (const dt of [DT, P.maxStep]) {
        // `a` avanza hacia +Z; `b` viene hacia el punto de encuentro con otro rumbo (con 0, está parado delante).
        const speed = heading === 0 ? 0 : P.maxSpeed;
        const distance = 12;
        let cars = [
          carAt(offset, -distance, 0, P.maxSpeed),
          carAt(-Math.sin(heading) * distance * (speed > 0), -Math.cos(heading) * distance * (speed > 0), heading, speed),
        ];
        const label = `rumbo ${heading.toFixed(2)}, desplazado ${offset}, paso ${dt.toFixed(3)}`;
        let touched = false;
        for (let i = 0; i < 90; i++) {
          const next = stepCars(cars, [GAS, speed > 0 ? GAS : NONE], dt);
          assertNoOverlap(next, label);
          touched ||= next[0].speed < cars[0].speed - 1;
          // De frente y por detrás, nunca cambian de orden a lo largo del eje.
          if (heading === Math.PI || heading === 0) {
            if (Math.abs(next[0].x - next[1].x) < CAR.width) assert.ok(next[0].z < next[1].z, label);
          }
          cars = next;
        }
        assert.ok(touched, `${label}: no llegan a chocar`);
      }
    }
  }
});

test('un desplazamiento enorme en un solo paso tampoco atraviesa a otro coche (detección continua)', () => {
  const still = carAt(0, 10);
  const mover = carAt(0, 0, 0, P.maxSpeed);
  const [after, other] = resolveCarContacts(
    [{ previous: mover, next: { ...mover, z: 25 } }, { previous: still, next: still }],
    { car: CAR, scenery: OPEN }, P.maxStep, CONFIG,
  );
  assert.ok(after.z < other.z, `${after.z} frente a ${other.z}`);
  assert.equal(carsOverlap(after, other, CAR), false);
});

test('sin otro coche al alcance, el movimiento no se toca', () => {
  const cars = [carAt(0, 0, 0, 20), carAt(50, 0, 0, 20)];
  const moves = cars.map((previous) => ({ previous, next: stepCar(previous, GAS, DT, P) }));
  const results = resolveCarContacts(moves, { car: CAR, scenery: OPEN }, DT, CONFIG);
  results.forEach((result, i) => assert.equal(result, moves[i].next));
});

test('en un alcance por detrás, quien golpea pierde velocidad y el golpeado recibe un empujón', () => {
  let cars = [carAt(0, 0, 0, 28), carAt(0, CAR.length + 0.2, 0, 10)];
  cars = stepCars(cars, [GAS, GAS]);
  assert.ok(cars[0].speed < 25, `golpea: ${cars[0].speed}`);
  assert.ok(cars[1].speed > 15, `golpeado: ${cars[1].speed}`);
  assert.ok(cars[1].speed > cars[0].speed, 'se separan');
  assert.equal(cars[0].heading, 0, 'un golpe centrado no desvía');
  assert.equal(cars[1].heading, 0);
  assertNoOverlap(cars);
});

test('el contacto nunca adelanta de golpe a un coche parado: solo retrocede quien iba hacia él', () => {
  const still = carAt(0, 10);
  const mover = carAt(0, 10 - CAR.length - 0.01, 0, 30);
  const next = stepCar(mover, GAS, DT, P);
  const [after, struck] = resolveCarContacts(
    [{ previous: mover, next }, { previous: still, next: still }], { car: CAR, scenery: OPEN }, DT, CONFIG,
  );
  assert.ok(after.z <= next.z, 'quien golpea no gana recorrido');
  // El golpeado solo avanza lo que recorre con su velocidad nueva en lo que queda del paso.
  assert.ok(struck.z - still.z <= struck.speed * DT + 1e-9, `${struck.z - still.z}`);
  assert.ok(struck.speed > 0);
});

test('un choque de frente rebota a los dos', () => {
  const [a, b] = stepCars([carAt(0, 0, 0, 20), carAt(0, CAR.length + 0.2, Math.PI, 20)], [NONE, NONE]);
  assert.ok(a.speed < 0 && b.speed < 0, `${a.speed}, ${b.speed}`);
  assert.ok(Math.abs(a.speed - b.speed) < 1e-9, 'misma regla para los dos');
});

test('un golpe de costado empuja al otro y uno descentrado le cambia el rumbo (RF-033)', () => {
  // `a` cruza hacia +X y golpea el costado de `b`, parado y mirando a +Z, por delante de su centro.
  let cars = [carAt(-4.5, 1.5, Math.PI / 2, 20), carAt(0, 0)];
  const start = { ...cars[1] };
  let slid = false;
  for (let i = 0; i < 60; i++) {
    cars = stepCars(cars, [NONE, NONE]);
    slid ||= cars[1].slideX > 0;
    assertNoOverlap(cars);
  }
  assert.ok(slid, 'el golpeado desliza de costado');
  assert.ok(cars[1].x > start.x + 0.5, `desplazado ${cars[1].x}`);
  assert.ok(cars[1].heading > 0.01, `rumbo ${cars[1].heading}`);
  assert.equal(cars[1].slideX, 0, 'el deslizamiento se apaga');
  assert.ok(cars[0].speed < 20 * 0.6);
});

test('dos coches en paralelo que se arriman se separan sin dejar de avanzar', () => {
  let cars = [carAt(-1.3, 0, 0, 20), carAt(1.3, 0, 0, 20)];
  // El primero gira hacia el segundo (rumbo creciente: hacia +X).
  for (let i = 0; i < 120; i++) {
    cars = stepCars(cars, [{ ...GAS, left: i < 20 }, GAS]);
    assertNoOverlap(cars, `paso ${i}`);
  }
  assert.ok(cars.every((car) => car.speed > 10 && car.z > 20), JSON.stringify(cars));
});

test('el contacto vale igual para cualquier pareja de los diez, jugador o rival, y para cualquier modelo (RF-032, RN-07)', () => {
  const race = startedRace();
  const scenery = race.scenery;
  let expected = null;
  const models = new Set();
  for (let i = 0; i < race.participants.length; i++) {
    for (let j = 0; j < race.participants.length; j++) {
      if (i === j) continue;
      race.scenery = scenery;
      const striker = race.participants[i];
      const struck = race.participants[j];
      parkOthers(race, [striker, struck]);
      place(race, striker, { x: 0, z: 0, heading: 0 }, 28);
      place(race, struck, { x: 0.5, z: CAR.length + 0.2, heading: 0 }, 10);
      step(race, { [striker.id]: GAS, [struck.id]: GAS });
      const result = [striker, struck].map((p) => [p.x, p.z, p.heading, p.speed, p.slideX, p.slideZ]);
      assert.ok(striker.speed < 25 && struck.speed > 15, `${striker.id} contra ${struck.id}`);
      expected ??= result;
      // El orden dentro de la parrilla puede cambiar el último decimal, no el resultado.
      result.flat().forEach((value, k) => assert.ok(Math.abs(value - expected.flat()[k]) < 1e-5, `${striker.id} contra ${struck.id}`));
      models.add(`${striker.carModelId}-${struck.carModelId}`);
    }
  }
  assert.ok(models.size >= CONFIG.cars.models.length ** 2 - 1);
});

test('dos rivales IA que se tocan conduciendo solos reaccionan con las mismas reglas (RF-032)', () => {
  const race = startedRace();
  const [first, second] = race.participants.filter((p) => !p.isPlayer);
  parkOthers(race, [first, second]);
  place(race, first, poseAt(race.track, -40), 23);
  place(race, second, poseAt(race.track, -40 + CAR.length + 0.2), 5);
  stepRace(race, { player: NONE, ...Object.fromEntries(race.participants.filter((p) => p !== first && p !== second).map((p) => [p.id, NONE])) }, DT, CONFIG);
  assert.ok(first.speed < 12, `golpea: ${first.speed}`);
  assert.ok(second.speed > 15, `golpeado: ${second.speed}`);
  assert.equal(carsOverlap(first, second, CAR), false);
});

test('diez coches amontonados contra el muro con órdenes al azar: nunca se solapan, ni entran en el muro, y siguen siendo diez (RF-016)', () => {
  for (const [seed, trackId] of [[1, 'llanura'], [2, 'ribera'], [3, 'sierra'], [4, 'abismo']]) {
    const race = startedRace(trackId);
    const random = createSeededRandom(seed);
    const { bounds } = race.scenery;
    // Dos filas de cinco junto al muro sur, unos de cara a otros y al muro.
    race.participants.forEach((p, i) => {
      place(race, p, {
        x: (bounds.minX + bounds.maxX) / 2 + (i % 5) * 2.4,
        z: bounds.minZ + 3 + Math.floor(i / 5) * 5,
        heading: Math.floor(i / 5) === 0 ? 0 : Math.PI,
      });
    });
    const inputs = {};
    for (let i = 0; i < 900; i++) {
      if (i % 20 === 0) {
        for (const p of race.participants) {
          inputs[p.id] = { accelerate: random() < 0.7, brake: random() < 0.2, left: random() < 0.3, right: random() < 0.3 };
        }
      }
      stepRace(race, inputs, random() < 0.5 ? DT : P.maxStep, CONFIG);
      assertNoOverlap(race.participants, `${trackId}, paso ${i}`);
      for (const p of race.participants) {
        assert.equal(touchesScenery(p, CAR, race.scenery), false, `${trackId}, paso ${i}: ${p.name} dentro de un objeto`);
        assert.ok(Math.abs(p.speed) <= P.maxSpeed && Number.isFinite(p.x + p.z + p.heading));
      }
    }
    assert.equal(race.participants.length, 10);
    assert.equal(new Set(race.participants.map((p) => p.id)).size, 10);
    assert.equal(new Set(race.standings).size, 10);
  }
});

test('un coche que ya ha terminado y rueda por inercia sigue siendo sólido y conserva su resultado (RF-025, RF-027)', () => {
  const race = startedRace();
  const [done, other] = race.participants;
  parkOthers(race, [done, other]);
  place(race, done, { x: 0, z: CAR.length + 0.2, heading: 0 }, 5);
  place(race, other, { x: 0, z: 0, heading: 0 }, 22);
  Object.assign(done, { finished: true, finishTime: 12.5 });
  const progress = done.progress;
  for (let i = 0; i < 60; i++) {
    step(race, { [other.id]: GAS });
    assert.equal(carsOverlap(done, other, CAR), false);
    assert.ok(other.z < done.z, 'no lo atraviesa');
  }
  assert.ok(done.z > CAR.length + 5, 'ha recibido el empujón');
  assert.equal(done.finishTime, 12.5);
  assert.equal(done.progress, progress);
  assert.equal(race.participants.length, 10);
});

// Un empujón solo cambia la velocidad y el rumbo: el progreso sigue saliendo del recorrido real del coche,
// con las reglas de siempre (RN-01). Lo que recorre empujado, hacia delante, sobre la calzada y en orden,
// cuenta como lo conducido (decisión de producto en #83); hacia atrás o saltando checkpoints, no.

/** `striker` embiste a `speed` a `struck`, parado, desde detrás en la dirección `heading`. */
function ram(race, striker, struck, pose, speed = P.maxSpeed, seconds = 1.5) {
  const forward = { x: Math.sin(pose.heading), z: Math.cos(pose.heading) };
  const behind = CAR.length + 0.2;
  place(race, struck, pose);
  place(race, striker, { ...pose, x: pose.x - forward.x * behind, z: pose.z - forward.z * behind }, speed);
  let furthest = struck.progress.progress;
  for (let i = 0; i < seconds * 60; i++) {
    step(race, { [striker.id]: GAS });
    furthest = Math.max(furthest, struck.progress.progress);
  }
  return furthest;
}

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: un empujón fuera de la calzada no suma progreso, ni marcha atrás por la meta suma vueltas (RN-01)`, () => {
    const race = startedRace(definition.id, 3);
    const [striker, struck] = race.participants;
    parkOthers(race, [striker, struck]);
    const outside = poseAt(race.track, 20, -(race.track.width / 2 + 12));
    place(race, struck, outside);
    const before = struck.progress.progress;
    assert.equal(ram(race, striker, struck, outside), before, 'fuera no se suma');
    assert.ok(Math.hypot(struck.x - outside.x, struck.z - outside.z) > 3, 'ha sido empujado');

    // Empujado hacia atrás sobre la meta: ni vueltas ni progreso.
    const backwards = poseAt(race.track, 3);
    backwards.heading += Math.PI;
    place(race, struck, backwards);
    const behind = struck.progress.progress;
    assert.equal(ram(race, striker, struck, backwards), behind);
    assert.equal(struck.progress.laps, 0);
  });

  test(`${definition.id}: un empujón sobre la meta o un checkpoint sin haber pasado por los anteriores no cuenta (RN-01)`, () => {
    const race = startedRace(definition.id, 3);
    const [striker, struck] = race.participants;
    parkOthers(race, [striker, struck]);
    // Vuelta empezada y ningún checkpoint cruzado: empujado sobre la meta no hay vuelta.
    const atFinish = poseAt(race.track, -3);
    place(race, struck, atFinish);
    struck.progress = { ...struck.progress, started: true };
    const before = struck.progress.progress;
    ram(race, striker, struck, atFinish);
    assert.ok(struck.progress.lapPosition > 0, 'ha cruzado la meta');
    // El progreso sigue al recorrido real sobre la calzada, nunca por delante de donde está el coche.
    assert.ok(struck.progress.progress >= before && struck.progress.progress <= struck.progress.lapPosition + 1e-9);
    assert.equal(struck.progress.laps, 0);
    assert.equal(struck.progress.checkpointIndex, 0);

    // Empujado sobre el segundo checkpoint sin el primero: se ignora y el progreso no salta hasta él.
    const second = race.track.checkpoints[1].distance;
    const atGate = poseAt(race.track, second - 3);
    place(race, struck, poseAt(race.track, 2));
    struck.progress = { ...struck.progress, started: true };
    const lapDistance = struck.progress.lapDistance;
    Object.assign(struck, atGate, { speed: 0, progress: { ...struck.progress, x: atGate.x, z: atGate.z, lapPosition: second - 3 } });
    const forward = { x: Math.sin(atGate.heading), z: Math.cos(atGate.heading) };
    place(race, striker, { ...atGate, x: atGate.x - forward.x * (CAR.length + 0.2), z: atGate.z - forward.z * (CAR.length + 0.2) }, P.maxSpeed);
    for (let i = 0; i < 60; i++) step(race, { [striker.id]: GAS });
    assert.ok(struck.progress.lapPosition > second, 'ha pasado la puerta');
    assert.equal(struck.progress.checkpointIndex, 0);
    assert.equal(struck.progress.lapDistance, lapDistance);
  });

  test(`${definition.id}: un coche empujado hacia atrás en la calzada no suma progreso ni vueltas (RN-01)`, () => {
    const race = startedRace(definition.id, 3);
    const [striker, struck] = race.participants;
    parkOthers(race, [striker, struck]);
    // Mira en el sentido de la carrera y le embisten de frente: retrocede.
    const pose = poseAt(race.track, 40);
    place(race, struck, pose);
    struck.progress = { ...struck.progress, started: true };
    const before = struck.progress;
    place(race, striker, { ...poseAt(race.track, 40 + CAR.length + 0.2), heading: pose.heading + Math.PI }, P.maxSpeed);
    for (let i = 0; i < 90; i++) {
      step(race, { [striker.id]: GAS });
      assert.equal(struck.progress.progress, before.progress, `paso ${i}`);
    }
    assert.ok(struck.progress.lapPosition < before.lapPosition - 3, `ha retrocedido: ${struck.progress.lapPosition}`);
    assert.equal(struck.progress.laps, 0);
    assert.equal(struck.progress.checkpointIndex, 0);
  });

  test(`${definition.id}: el avance real por un empujón cuenta para la clasificación (RF-012, RF-023)`, () => {
    const race = startedRace(definition.id, 3);
    const [striker, struck, ahead] = race.participants;
    parkOthers(race, [striker, struck, ahead]);
    // `ahead`, parado a un lado, va unos metros por delante del golpeado.
    place(race, ahead, poseAt(race.track, 26, 3.5));
    ahead.progress = { ...ahead.progress, started: true };
    const pose = poseAt(race.track, 20, -1);
    place(race, struck, pose);
    struck.progress = { ...struck.progress, started: true };
    step(race);
    const position = (p) => race.standings.indexOf(p.id);
    assert.ok(position(struck) > position(ahead), 'empieza por detrás');
    const before = struck.progress.progress;

    place(race, striker, poseAt(race.track, 20 - CAR.length - 0.2, -1), FIRM_PUSH);
    for (let i = 0; i < 90; i++) step(race);
    assert.ok(struck.progress.progress > before + 6, `${struck.progress.progress}`);
    assert.ok(struck.progress.progress <= struck.progress.lapPosition + 1e-9, 'nunca por delante del coche');
    assert.ok(position(struck) < position(ahead), 'le ha ganado la posición');
  });

  test(`${definition.id}: un empujón sobre la meta completa la vuelta solo con todos los checkpoints (RN-01, RF-023)`, () => {
    for (const missing of [0, 1]) {
      const race = startedRace(definition.id, 1);
      const [striker, struck] = [race.participants.find((p) => !p.isPlayer), race.player];
      parkOthers(race, [striker, struck]);
      const { checkpoints, length } = race.track;
      const pose = poseAt(race.track, -3);
      place(race, struck, pose);
      // Última vuelta a 3 m de la meta; con `missing`, sin haber cruzado el último checkpoint.
      const checkpointIndex = checkpoints.length - missing;
      const reached = missing ? checkpoints[checkpointIndex].distance - 1 : length - 3;
      struck.progress = {
        ...struck.progress, started: true, checkpointIndex, lapPosition: length - 3, lapDistance: reached, progress: reached,
      };
      const forward = { x: Math.sin(pose.heading), z: Math.cos(pose.heading) };
      const gap = CAR.length + 0.2;
      place(race, striker, { ...pose, x: pose.x - forward.x * gap, z: pose.z - forward.z * gap }, FIRM_PUSH);
      for (let i = 0; i < 60; i++) step(race);
      assert.ok(Math.hypot(struck.x - pose.x, struck.z - pose.z) > 3, 'ha sido empujado sobre la meta');
      if (missing) {
        assert.equal(struck.progress.laps, 0);
        assert.equal(struck.progress.progress, reached);
        assert.equal(struck.finished, false);
        assert.equal(race.winner, null);
      } else {
        assert.equal(struck.progress.laps, 1);
        assert.equal(struck.finished, true);
        assert.equal(race.winner.id, struck.id);
        assert.equal(race.standings[0], struck.id);
      }
    }
  });

  test(`${definition.id}: una carrera completa con semilla, con contactos, termina y la clasificación es coherente`, () => {
    for (const seed of [7, 8]) {
      const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId: definition.id, laps: 3 }, createSeededRandom(seed));
      const rivals = race.participants.filter((p) => !p.isPlayer);
      let steps = 0;
      let bumps = 0;
      // El jugador no toca los controles: es un coche parado en la calzada al que los rivales deben superar.
      while (rivals.some((p) => !p.finished) && steps++ < 60 * 600) {
        const speeds = rivals.map((p) => p.speed);
        stepRace(race, {}, DT, CONFIG);
        rivals.forEach((p, i) => { if (!p.finished && speeds[i] - p.speed > 1) bumps++; });
        if (steps % 10 === 0) assertNoOverlap(race.participants, `${definition.id}, semilla ${seed}, paso ${steps}`);
      }
      assert.ok(bumps > 0, 'ha habido contactos');
      assert.ok(rivals.every((p) => p.finished && p.progress.laps === 3), `semilla ${seed}: todos terminan`);
      assert.equal(race.participants.length, 10);
      assert.equal(new Set(race.standings).size, 10);
      assert.deepEqual(race.standings, rankParticipants(race.participants).map((p) => p.id));
      const times = race.standings.slice(0, rivals.length).map((id) => race.participants.find((p) => p.id === id).finishTime);
      assert.deepEqual(times, [...times].sort((a, b) => a - b));
      assert.equal(race.winner.id, race.standings[0]);
    }
  });
}

test('dos rivales IA encarados y uno parado delante de otro no se quedan bloqueados para siempre', () => {
  const race = startedRace('abismo');
  const [first, second] = race.participants.filter((p) => !p.isPlayer);
  const scenery = race.scenery;
  parkOthers(race, [first, second]);
  race.scenery = scenery;
  const others = Object.fromEntries(race.participants.filter((p) => p !== first && p !== second).map((p) => [p.id, NONE]));
  const facing = poseAt(race.track, 30);
  facing.heading += Math.PI;
  place(race, first, poseAt(race.track, 30 - CAR.length - 0.1));
  place(race, second, facing);
  const from = [first, second].map((p) => p.progress.lapPosition);
  for (let i = 0; i < 60 * 30; i++) stepRace(race, others, DT, CONFIG);
  [first, second].forEach((p, i) => assert.ok(p.progress.lapPosition > from[i] + 60, `${p.name}: ${p.progress.lapPosition}`));
});

test('un rival rebasa una hilera de coches parados que no puede empujar', () => {
  const race = startedRace('abismo');
  const [rival, ...rest] = race.participants.filter((p) => !p.isPlayer);
  const row = rest.slice(0, 4);
  const scenery = race.scenery;
  parkOthers(race, [rival, ...row]);
  race.scenery = scenery;
  row.forEach((p, i) => place(race, p, poseAt(race.track, 30 + i * (CAR.length + 0.05))));
  place(race, rival, poseAt(race.track, 10));
  const others = Object.fromEntries(race.participants.filter((p) => p !== rival).map((p) => [p.id, NONE]));
  for (let i = 0; i < 60 * 40; i++) stepRace(race, others, DT, CONFIG);
  assert.ok(rival.progress.lapPosition > 30 + row.length * (CAR.length + 0.05) + 20, `${rival.progress.lapPosition}`);
});

test('con un solo coche en la carrera no hay contactos', () => {
  const race = createRace(CONFIG);
  while (!stepRace(race, { player: NONE }, DT, CONFIG).started);
  for (let i = 0; i < 60; i++) stepRace(race, { player: i < 30 ? GAS : BRAKE }, DT, CONFIG);
  assert.equal(race.player.slideX, 0);
});
