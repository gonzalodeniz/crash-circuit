// Destrucción por golpe fuerte y bloqueo posterior (RF-035, RF-036, RF-038, RF-041 parcial, RN-04).
// La reaparición, al acabar el bloqueo, se prueba en `respawn.test.js`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { createWreck, stepWreck } from '../src/logic/destruction.js';
import { createCarState } from '../src/logic/driving.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { createProgress } from '../src/logic/progress.js';
import { ParticipantStatus, raceTimeOf, stepRace } from '../src/logic/race.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createSeededRandom } from '../src/logic/random.js';
import { positionOf } from '../src/logic/standings.js';
import { pointAtDistance } from '../src/logic/track.js';

const P = CONFIG.carPerformance;
const CAR = CONFIG.race.car;
const STRONG_SPEED = CONFIG.impact.strongSpeed;
const LOCK = CONFIG.destruction.lockDuration;
const { DESTRUIDO, EN_CARRERA } = ParticipantStatus;
const DT = 1 / 60;
const NONE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { accelerate: true, brake: false, left: true, right: false };
// El terreno de las pruebas no está sobre la calzada: se amplía su margen para que la penalización de la
// salida de pista no altere las velocidades.
const ASPHALT = Object.freeze({ ...CONFIG, offRoad: { ...CONFIG.offRoad, margin: 1e6 } });
const OPEN = Object.freeze({ bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000 }, obstacles: [] });
const WALL = Object.freeze({ bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 20 }, obstacles: [] });
const ROCK = Object.freeze({ bounds: OPEN.bounds, obstacles: [{ type: 'rock', x: 0, z: 20, radius: 1.6 }] });

const playerIndex = CONFIG.grid.playerSlotIndex;
const rivalIndex = playerIndex === 0 ? 1 : 0;

const held = (race) => Object.fromEntries(race.participants.map((p) => [p.id, NONE]));

/** Un paso en el que solo actúa lo indicado en `inputs`. */
const step = (race, inputs = {}, config = ASPHALT, dt = DT) => stepRace(race, { ...held(race), ...inputs }, dt, config);

function place(race, participant, pose, speed = 0) {
  Object.assign(participant, createCarState(pose), { speed, surfaceSample: null, progress: createProgress(race.track, pose) });
}

/** Carrera de diez con la señal de salida ya dada, en terreno abierto y con todos apartados y quietos. */
function openRace(scenery = OPEN, config = ASPHALT) {
  const race = createRaceFromSetup(config, { carModelId: 'rayo', trackId: 'llanura', laps: 3 }, createSeededRandom(1));
  while (!stepRace(race, held(race), DT, config).started);
  race.scenery = scenery;
  race.participants.forEach((p, i) => place(race, p, { x: 1000 + i * 10, z: -1000, heading: 0 }));
  return race;
}

/** El participante `index` se estrella de frente contra el escenario con una velocidad de impacto de `speed`. */
function hitScenery(scenery, speed, index = playerIndex, config = ASPHALT) {
  const race = openRace(scenery, config);
  const car = race.participants[index];
  const front = scenery.obstacles[0] ? scenery.obstacles[0].z - scenery.obstacles[0].radius : scenery.bounds.maxZ;
  place(race, car, { x: 0, z: front - CAR.length / 2 - 0.1, heading: 0 }, speed + P.coastDeceleration * DT);
  step(race, {}, config);
  // El choque se monta lejos de la calzada: se le da el avance válido de un coche que aún no ha pasado la
  // meta, para que al acabar el bloqueo tenga dónde reaparecer.
  car.progress = createProgress(race.track, pointAtDistance(race.track, -20));
  return { race, car };
}

/** `striker` embiste por detrás a `struck`, parado, con una velocidad de impacto de `speed` m/s. */
function crash(striker, struck, speed, race = openRace()) {
  const a = race.participants[striker];
  const b = race.participants[struck];
  place(race, a, { x: 0, z: 0, heading: 0 }, speed + P.coastDeceleration * DT);
  place(race, b, { x: 0, z: CAR.length + 0.02, heading: 0 });
  step(race);
  return { race, a, b };
}

function assertTenUnique(race) {
  assert.equal(race.participants.length, 10);
  assert.equal(new Set(race.participants.map((p) => p.id)).size, 10);
  assert.equal(race.standings.length, 10);
  assert.equal(new Set(race.standings).size, 10);
}

/** Pasos de simulación hasta que el bloqueo del coche termina y deja de estar destruido. */
function stepsToRelease(race, car, config = ASPHALT, dt = DT) {
  let steps = 0;
  while (car.status === DESTRUIDO && steps < 100000) {
    step(race, {}, config, dt);
    steps++;
  }
  return steps;
}

test('el bloqueo dura tres segundos y está en la configuración, congelado (RF-038)', () => {
  assert.equal(LOCK, 3);
  assert.ok(Object.isFrozen(CONFIG.destruction));
  for (const model of CONFIG.cars.models) assert.equal(model.destruction, undefined);
});

test('el temporizador solo avanza con el tiempo que recibe y termina en el tiempo configurado', () => {
  const wreck = createWreck(CONFIG.destruction);
  assert.deepEqual(wreck, { timeLeft: LOCK, readyToRespawn: false });
  assert.equal(stepWreck(wreck, 0), wreck, 'sin tiempo de simulación no avanza');
  assert.equal(stepWreck(wreck, -1), wreck);
  const half = stepWreck(wreck, LOCK / 2);
  assert.deepEqual(half, { timeLeft: LOCK / 2, readyToRespawn: false });
  assert.equal(wreck.timeLeft, LOCK, 'no se modifica el anterior');
  const done = stepWreck(half, LOCK);
  assert.deepEqual(done, { timeLeft: 0, readyToRespawn: true });
  assert.equal(stepWreck(done, 1), done);
});

for (const [name, scenery] of [['el límite', WALL], ['un obstáculo', ROCK]]) {
  test(`contra ${name}: por encima del umbral destruye y por debajo no (RF-035, RF-036)`, () => {
    const light = hitScenery(scenery, STRONG_SPEED - 0.5).car;
    assert.equal(light.status, EN_CARRERA);
    assert.equal(light.wreck, null);
    const strong = hitScenery(scenery, STRONG_SPEED + 0.5).car;
    assert.equal(strong.status, DESTRUIDO);
    assert.deepEqual(strong.wreck, createWreck(CONFIG.destruction));
    assert.deepEqual([strong.speed, strong.slideX, strong.slideZ], [0, 0, 0], 'se queda donde ha chocado');
  });
}

test('el choque entre coches sigue la misma secuencia que contra un obstáculo, y destruye a los dos (RF-036)', () => {
  const against = hitScenery(ROCK, STRONG_SPEED + 2).car;
  const { race, a, b } = crash(playerIndex, rivalIndex, STRONG_SPEED + 2);
  for (const car of [a, b]) {
    assert.equal(car.status, DESTRUIDO, car.id);
    assert.deepEqual(car.wreck, against.wreck);
    assert.deepEqual([car.speed, car.slideX, car.slideZ], [0, 0, 0]);
  }
  assert.equal(race.participants.filter((p) => p.status === DESTRUIDO).length, 2);

  const soft = crash(playerIndex, rivalIndex, STRONG_SPEED - 2);
  for (const car of [soft.a, soft.b]) assert.equal(car.status, EN_CARRERA, car.id);
});

test('el umbral y la duración se leen de la configuración', () => {
  const config = { ...ASPHALT, impact: { ...CONFIG.impact, strongSpeed: 10 }, destruction: { lockDuration: 1 } };
  const { race, car } = hitScenery(WALL, 12, playerIndex, config);
  assert.equal(car.status, DESTRUIDO);
  assert.equal(car.wreck.timeLeft, 1);
  assert.equal(stepsToRelease(race, car, config), Math.round(1 / DT));
});

test('el jugador destruido no responde a las flechas durante el bloqueo (RF-038)', () => {
  const { race, car } = hitScenery(WALL, STRONG_SPEED + 5);
  const pose = [car.x, car.z, car.heading];
  for (let i = 0; i < Math.round(LOCK / DT) - 1; i++) {
    const input = i % 2 === 0 ? GAS : { accelerate: false, brake: true, left: false, right: true };
    step(race, { [car.id]: input });
    assert.deepEqual([car.x, car.z, car.heading, car.speed, car.steer], [...pose, 0, 0], `paso ${i}`);
    assert.equal(car.status, DESTRUIDO);
  }
});

test('un rival destruido sigue las mismas reglas y su piloto IA deja de conducir (RF-038, RF-041)', () => {
  const { race, car } = hitScenery(ROCK, STRONG_SPEED + 5, rivalIndex);
  assert.equal(car.status, DESTRUIDO);
  const pose = [car.x, car.z, car.heading];
  const memory = race.recoveries[car.id];
  const inputs = held(race);
  delete inputs[car.id]; // sin entrada propia, conduciría su piloto
  for (let i = 0; i < Math.round(LOCK / DT) - 1; i++) stepRace(race, inputs, DT, ASPHALT);
  assert.deepEqual([car.x, car.z, car.heading, car.speed], [...pose, 0]);
  assert.equal(race.recoveries[car.id], memory, 'el piloto no ha producido entradas');
  assert.equal(car.status, DESTRUIDO);
});

test('el bloqueo termina a los tres segundos de simulación, no antes, a cualquier ritmo de fotogramas', () => {
  for (const dt of [1 / 144, DT, P.maxStep]) {
    const { race, car } = hitScenery(WALL, STRONG_SPEED + 5);
    const steps = stepsToRelease(race, car, ASPHALT, dt);
    assert.ok(Math.abs(steps - LOCK / dt) < 1 + 1e-6, `${steps} pasos de ${dt}`);
    assert.ok(steps * dt >= LOCK - 1e-6, 'no antes de tiempo');
    assert.equal(car.wreck, null);
  }
});

test('si la simulación no avanza el temporizador tampoco, y un salto de reloj no lo acorta (RF-038)', () => {
  const { race, car } = hitScenery(WALL, STRONG_SPEED + 5);
  for (let i = 0; i < 1000; i++) step(race, {}, ASPHALT, 0);
  assert.equal(car.wreck.timeLeft, LOCK);
  step(race, {}, ASPHALT, 60); // un parón del navegador: la simulación solo avanza el paso máximo
  assert.ok(Math.abs(car.wreck.timeLeft - (LOCK - P.maxStep)) < 1e-9);
});

test('con la partida en pausa el temporizador no avanza (RF-038, CA-06 parcial)', () => {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(1) });
  machine.openSelection();
  for (let i = 0; i < 3; i++) session.confirmSelection();
  while (machine.state !== GameState.EN_CARRERA) session.step(DT, {});
  const { race } = session;
  const { player } = race;
  // De frente contra el límite este, a velocidad máxima.
  place(race, player, { x: race.scenery.bounds.maxX - CAR.length / 2 - 0.1, z: 0, heading: Math.PI / 2 }, P.maxSpeed);
  session.step(DT, {});
  assert.equal(player.status, DESTRUIDO);
  session.step(DT, {});
  const left = player.wreck.timeLeft;
  assert.ok(left < LOCK);
  machine.transitionTo(GameState.PAUSA);
  for (let i = 0; i < 600; i++) session.step(DT, {});
  assert.equal(player.wreck.timeLeft, left);
  machine.transitionTo(GameState.EN_CARRERA);
  session.step(DT, {});
  assert.ok(player.wreck.timeLeft < left);
});

test('destruido conserva vueltas, checkpoints y distancia, no suma nada y el cronómetro sigue (RN-01, RN-04)', () => {
  const race = openRace();
  const { player } = race;
  const gate = race.track.checkpoints[1].distance;
  // Estrellado contra un muro invisible justo antes del segundo checkpoint, ya sobre el trazado.
  const pose = pointAtDistance(race.track, gate - CAR.length);
  place(race, player, pose, P.maxSpeed);
  player.progress = {
    ...player.progress, started: true, laps: 1, checkpointIndex: 1, lapDistance: gate - CAR.length, progress: race.track.length + gate - CAR.length,
  };
  const ahead = { x: pose.x + Math.sin(pose.heading) * (CAR.length / 2 + 1.2), z: pose.z + Math.cos(pose.heading) * (CAR.length / 2 + 1.2) };
  race.scenery = { bounds: OPEN.bounds, obstacles: [{ type: 'rock', ...ahead, radius: 1 }] };
  for (let i = 0; i < 20 && player.status !== DESTRUIDO; i++) step(race, {});
  assert.equal(player.status, DESTRUIDO);

  const progress = player.progress;
  assert.equal(progress.laps, 1);
  assert.equal(progress.checkpointIndex, 1);
  const time = raceTimeOf(race, player);
  const waited = Math.round(LOCK / DT) - 1;
  for (let i = 0; i < waited; i++) step(race, { [player.id]: GAS });
  assert.equal(player.status, DESTRUIDO);
  assert.equal(player.progress, progress);
  assert.equal(player.finished, false);
  assert.ok(Math.abs(raceTimeOf(race, player) - time - waited * DT) < 1e-6, 'el cronómetro sigue corriendo');
});

test('no es un abandono: sigue en la clasificación y los demás lo adelantan por progreso válido (RN-02, RN-04)', () => {
  const race = openRace();
  const { player } = race;
  const other = race.participants[rivalIndex];
  place(race, other, pointAtDistance(race.track, 2));
  place(race, player, pointAtDistance(race.track, 30));
  player.progress = { ...player.progress, started: true };
  other.progress = { ...other.progress, started: true };
  step(race);
  assert.ok(positionOf(race, player.id) < positionOf(race, other.id), 'empieza por delante');
  assertTenUnique(race);

  // El jugador se estrella donde está.
  const pose = pointAtDistance(race.track, 30);
  const ahead = { x: pose.x + Math.sin(pose.heading) * (CAR.length / 2 + 1.1), z: pose.z + Math.cos(pose.heading) * (CAR.length / 2 + 1.1) };
  race.scenery = { bounds: OPEN.bounds, obstacles: [{ type: 'rock', ...ahead, radius: 1 }] };
  player.speed = P.maxSpeed;
  step(race);
  assert.equal(player.status, DESTRUIDO);
  assertTenUnique(race);

  // El rival conduce solo, lo adelanta y pasa a ir por delante en la clasificación.
  race.scenery = OPEN;
  const inputs = held(race);
  delete inputs[other.id];
  for (let i = 0; i < Math.round(LOCK / DT) - 1; i++) {
    stepRace(race, inputs, DT, ASPHALT);
    assertTenUnique(race);
  }
  assert.ok(other.progress.progress > player.progress.progress);
  assert.ok(positionOf(race, other.id) < positionOf(race, player.id));
  assert.equal(player.status, DESTRUIDO);
});

test('los restos no son sólidos: otro coche los atraviesa sin golpe ni daño durante el bloqueo', () => {
  const { race, car } = hitScenery(WALL, STRONG_SPEED + 5);
  race.scenery = OPEN;
  const pose = [car.x, car.z];
  const other = race.participants[rivalIndex];
  place(race, other, { x: car.x, z: car.z - 12, heading: 0 }, P.maxSpeed);
  for (let i = 0; i < 60; i++) step(race, { [other.id]: { ...NONE, accelerate: true } });
  assert.ok(other.z > car.z + CAR.length, 'ha pasado');
  assert.equal(other.status, EN_CARRERA);
  assert.equal(other.damage.worst, null);
  assert.deepEqual([car.x, car.z], pose);
});

test('quien ya había terminado y se destruye conserva su llegada y su tiempo (RF-027)', () => {
  const race = openRace(WALL);
  const car = race.participants[rivalIndex];
  place(race, car, { x: 0, z: 20 - CAR.length / 2 - 0.1, heading: 0 }, P.maxSpeed);
  Object.assign(car, { finished: true, finishTime: 12.5 });
  const { progress } = car;
  step(race);
  assert.equal(car.status, DESTRUIDO);
  for (let i = 0; i < 60; i++) step(race);
  assert.equal(car.finished, true);
  assert.equal(car.finishTime, 12.5);
  assert.equal(car.progress, progress);
});

test('las mismas reglas para los diez participantes, con cualquier modelo de coche (RF-041 parcial, RN-07)', () => {
  const outcome = (car) => [car.status, car.wreck, car.x, car.z, car.speed, car.damage];
  const expected = outcome(hitScenery(ROCK, STRONG_SPEED + 3, 0).car);
  assert.equal(expected[0], DESTRUIDO);
  const models = new Set();
  for (let index = 0; index < CONFIG.race.maxParticipants; index++) {
    const { race, car } = hitScenery(ROCK, STRONG_SPEED + 3, index);
    assert.deepEqual(outcome(car), expected, car.id);
    assert.equal(stepsToRelease(race, car), Math.round(LOCK / DT), car.id);
    assertTenUnique(race);
    models.add(car.carModelId);
  }
  assert.equal(models.size, CONFIG.cars.models.length);
});

test('al repetir la carrera nadie sale destruido', () => {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(1) });
  machine.openSelection();
  for (let i = 0; i < 3; i++) session.confirmSelection();
  while (machine.state !== GameState.EN_CARRERA) session.step(DT, {});
  Object.assign(session.race.player, { status: DESTRUIDO, wreck: createWreck(CONFIG.destruction) });
  machine.finishRace();
  machine.repeatRace();
  for (const p of session.race.participants) {
    assert.equal(p.status, ParticipantStatus.PARRILLA, p.id);
    assert.equal(p.wreck, null);
  }
});
