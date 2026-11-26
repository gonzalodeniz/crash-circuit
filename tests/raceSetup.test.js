import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { aiDrive, aiLevel, createAiDriver, createAiRecovery } from '../src/logic/aiDriver.js';
import { carModels } from '../src/logic/carModels.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { lapOptions } from '../src/logic/lapOptions.js';
import { createSeededRandom } from '../src/logic/random.js';
import { raceTimeOf } from '../src/logic/race.js';
import { RaceSession, SelectionStep } from '../src/logic/raceSession.js';
import { createRaceFromSetup, createRaceSetup, defaultRaceSetup, raceSetupSummary } from '../src/logic/raceSetup.js';
import { requireTrackDefinition, trackDefinitions } from '../src/logic/trackCatalog.js';

const DT = 1 / 60;
const MAX_STEPS = 60 * 1800;
// Semilla de los rivales: la carrera es la misma en cada ejecución y un fallo se puede repetir.
const SEED = 65;
const VALID = { carModelId: 'bruma', trackId: 'sierra', laps: 3 };

function createSession(seed = SEED) {
  const machine = new GameStateMachine();
  return { machine, session: new RaceSession(machine, CONFIG, { random: createSeededRandom(seed) }) };
}

/** Recorre la selección completa: coche, circuito con vueltas, resumen y confirmación. */
function confirmSetup({ machine, session }, { carModelId, trackId, laps }) {
  machine.openSelection();
  session.selectCarModel(carModelId);
  session.confirmSelection();
  session.selectTrack(trackId);
  session.selectLaps(laps);
  session.confirmSelection();
  assert.equal(session.selectionStep, SelectionStep.SUMMARY);
  session.confirmSelection();
}

test('la configuración confirmada guarda coche, circuito y vueltas, y no se puede modificar', () => {
  const setup = createRaceSetup(CONFIG, VALID);
  assert.deepEqual(setup, VALID);
  assert.ok(Object.isFrozen(setup));
  assert.deepEqual(defaultRaceSetup(CONFIG), {
    carModelId: CONFIG.cars.defaultModelId,
    trackId: CONFIG.tracks.defaultId,
    laps: CONFIG.race.defaultLaps,
  });
});

test('una configuración incompleta o fuera del catálogo no puede confirmarse (RF-007)', () => {
  for (const missing of ['carModelId', 'trackId', 'laps']) {
    const incomplete = { ...VALID };
    delete incomplete[missing];
    assert.throws(() => createRaceSetup(CONFIG, incomplete), new RegExp(`incompleta: falta ${missing}`));
    assert.throws(() => createRaceSetup(CONFIG, { ...VALID, [missing]: null }), /incompleta/);
    assert.throws(() => createRaceFromSetup(CONFIG, incomplete, createSeededRandom(SEED)), /incompleta/);
  }
  assert.throws(() => createRaceSetup(CONFIG, undefined), /incompleta/);
  assert.throws(() => createRaceSetup(CONFIG, { ...VALID, carModelId: 'inexistente' }), /Modelo de coche desconocido/);
  assert.throws(() => createRaceSetup(CONFIG, { ...VALID, trackId: 'inexistente' }), /Circuito desconocido/);
  for (const laps of [0, 2, 4, 11, '3', NaN]) {
    assert.throws(() => createRaceSetup(CONFIG, { ...VALID, laps }), /Número de vueltas no permitido/);
    assert.throws(() => createRaceFromSetup(CONFIG, { ...VALID, laps }, createSeededRandom(SEED)), /Número de vueltas no permitido/);
  }
});

test('la carrera creada con cada configuración confirmada tiene ese coche, ese circuito y ese total de vueltas', () => {
  for (const model of carModels(CONFIG)) {
    for (const definition of trackDefinitions(CONFIG)) {
      for (const laps of lapOptions(CONFIG)) {
        const race = createRaceFromSetup(CONFIG, { carModelId: model.id, trackId: definition.id, laps }, createSeededRandom(SEED));
        assert.equal(race.player.carModelId, model.id);
        assert.equal(race.track.id, definition.id);
        assert.equal(race.totalLaps, laps);
      }
    }
  }
});

test('la sesión crea la carrera solo con la configuración confirmada al aceptar el resumen (RF-007)', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  assert.equal(session.confirmedSetup, null);
  confirmSetup(ctx, VALID);
  assert.equal(machine.state, GameState.PARRILLA);
  assert.deepEqual(session.confirmedSetup, VALID);
  assert.equal(session.race.player.carModelId, VALID.carModelId);
  assert.equal(session.race.track.id, VALID.trackId);
  assert.equal(session.race.totalLaps, VALID.laps);
});

test('el resumen muestra coche, circuito, dificultad y vueltas elegidos, y no crea carrera ni cambia de estado', () => {
  const { machine, session } = createSession();
  machine.openSelection();
  session.selectCarModel('jade');
  session.selectTrack('abismo');
  session.selectLaps(5);
  session.confirmSelection();
  session.confirmSelection();
  assert.equal(machine.state, GameState.SELECCION);
  assert.equal(session.race, null);
  assert.equal(session.confirmedSetup, null);
  const abismo = trackDefinitions(CONFIG).find((definition) => definition.id === 'abismo');
  assert.deepEqual(raceSetupSummary(CONFIG, session.pendingSetup), {
    carName: 'Jade',
    trackName: abismo.name,
    difficulty: abismo.difficulty,
    laps: 5,
  });
  assert.ok(CONFIG.ui.trackSelection.difficultyLabels[abismo.difficulty], 'la dificultad tiene etiqueta');
});

test('desde el resumen se puede volver, cambiar coche, circuito o vueltas y confirmar con los nuevos valores', () => {
  const { machine, session } = createSession();
  machine.openSelection();
  session.selectCarModel('trueno');
  session.confirmSelection();
  session.selectTrack('llanura');
  session.confirmSelection();
  session.backSelection(); // al circuito
  session.selectLaps(10);
  session.backSelection(); // al coche
  assert.equal(session.selectionStep, SelectionStep.CAR);
  session.selectCarModel('jade');
  session.confirmSelection();
  assert.equal(session.selectedTrackId, 'llanura', 'volver atrás conserva lo elegido en el otro paso');
  session.confirmSelection();
  assert.deepEqual(raceSetupSummary(CONFIG, session.pendingSetup).carName, 'Jade');
  session.confirmSelection();
  assert.deepEqual(session.confirmedSetup, { carModelId: 'jade', trackId: 'llanura', laps: 10 });
  assert.equal(session.race.totalLaps, 10);
});

test('repetir juega la misma configuración confirmada en una carrera nueva y sin progreso previo', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  confirmSetup(ctx, VALID);
  const first = session.race;
  const setup = session.confirmedSetup;
  machine.beginCountdown();
  machine.startGo();
  machine.finishRace();
  assert.equal(machine.repeatRace(), GameState.PARRILLA);
  assert.notEqual(session.race, first);
  assert.equal(session.confirmedSetup, setup);
  assert.equal(session.race.player.carModelId, VALID.carModelId);
  assert.equal(session.race.track.id, VALID.trackId);
  assert.equal(session.race.totalLaps, VALID.laps);
  assert.equal(session.race.player.progress.laps, 0);
  assert.equal(session.race.player.finishTime, null);
});

test('al volver al menú una nueva selección parte de los valores por defecto y sin estado de la carrera anterior', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  confirmSetup(ctx, VALID);
  machine.beginCountdown();
  machine.startGo();
  machine.finishRace();
  machine.backToMenu();
  assert.equal(session.race, null);
  assert.equal(session.confirmedSetup, null);
  machine.openSelection();
  assert.equal(session.selectionStep, SelectionStep.CAR);
  assert.deepEqual(session.pendingSetup, defaultRaceSetup(CONFIG));
  // Cancelar la selección desde el primer paso también descarta lo elegido.
  session.selectCarModel('jade');
  session.backSelection();
  machine.openSelection();
  assert.deepEqual(session.pendingSetup, defaultRaceSetup(CONFIG));
  session.confirmSelection();
  session.confirmSelection();
  session.confirmSelection();
  assert.equal(session.race.totalLaps, CONFIG.race.defaultLaps);
  assert.equal(session.race.player.progress.laps, 0);
});

test('tras los resultados, elegir otra selección descarta la configuración confirmada pero conserva las opciones', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  confirmSetup(ctx, VALID);
  machine.beginCountdown();
  machine.startGo();
  machine.finishRace();
  machine.transitionTo(GameState.SELECCION);
  assert.equal(session.confirmedSetup, null);
  assert.equal(session.race, null);
  assert.deepEqual(session.pendingSetup, VALID);
});

/**
 * Conductor del jugador en la matriz: un piloto IA propio, que sabe salir de un atasco. Hace falta porque
 * los coches son sólidos y quien va doblado se encuentra en la calzada con los que ya han terminado.
 */
function playerPilot(race, seed) {
  const level = aiLevel(CONFIG.ai, requireTrackDefinition(CONFIG, race.track.id).difficulty);
  const driver = createAiDriver(race.track, CONFIG.ai, level, CONFIG.carPerformance, race.car, createSeededRandom(seed));
  let recovery = createAiRecovery();
  return () => {
    const result = aiDrive(recovery, driver, race.player, CONFIG.ai, DT);
    recovery = result.recovery;
    return result.input;
  };
}

// CA-10 (parcial): las 64 combinaciones, con los rivales conduciendo, hasta los resultados. El jugador lo
// conduce un piloto automático con la lógica de progreso real; la jugabilidad con teclado queda en la
// verificación manual.
// La semilla de cada combinación es su índice (0..63), así cada caso se repite por separado.
const MODELS = carModels(CONFIG);
const TRACKS = trackDefinitions(CONFIG);
const LAP_OPTIONS = lapOptions(CONFIG);
for (const [modelIndex, model] of MODELS.entries()) {
  test(`matriz de 64 combinaciones, coche ${model.id}: cada circuito y distancia se juega hasta los resultados (CA-10 parcial)`, () => {
    for (const [trackIndex, definition] of TRACKS.entries()) {
      for (const [lapIndex, laps] of LAP_OPTIONS.entries()) {
        const seed = (modelIndex * TRACKS.length + trackIndex) * LAP_OPTIONS.length + lapIndex;
        const label = `${model.id} en ${definition.id} a ${laps} vuelta(s) (semilla ${seed})`;
        const ctx = createSession(seed);
        const { machine, session } = ctx;
        confirmSetup(ctx, { carModelId: model.id, trackId: definition.id, laps });
        const { race } = session;
        assert.equal(race.totalLaps, laps, label);
        assert.equal(race.participants.length, 10, `${label}: diez participantes`);
        const lapsReached = [];
        const drive = playerPilot(race, seed);
        let steps = 0;
        while (machine.state !== GameState.RESULTADOS && steps++ < MAX_STEPS) {
          const before = race.player.progress.laps;
          session.step(DT, { player: race.clock.raceTime > 0 ? drive() : {} });
          if (race.player.progress.laps !== before) lapsReached.push(race.player.progress.laps);
        }
        assert.equal(machine.state, GameState.RESULTADOS, `${label} no termina`);
        assert.deepEqual(lapsReached, Array.from({ length: laps }, (_, i) => i + 1), `${label}: una vuelta válida cada vez`);
        assert.equal(race.player.progress.laps, laps, label);
        assert.equal(race.player.carModelId, model.id, label);
        assert.equal(race.track.id, definition.id, label);
        assert.ok(race.player.finished && raceTimeOf(race, race.player) > 0, label);
        assert.equal(race.participants.length, 10, `${label}: los diez siguen en la carrera`);
        // Los nueve rivales conducen solos con la misma lógica de progreso: avanzan y sus vueltas no pasan del total.
        for (const rival of race.participants.filter((p) => !p.isPlayer)) {
          assert.ok(rival.progress.progress > 0, `${label}: ${rival.name} ha avanzado`);
          assert.ok(rival.progress.laps <= laps, `${label}: ${rival.name} no pasa del total de vueltas`);
          assert.equal(rival.finished, rival.progress.laps === laps, `${label}: ${rival.name} termina al completar las vueltas`);
        }
      }
    }
  });
}

test('main.js no crea la carrera ni lee valores sueltos: usa la sesión y el resumen de la configuración', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /createRace/);
  assert.match(main, /raceSetupSummary\(CONFIG, session\.pendingSetup\)/);
  const session = await readFile(new URL('../src/logic/raceSession.js', import.meta.url), 'utf8');
  assert.doesNotMatch(session, /createRace\(/, 'la sesión crea la carrera con createRaceFromSetup');
  assert.match(session, /createRaceFromSetup\(this\.#config, this\.#confirmedSetup, this\.#random\)/);
});

test('la pantalla de resumen no importa la lógica ni Three.js, y la configuración elegida no se persiste (RF-060)', async () => {
  const ui = await readFile(new URL('../src/ui/summaryScreen.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /from\s+['"][^'"]*(logic\/|three)/);
  for (const file of ['logic/raceSetup.js', 'logic/raceSession.js', 'ui/summaryScreen.js', 'main.js']) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest/, file);
  }
});
