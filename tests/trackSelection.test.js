import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { carModels } from '../src/logic/carModels.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { createSeededRandom } from '../src/logic/random.js';
import { RaceSession, SelectionStep } from '../src/logic/raceSession.js';
import { trackDefinitions } from '../src/logic/trackCatalog.js';
import { gridSlot } from '../src/logic/track.js';
import { autopilot, CORNERING_AUTOPILOT } from './helpers/autopilot.js';

// Semilla de los rivales: la carrera es la misma en cada ejecución y un fallo se puede repetir.
const SEED = 65;
const DT = 1 / 60;
const MAX_STEPS = 60 * 600;

function createSession() {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(SEED) });
  return { machine, session };
}

test('la selección empieza por el coche, sigue por el circuito, termina en el resumen y al confirmarlo empieza la carrera', () => {
  const { machine, session } = createSession();
  assert.equal(session.selectedTrackId, CONFIG.tracks.defaultId);
  machine.openSelection();
  assert.equal(session.selectionStep, SelectionStep.CAR);
  session.confirmSelection();
  assert.equal(machine.state, GameState.SELECCION);
  assert.equal(session.selectionStep, SelectionStep.TRACK);
  session.selectTrack('abismo');
  assert.equal(session.selectedTrackId, 'abismo');
  session.confirmSelection();
  assert.equal(machine.state, GameState.SELECCION);
  assert.equal(session.selectionStep, SelectionStep.SUMMARY);
  assert.equal(session.race, null);
  session.confirmSelection();
  assert.equal(machine.state, GameState.PARRILLA);
  assert.equal(session.race.track.id, 'abismo');
});

test('volver atrás lleva del resumen al circuito, de este al coche y del coche al menú, sin crear carrera', () => {
  const { machine, session } = createSession();
  machine.openSelection();
  session.confirmSelection();
  session.confirmSelection();
  assert.equal(session.selectionStep, SelectionStep.SUMMARY);
  session.backSelection();
  assert.equal(session.selectionStep, SelectionStep.TRACK);
  assert.equal(session.race, null);
  session.backSelection();
  assert.equal(machine.state, GameState.SELECCION);
  assert.equal(session.selectionStep, SelectionStep.CAR);
  session.backSelection();
  assert.equal(machine.state, GameState.MENU);
  assert.equal(session.race, null);
  // La selección vuelve a empezar por el coche.
  machine.openSelection();
  assert.equal(session.selectionStep, SelectionStep.CAR);
});

test('solo se puede elegir circuito y avanzar en la selección durante SELECCION; uno desconocido se rechaza (RF-004)', () => {
  const { machine, session } = createSession();
  assert.throws(() => session.selectTrack('sierra'), /Solo se puede elegir circuito/);
  assert.throws(() => session.confirmSelection(), /Solo se puede confirmar/);
  assert.throws(() => session.backSelection(), /Solo se puede volver atrás/);
  machine.openSelection();
  assert.throws(() => session.selectTrack('inexistente'), /Circuito desconocido/);
  assert.equal(session.selectedTrackId, CONFIG.tracks.defaultId);
  session.selectTrack('llanura');
  machine.startRace();
  assert.throws(() => session.selectTrack('sierra'), /Solo se puede elegir circuito/);
});

test('cada circuito elegido es el de la carrera, se conserva al repetir y se puede cambiar tras los resultados', () => {
  for (const definition of trackDefinitions(CONFIG)) {
    const { machine, session } = createSession();
    machine.openSelection();
    session.confirmSelection();
    session.selectTrack(definition.id);
    session.confirmSelection();
    session.confirmSelection();
    assert.equal(session.race.track.id, definition.id);
    const first = session.race;
    machine.beginCountdown();
    machine.startGo();
    machine.finishRace();
    machine.repeatRace();
    assert.notEqual(session.race, first);
    assert.equal(session.race.track.id, definition.id);
    // Tras el menú, la selección vuelve al circuito por defecto (RF-007).
    machine.beginCountdown();
    machine.startGo();
    machine.finishRace();
    machine.backToMenu();
    machine.openSelection();
    assert.equal(session.selectedTrackId, CONFIG.tracks.defaultId);
    assert.equal(session.selectionStep, SelectionStep.CAR);
  }
});

test('la parrilla de la carrera es la del circuito elegido: el coche sale de ella (RF-014)', () => {
  const starts = new Set();
  for (const definition of trackDefinitions(CONFIG)) {
    const { machine, session } = createSession();
    machine.openSelection();
    session.selectTrack(definition.id);
    machine.startRace();
    const { player, track } = session.race;
    assert.equal(player.speed, 0);
    // En el hueco de parrilla del jugador (de la configuración) de su circuito, detrás de la meta.
    const slot = gridSlot(track, CONFIG.grid, CONFIG.grid.playerSlotIndex);
    assert.deepEqual([player.x, player.z, player.heading], [slot.x, slot.z, slot.heading]);
    const distanceToFinish = Math.hypot(player.x - track.finish.x, player.z - track.finish.z);
    const lastRow = Math.floor((CONFIG.race.maxParticipants - 1) / 2);
    assert.ok(distanceToFinish > 0 && distanceToFinish < CONFIG.grid.firstSlotDistance + lastRow * CONFIG.grid.slotSpacing + 5);
    starts.add(`${track.finish.x},${track.finish.z},${track.length}`);
  }
  assert.equal(starts.size, 4);
});

test('cualquier coche en cualquier circuito lleva a una carrera jugable hasta los resultados (CA-10 parcial)', () => {
  for (const model of carModels(CONFIG)) {
    for (const definition of trackDefinitions(CONFIG)) {
      const { machine, session } = createSession();
      machine.openSelection();
      session.selectCarModel(model.id);
      session.confirmSelection();
      session.selectTrack(definition.id);
      session.confirmSelection();
      session.confirmSelection();
      let steps = 0;
      while (machine.state !== GameState.RESULTADOS && steps++ < MAX_STEPS) {
        session.step(DT, { player: autopilot(session.race, session.race.player, CORNERING_AUTOPILOT) });
      }
      const { player } = session.race;
      assert.equal(machine.state, GameState.RESULTADOS, `${model.id} en ${definition.id} no termina`);
      assert.equal(player.progress.laps, session.race.totalLaps);
      assert.equal(player.carModelId, model.id);
      assert.ok(player.finishTime > 0);
    }
  }
});

test('main.js no decide el paso de la selección ni cambia de estado por su cuenta', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /session\.confirmSelection\(\)/);
  assert.match(source, /session\.backSelection\(\)/);
  assert.doesNotMatch(source, /stateMachine\.(startRace|cancelSelection)\(/);
});

test('las pantallas de selección no importan la lógica ni Three.js', async () => {
  for (const file of ['optionSelectionScreen.js', 'carSelectionScreen.js', 'trackSelectionScreen.js']) {
    const ui = await readFile(new URL(`../src/ui/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(ui, /from\s+['"][^'"]*(logic\/|three)/, file);
  }
});
