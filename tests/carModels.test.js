import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { carModels, findCarModel, requireCarModel } from '../src/logic/carModels.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { ParticipantStatus, createRace, stepRace } from '../src/logic/race.js';
import { RaceSession } from '../src/logic/raceSession.js';

const DT = 1 / 60;
const PERFORMANCE_WORDS = /speed|accel|steer|brake|grip|power|handling|weight|mass/i;

test('el catálogo tiene exactamente cuatro modelos con identificadores y nombres únicos (RF-002)', () => {
  const models = carModels(CONFIG);
  assert.equal(models.length, 4);
  assert.equal(new Set(models.map((model) => model.id)).size, 4);
  assert.equal(new Set(models.map((model) => model.name)).size, 4);
  for (const model of models) {
    assert.match(model.id, /^[a-z]+$/);
    assert.ok(model.name.length > 0);
  }
  assert.ok(findCarModel(CONFIG, CONFIG.cars.defaultModelId));
});

test('los cuatro modelos se distinguen por el aspecto: ni dos iguales ni dos con el mismo color de carrocería (RF-002)', () => {
  const looks = carModels(CONFIG).map((model) => JSON.stringify(model.appearance));
  assert.equal(new Set(looks).size, 4);
  const bodyColors = carModels(CONFIG).map((model) => model.appearance.bodyColor);
  assert.equal(new Set(bodyColors).size, 4);
});

test('los modelos no tienen parámetros de rendimiento propios (RF-003, RN-07)', () => {
  for (const model of carModels(CONFIG)) {
    assert.deepEqual(Object.keys(model).sort(), ['appearance', 'id', 'name']);
    for (const key of Object.keys(model.appearance)) assert.doesNotMatch(key, PERFORMANCE_WORDS);
  }
});

test('buscar un modelo desconocido devuelve undefined y requireCarModel lanza un error', () => {
  assert.equal(findCarModel(CONFIG, 'inexistente'), undefined);
  assert.throws(() => requireCarModel(CONFIG, 'inexistente'), /desconocido/);
});

test('la carrera creada con cada modelo lo guarda en el participante del jugador', () => {
  for (const model of carModels(CONFIG)) {
    const race = createRace(CONFIG, [{ ...CONFIG.race.player, carModelId: model.id }]);
    assert.equal(race.player.carModelId, model.id);
  }
  assert.equal(createRace(CONFIG).player.carModelId, CONFIG.cars.defaultModelId);
  assert.throws(() => createRace(CONFIG, [{ ...CONFIG.race.player, carModelId: 'inexistente' }]), /desconocido/);
});

test('con las mismas entradas y el mismo paso de tiempo los cuatro modelos hacen exactamente lo mismo (RF-003)', () => {
  // Acelera, gira y frena en tramos, tras la cuenta atrás, y compara cada paso con el del primer modelo.
  const input = (i) => ({
    accelerate: i % 400 < 300,
    brake: i % 400 >= 340,
    left: i % 200 >= 100 && i % 200 < 140,
    right: i % 300 >= 220 && i % 300 < 260,
  });
  const trajectories = carModels(CONFIG).map((model) => {
    const race = createRace(CONFIG, [{ ...CONFIG.race.player, carModelId: model.id }]);
    const samples = [];
    for (let i = 0; i < 60 * 12; i++) {
      stepRace(race, { player: input(i) }, DT, CONFIG);
      const { x, z, heading, speed, steer } = race.player;
      samples.push([x, z, heading, speed, steer]);
    }
    assert.equal(race.player.status, ParticipantStatus.EN_CARRERA);
    assert.ok(race.player.speed !== 0 || samples.some((sample) => sample[3] > 1));
    return samples;
  });
  assert.ok(trajectories[0].some((sample) => sample[3] > 10), 'el coche debe haberse movido');
  for (const trajectory of trajectories.slice(1)) assert.deepEqual(trajectory, trajectories[0]);
});

test('todos los modelos usan las mismas dimensiones y la misma parrilla', () => {
  const poses = carModels(CONFIG).map((model) => {
    const race = createRace(CONFIG, [{ ...CONFIG.race.player, carModelId: model.id }]);
    return { car: race.car, x: race.player.x, z: race.player.z, heading: race.player.heading };
  });
  for (const pose of poses) assert.deepEqual(pose, poses[0]);
});

function createSession() {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG);
  return { machine, session };
}

test('la sesión parte del modelo por defecto y solo permite elegir durante la selección', () => {
  const { machine, session } = createSession();
  assert.equal(session.selectedCarModelId, CONFIG.cars.defaultModelId);
  assert.throws(() => session.selectCarModel('bruma'), /Solo se puede elegir coche/);
  machine.openSelection();
  assert.equal(session.race, null);
  session.selectCarModel('bruma');
  assert.equal(session.selectedCarModelId, 'bruma');
  assert.throws(() => session.selectCarModel('inexistente'), /desconocido/);
  assert.equal(session.selectedCarModelId, 'bruma');
  machine.startRace();
  assert.throws(() => session.selectCarModel('jade'), /Solo se puede elegir coche/);
});

test('MENU -> SELECCION -> PARRILLA crea la carrera con el modelo elegido, para cada uno de los cuatro', () => {
  for (const model of carModels(CONFIG)) {
    const { machine, session } = createSession();
    machine.openSelection();
    session.selectCarModel(model.id);
    machine.startRace();
    assert.equal(machine.state, GameState.PARRILLA);
    assert.equal(session.race.player.carModelId, model.id);
  }
});

test('repetir desde los resultados conserva el modelo elegido y volver atrás desde la selección no crea carrera (CA-10)', () => {
  const { machine, session } = createSession();
  machine.openSelection();
  machine.cancelSelection();
  assert.equal(session.race, null);
  machine.openSelection();
  session.selectCarModel('trueno');
  machine.startRace();
  const first = session.race;
  machine.beginCountdown();
  machine.startGo();
  machine.finishRace();
  assert.equal(machine.repeatRace(), GameState.PARRILLA);
  assert.notEqual(session.race, first);
  assert.equal(session.race.player.carModelId, 'trueno');
  // Tras pasar por el menú, la selección sigue en memoria pero se puede cambiar.
  machine.beginCountdown();
  machine.startGo();
  machine.finishRace();
  machine.backToMenu();
  machine.openSelection();
  assert.equal(session.selectedCarModelId, 'trueno');
  session.selectCarModel('jade');
  machine.startRace();
  assert.equal(session.race.player.carModelId, 'jade');
});

test('el modelo elegido solo vive en memoria: ni main.js ni la sesión ni la pantalla lo persisten (RF-060)', async () => {
  for (const file of ['main.js', 'logic/raceSession.js', 'logic/carModels.js', 'ui/carSelectionScreen.js', 'render/carMesh.js']) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest/);
  }
});

test('la pantalla de selección no importa la lógica ni Three.js, y el rendimiento no depende del aspecto', async () => {
  const ui = await readFile(new URL('../src/ui/carSelectionScreen.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /from\s+['"][^'"]*(logic\/|three)/);
  const driving = await readFile(new URL('../src/logic/driving.js', import.meta.url), 'utf8');
  assert.doesNotMatch(driving, /carModel|appearance/);
});
