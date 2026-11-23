import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { createRace, raceTimeOf, stepRace } from '../src/logic/race.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { pointAtDistance } from '../src/logic/track.js';
import { formatRaceTime } from '../src/logic/raceClock.js';

const DT = 1 / 60;
const IDLE = { accelerate: false, brake: false, left: false, right: false };

/** Entrada de un piloto automático sencillo que sigue la línea central. */
function autopilot(race) {
  const p = race.player;
  const target = pointAtDistance(race.track, p.progress.lapPosition + 15);
  const wanted = Math.atan2(target.x - p.x, target.z - p.z);
  const error = Math.atan2(Math.sin(wanted - p.heading), Math.cos(wanted - p.heading));
  return { accelerate: p.speed < 22, brake: false, left: error > 0.05, right: error < -0.05 };
}

/** Avanza la carrera hasta que el jugador termina; devuelve los pasos usados. */
function driveUntilFinished(race, config) {
  let steps = 0;
  while (!race.player.finished && steps < 60 * 600) {
    stepRace(race, { player: autopilot(race) }, DT, config);
    steps++;
  }
  return steps;
}

const configWithLaps = (laps) => ({ ...CONFIG, race: { ...CONFIG.race, laps } });

test('al completar la última vuelta el jugador termina, con tiempo final y progreso congelados (RF-025)', () => {
  const race = createRace(CONFIG);
  assert.equal(race.player.finished, false);
  assert.equal(race.player.finishTime, null);
  let reported = [];
  let steps = 0;
  while (!race.player.finished && steps++ < 60 * 600) {
    const result = stepRace(race, { player: autopilot(race) }, DT, CONFIG);
    if (result.finished.length > 0) reported = result.finished;
  }
  assert.equal(race.player.finished, true);
  assert.deepEqual(reported, ['player'], 'stepRace avisa del participante que termina, una sola vez');
  assert.equal(race.player.progress.laps, CONFIG.race.laps);
  assert.equal(race.player.finishTime, race.clock.raceTime, 'el tiempo final es el cronómetro de ese paso');
  assert.ok(race.player.finishTime > 0);
});

test('tras terminar, más pasos no cambian el tiempo final ni el progreso, aunque se acelere (RF-025)', () => {
  const race = createRace(CONFIG);
  driveUntilFinished(race, CONFIG);
  const { finishTime, progress } = race.player;
  for (let i = 0; i < 600; i++) {
    const result = stepRace(race, { player: { ...IDLE, accelerate: true, left: true } }, DT, CONFIG);
    assert.deepEqual(result.finished, [], 'no vuelve a avisar de la llegada');
  }
  assert.equal(race.player.finishTime, finishTime);
  assert.deepEqual(race.player.progress, progress);
  assert.equal(race.player.progress.laps, CONFIG.race.laps, 'las vueltas no pasan del total');
  assert.ok(race.clock.raceTime > finishTime, 'el reloj de la carrera sigue; el tiempo del jugador no');
  assert.equal(raceTimeOf(race, race.player), finishTime);
});

test('tras terminar, los controles dejan de actuar y el coche se detiene por inercia', () => {
  const race = createRace(CONFIG);
  driveUntilFinished(race, CONFIG);
  for (let i = 0; i < 60 * 20; i++) stepRace(race, { player: { ...IDLE, accelerate: true } }, DT, CONFIG);
  assert.ok(race.player.speed < CONFIG.carPerformance.stopSpeedEpsilon + 1e-9, 'el coche acaba parado');
});

test('con varias vueltas solo termina al completar la última, y el contador no se pasa del total', () => {
  const config = configWithLaps(2);
  const race = createRace(config);
  const finishedAtLap = [];
  let steps = 0;
  while (!race.player.finished && steps++ < 60 * 900) {
    const { finished } = stepRace(race, { player: autopilot(race) }, DT, config);
    if (finished.length > 0) finishedAtLap.push(race.player.progress.laps);
  }
  assert.deepEqual(finishedAtLap, [2]);
  assert.equal(race.player.progress.laps, 2);
});

test('el tiempo final coincide con lo que mostraba el cronómetro del HUD', () => {
  const race = createRace(CONFIG);
  driveUntilFinished(race, CONFIG);
  assert.equal(formatRaceTime(raceTimeOf(race, race.player)), formatRaceTime(race.player.finishTime));
});

test('la máquina de estados abre los resultados desde la carrera y permite repetir o volver al menú', () => {
  const machine = new GameStateMachine();
  machine.startRace();
  machine.beginCountdown();
  machine.startGo();
  assert.equal(machine.finishRace(), GameState.RESULTADOS);
  assert.equal(machine.repeatRace(), GameState.PARRILLA);
  machine.beginCountdown();
  machine.startGo();
  machine.finishRace();
  assert.equal(machine.backToMenu(), GameState.MENU);
});

test('repetir y volver al menú solo se permiten desde los resultados', () => {
  const machine = new GameStateMachine();
  assert.throws(() => machine.repeatRace(), /Solo se puede repetir/);
  assert.throws(() => machine.backToMenu(), /Solo se puede volver al menú/);
  assert.throws(() => machine.finishRace(), /no permitida/);
  assert.equal(machine.state, GameState.MENU);
});

test('la pantalla de resultados no importa la lógica y main.js no persiste nada (RF-060)', async () => {
  const ui = await readFile(new URL('../src/ui/resultsScreen.js', import.meta.url), 'utf8');
  assert.doesNotMatch(ui, /from\s+['"][^'"]*logic\//);
  for (const file of ['main.js', 'ui/resultsScreen.js']) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest/);
  }
});
