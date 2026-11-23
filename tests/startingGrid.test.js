import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { carModels } from '../src/logic/carModels.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { lapOptions } from '../src/logic/lapOptions.js';
import { ParticipantStatus, stepRace } from '../src/logic/race.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { aiDrivers, createGridEntries } from '../src/logic/startingGrid.js';
import { forwardOf, isOnRoad, rightOf, signedDistance, nearestOnCenterline } from '../src/logic/track.js';
import { trackDefinitions } from '../src/logic/trackCatalog.js';

const DT = 1 / 60;
const IDLE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { ...IDLE, accelerate: true };
const SETUP = { carModelId: 'rayo', trackId: 'ribera', laps: 1 };
const everySetup = () => carModels(CONFIG).flatMap((model) => trackDefinitions(CONFIG).flatMap((definition) =>
  lapOptions(CONFIG).map((laps) => ({ carModelId: model.id, trackId: definition.id, laps }))));

/** Esquinas de la huella real del coche (rectángulo largo × ancho orientado según su rumbo). */
function corners(pose, car) {
  const forward = forwardOf(pose.heading);
  const right = rightOf(pose.heading);
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([f, r]) => ({
    x: pose.x + forward.x * f * car.length / 2 + right.x * r * car.width / 2,
    z: pose.z + forward.z * f * car.length / 2 + right.z * r * car.width / 2,
  }));
}

/** Dos rectángulos convexos se solapan si ningún eje de sus lados los separa (teorema del eje separador). */
function overlap(a, b) {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      const q = polygon[(i + 1) % polygon.length];
      const axis = { x: q.z - p.z, z: p.x - q.x };
      const project = (points) => points.map((point) => point.x * axis.x + point.z * axis.z);
      const [pa, pb] = [project(a), project(b)];
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

test('cada carrera tiene exactamente diez participantes con identificadores únicos: el jugador y nueve pilotos IA (RF-016)', () => {
  for (const setup of everySetup()) {
    const { participants } = createRaceFromSetup(CONFIG, setup);
    assert.equal(participants.length, 10);
    assert.equal(new Set(participants.map((p) => p.id)).size, 10);
    assert.equal(participants.filter((p) => p.isPlayer).length, 1);
    assert.equal(participants.filter((p) => !p.isPlayer).length, 9);
    assert.deepEqual(participants.map((p) => p.gridIndex), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
});

test('los nueve nombres de los rivales son fijos: los mismos en todas las carreras y combinaciones (RF-017)', () => {
  const expected = aiDrivers(CONFIG).map((driver) => driver.name);
  assert.equal(expected.length, 9);
  assert.equal(new Set(expected).size, 9);
  assert.ok(expected.every((name) => typeof name === 'string' && name.trim() !== ''));
  for (const setup of everySetup()) {
    const rivals = createRaceFromSetup(CONFIG, setup).participants.filter((p) => !p.isPlayer);
    assert.deepEqual(rivals.map((p) => p.name), expected);
    assert.deepEqual(rivals.map((p) => p.id), aiDrivers(CONFIG).map((driver) => driver.id));
  }
});

test('cada rival usa un modelo del catálogo y nunca un quinto modelo (RF-018)', () => {
  const catalog = new Set(carModels(CONFIG).map((model) => model.id));
  assert.equal(catalog.size, 4);
  for (const driver of aiDrivers(CONFIG)) assert.ok(catalog.has(driver.carModelId), driver.name);
  for (const setup of everySetup()) {
    const { participants } = createRaceFromSetup(CONFIG, setup);
    assert.ok(participants.every((p) => catalog.has(p.carModelId)));
    assert.equal(participants.find((p) => p.isPlayer).carModelId, setup.carModelId);
  }
  // El reparto es variado: se ven los cuatro modelos entre los rivales.
  assert.equal(new Set(aiDrivers(CONFIG).map((driver) => driver.carModelId)).size, 4);
});

test('los diez comparten el rendimiento: con las mismas órdenes aceleran igual, sea cual sea su modelo (RF-003, RN-07)', () => {
  const race = createRaceFromSetup(CONFIG, SETUP);
  const all = Object.fromEntries(race.participants.map((p) => [p.id, GAS]));
  const total = CONFIG.race.countdown.steps * CONFIG.race.countdown.stepDuration;
  for (let t = 0; t < (total + 1) / DT + 2; t++) stepRace(race, all, DT, CONFIG);
  const speeds = race.participants.map((p) => p.speed);
  assert.ok(speeds[0] > 5, 'han acelerado');
  assert.ok(speeds.every((speed) => speed === speeds[0]), `velocidades distintas: ${speeds}`);
  for (const participant of race.participants) {
    assert.equal(Object.keys(participant).some((key) => /maxSpeed|acceleration|steerRate/.test(key)), false);
  }
});

test('el hueco del jugador sale de la configuración y los rivales ocupan los demás en su orden (RF-019)', () => {
  assert.equal(CONFIG.grid.playerSlotIndex, 9, 'propuesta: el jugador sale el último');
  assert.equal(createRaceFromSetup(CONFIG, SETUP).player.gridIndex, CONFIG.grid.playerSlotIndex);
  for (const slot of [0, 3, 9]) {
    const config = { ...CONFIG, grid: { ...CONFIG.grid, playerSlotIndex: slot } };
    const race = createRaceFromSetup(config, SETUP);
    assert.equal(race.player.gridIndex, slot);
    assert.deepEqual(
      race.participants.filter((p) => !p.isPlayer).map((p) => p.id),
      aiDrivers(CONFIG).map((driver) => driver.id),
    );
  }
});

test('una configuración con otro número de rivales, un hueco imposible o un quinto modelo no crea la parrilla', () => {
  const withRaceConfig = (patch) => ({ ...CONFIG, race: { ...CONFIG.race, ...patch } });
  assert.throws(() => createGridEntries(withRaceConfig({ aiDrivers: aiDrivers(CONFIG).slice(1) }), 'rayo'), /9 pilotos IA/);
  assert.throws(() => createGridEntries({ ...CONFIG, grid: { ...CONFIG.grid, playerSlotIndex: 10 } }, 'rayo'), /fuera de rango/);
  assert.throws(() => createGridEntries({ ...CONFIG, grid: { ...CONFIG.grid, playerSlotIndex: -1 } }, 'rayo'), /fuera de rango/);
  const fifth = aiDrivers(CONFIG).map((driver, i) => (i === 0 ? { ...driver, carModelId: 'quinto' } : driver));
  assert.throws(() => createGridEntries(withRaceConfig({ aiDrivers: fifth }), 'rayo'), /Modelo de coche desconocido/);
  assert.throws(() => createGridEntries(CONFIG, 'quinto'), /Modelo de coche desconocido/);
  const repeated = aiDrivers(CONFIG).map((driver, i) => (i === 1 ? { ...driver, id: aiDrivers(CONFIG)[0].id } : driver));
  assert.throws(() => createRaceFromSetup(withRaceConfig({ aiDrivers: repeated }), SETUP), /únicos/);
});

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: los diez huecos de parrilla están en la calzada, tras la meta, mirando en el sentido de la carrera y sin solaparse (RF-019)`, () => {
    const race = createRaceFromSetup(CONFIG, { ...SETUP, trackId: definition.id });
    const { track, participants } = race;
    for (const p of participants) {
      for (const corner of corners(p, CONFIG.race.car)) {
        assert.ok(isOnRoad(track, corner.x, corner.z), `${p.name}: una esquina del coche queda fuera de la calzada`);
      }
      const { along } = nearestOnCenterline(track, p.x, p.z);
      assert.ok(signedDistance(track, along) < 0, `${p.name} no está detrás de la meta`);
      const forward = forwardOf(p.heading);
      const finish = forwardOf(track.finish.heading);
      assert.ok(forward.x * finish.x + forward.z * finish.z > 0.97, `${p.name} no mira en el sentido de la carrera`);
      assert.equal(p.speed, 0);
    }
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        assert.equal(
          overlap(corners(participants[i], CONFIG.race.car), corners(participants[j], CONFIG.race.car)),
          false,
          `${participants[i].name} y ${participants[j].name} se solapan`,
        );
      }
    }
  });
}

test('la prueba de solape detecta coches montados (control de la propia prueba)', () => {
  const car = CONFIG.race.car;
  const a = { x: 0, z: 0, heading: 0 };
  assert.equal(overlap(corners(a, car), corners({ x: 0, z: car.length - 0.1, heading: 0 }, car)), true);
  assert.equal(overlap(corners(a, car), corners({ x: car.width - 0.1, z: 0, heading: 0 }, car)), true);
  assert.equal(overlap(corners(a, car), corners({ x: 0, z: car.length + 0.1, heading: 0 }, car)), false);
});

test('los diez pasan a EN_CARRERA en el mismo paso y antes ninguno suma progreso (RF-021)', () => {
  const race = createRaceFromSetup(CONFIG, SETUP);
  const all = Object.fromEntries(race.participants.map((p) => [p.id, GAS]));
  const before = race.participants.map((p) => ({ x: p.x, z: p.z, progress: p.progress.progress }));
  let result;
  let steps = 0;
  do {
    assert.ok(race.participants.every((p) => p.status === ParticipantStatus.PARRILLA));
    result = stepRace(race, all, DT, CONFIG);
    steps++;
  } while (!result.started && steps < 60 * 10);
  assert.equal(result.started, true);
  assert.ok(race.participants.every((p) => p.status === ParticipantStatus.EN_CARRERA), 'los diez a la vez');
  // Antes de la señal nadie se ha movido ni ha sumado progreso; el sobrante del último paso es mínimo.
  race.participants.forEach((p, i) => {
    assert.ok(Math.hypot(p.x - before[i].x, p.z - before[i].z) < 0.01, p.name);
    assert.ok(Math.abs(p.progress.progress - before[i].progress) < 0.01, p.name);
  });
});

test('en la sesión, la salida cambia a los diez a la vez, los rivales esperan en la parrilla y la carrera acaba al terminar el jugador', () => {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG);
  machine.openSelection();
  session.confirmSelection();
  session.confirmSelection();
  session.confirmSelection();
  const { race } = session;
  assert.equal(machine.state, GameState.PARRILLA);
  const startPoses = race.participants.map((p) => [p.x, p.z]);
  let signal;
  let steps = 0;
  do {
    signal = session.step(DT, { player: GAS });
    steps++;
  } while (!signal.started && steps < 60 * 10);
  assert.equal(machine.state, GameState.EN_CARRERA);
  assert.ok(race.participants.every((p) => p.status === ParticipantStatus.EN_CARRERA));
  for (let i = 0; i < 120; i++) session.step(DT, { player: GAS });
  race.participants.forEach((p, i) => {
    if (p.isPlayer) assert.ok(p.speed > 0);
    else assert.deepEqual([p.x, p.z], startPoses[i], `${p.name} no conduce todavía`);
  });
});

test('repetir o empezar otra carrera monta de nuevo la parrilla con los diez participantes (RNF-04)', () => {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG);
  machine.openSelection();
  session.confirmSelection();
  session.confirmSelection();
  session.confirmSelection();
  const first = session.race;
  const firstParticipants = new Set(first.participants);
  for (let i = 0; i < 400; i++) session.step(DT, { player: GAS });
  machine.finishRace();
  machine.repeatRace();
  const second = session.race;
  assert.notEqual(second, first);
  assert.equal(second.participants.length, 10);
  assert.ok(second.participants.every((p) => !firstParticipants.has(p)), 'ningún participante de la carrera anterior');
  assert.ok(second.participants.every((p) => p.status === ParticipantStatus.PARRILLA && p.speed === 0 && p.progress.laps === 0));
  const fresh = createRaceFromSetup(CONFIG, session.confirmedSetup);
  assert.deepEqual(second.participants.map((p) => [p.x, p.z]), fresh.participants.map((p) => [p.x, p.z]));
  // Otra carrera desde los resultados: se descarta la anterior.
  for (let i = 0; i < 400; i++) session.step(DT, { player: GAS });
  machine.finishRace();
  machine.transitionTo(GameState.SELECCION);
  assert.equal(session.race, null);
});

test('el renderizado dibuja un coche por participante y libera los de la carrera anterior (RNF-04)', async () => {
  const renderer = await readFile(new URL('../src/render/sceneRenderer.js', import.meta.url), 'utf8');
  assert.match(renderer, /for \(const participant of race\.participants\) this\.#addCar\(participant, race\)/);
  assert.match(renderer, /buildRace\(race\) \{\s*this\.disposeRace\(\);/);
  assert.match(renderer, /this\.#carMeshes\.clear\(\)/);
  const grid = await readFile(new URL('../src/logic/startingGrid.js', import.meta.url), 'utf8');
  assert.doesNotMatch(grid, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest/);
});
