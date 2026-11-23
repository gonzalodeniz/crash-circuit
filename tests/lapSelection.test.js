import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { lapOptions, requireLapOption } from '../src/logic/lapOptions.js';
import { currentLap, lapCounterText } from '../src/logic/progress.js';
import { createRace, raceTimeOf, stepRace } from '../src/logic/race.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { pointAtDistance } from '../src/logic/track.js';

const DT = 1 / 60;
const MAX_STEPS = 60 * 900;
const IDLE = { accelerate: false, brake: false, left: false, right: false };

/** Piloto automático que sigue la línea central. */
function autopilot(race) {
  const p = race.player;
  const target = pointAtDistance(race.track, p.progress.lapPosition + 15);
  const wanted = Math.atan2(target.x - p.x, target.z - p.z);
  const error = Math.atan2(Math.sin(wanted - p.heading), Math.cos(wanted - p.heading));
  return { accelerate: p.speed < 22, brake: false, left: error > 0.05, right: error < -0.05 };
}

function createSession() {
  const machine = new GameStateMachine();
  return { machine, session: new RaceSession(machine, CONFIG) };
}

test('las opciones de vueltas son exactamente 1, 3, 5 y 10 y vienen de la configuración (RF-006)', () => {
  assert.deepEqual(lapOptions(CONFIG), [1, 3, 5, 10]);
  assert.ok(lapOptions(CONFIG).includes(CONFIG.race.defaultLaps));
  assert.equal(CONFIG.race.defaultLaps, 1);
});

test('un número de vueltas distinto de los cuatro permitidos no se acepta', () => {
  for (const laps of [0, 2, 4, 6, 9, 11, -1, 1.5, NaN, '3', null, undefined]) {
    assert.throws(() => requireLapOption(CONFIG, laps), /Número de vueltas no permitido/, String(laps));
    // `undefined` en createRace significa «las vueltas por defecto»; el resto se rechaza.
    if (laps !== undefined) assert.throws(() => createRace(CONFIG, undefined, undefined, laps), /Número de vueltas no permitido/);
  }
  for (const laps of lapOptions(CONFIG)) assert.equal(requireLapOption(CONFIG, laps), laps);
});

test('la sesión guarda las vueltas elegidas, parte de la preselección y rechaza valores no permitidos', () => {
  const { machine, session } = createSession();
  assert.equal(session.selectedLaps, CONFIG.race.defaultLaps);
  assert.throws(() => session.selectLaps(3), /Solo se puede elegir el número de vueltas/);
  machine.openSelection();
  assert.throws(() => session.selectLaps(4), /Número de vueltas no permitido/);
  assert.equal(session.selectedLaps, CONFIG.race.defaultLaps, 'un valor rechazado no cambia la elección');
  session.selectLaps(5);
  assert.equal(session.selectedLaps, 5);
  machine.startRace();
  assert.throws(() => session.selectLaps(10), /Solo se puede elegir el número de vueltas/);
});

test('cada número de vueltas elegido es el total de la carrera y se conserva al repetir (RF-006)', () => {
  for (const laps of lapOptions(CONFIG)) {
    const { machine, session } = createSession();
    machine.openSelection();
    session.selectLaps(laps);
    session.confirmSelection();
    session.confirmSelection();
    assert.equal(session.race.totalLaps, laps);
    const first = session.race;
    machine.beginCountdown();
    machine.startGo();
    machine.finishRace();
    machine.repeatRace();
    assert.notEqual(session.race, first);
    assert.equal(session.race.totalLaps, laps);
    assert.equal(session.race.player.progress.laps, 0);
  }
});

test('sin elegir, la carrera es de las vueltas por defecto', () => {
  const { machine, session } = createSession();
  machine.openSelection();
  machine.startRace();
  assert.equal(session.race.totalLaps, CONFIG.race.defaultLaps);
});

for (const laps of [1, 3, 5, 10]) {
  test(`con ${laps} vuelta(s) el jugador termina justo al completar la última, el HUD no pasa del total y el tiempo se congela`, () => {
    const { machine, session } = createSession();
    machine.openSelection();
    session.selectTrack('llanura'); // el circuito más corto, para que la prueba sea rápida
    session.selectLaps(laps);
    machine.startRace();
    const race = session.race;
    assert.equal(lapCounterText('Vuelta', race.player.progress, race.totalLaps), `Vuelta 1/${laps}`);

    const reached = []; // vueltas válidas completadas cada vez que sube el contador
    const shown = new Set();
    let steps = 0;
    while (machine.state !== GameState.RESULTADOS && steps++ < MAX_STEPS) {
      const before = race.player.progress.laps;
      session.step(DT, { player: autopilot(race) });
      const { progress } = race.player;
      if (progress.laps !== before) reached.push(progress.laps);
      assert.ok(currentLap(progress, laps) <= laps, 'el contador nunca pasa del total');
      shown.add(lapCounterText('Vuelta', progress, laps));
      // No se abren los resultados antes de la última vuelta.
      if (machine.state === GameState.RESULTADOS) assert.equal(progress.laps, laps);
    }
    assert.equal(machine.state, GameState.RESULTADOS, `${laps} vueltas no terminan`);
    assert.deepEqual(reached, Array.from({ length: laps }, (_, i) => i + 1), 'una vuelta cada vez, sin saltos');
    assert.equal(race.player.progress.laps, laps);
    for (let lap = 1; lap <= laps; lap++) assert.ok(shown.has(`Vuelta ${lap}/${laps}`), `se muestra ${lap}/${laps}`);
    assert.ok(![...shown].some((text) => text.endsWith(`/${laps}`) && Number(text.split(' ')[1].split('/')[0]) > laps));

    // Tiempo y progreso quedan congelados aunque el reloj de la carrera siga.
    const { finishTime, progress } = race.player;
    assert.ok(finishTime > 0);
    for (let i = 0; i < 300; i++) stepRace(race, { player: { ...IDLE, accelerate: true } }, DT, CONFIG);
    assert.equal(race.player.finishTime, finishTime);
    assert.deepEqual(race.player.progress, progress);
    assert.equal(raceTimeOf(race, race.player), finishTime);
  });
}

test('el resto de configuración de la selección no cambia con las vueltas: el mismo circuito y coche en todas', () => {
  const tracks = new Set();
  for (const laps of lapOptions(CONFIG)) {
    const race = createRace(CONFIG, undefined, 'sierra', laps);
    tracks.add(`${race.track.id}:${race.track.length}`);
    assert.equal(race.totalLaps, laps);
  }
  assert.equal(tracks.size, 1);
});

test('la pantalla de selección ofrece las vueltas de la configuración y main.js no las fija', async () => {
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /lapOptions\(CONFIG\)/);
  assert.match(main, /session\.selectLaps\(/);
  assert.doesNotMatch(main, /\b(1|3|5|10)\s*,\s*(3|5|10)\b/, 'main.js no lista las vueltas');
  for (const file of ['optionSelectionScreen.js', 'trackSelectionScreen.js']) {
    const ui = await readFile(new URL(`../src/ui/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(ui, /from\s+['"][^'"]*(logic\/|three)/, file);
  }
});

test('mantener Intro pulsada no confirma varios pasos seguidos (se ignora event.repeat)', async () => {
  const ui = await readFile(new URL('../src/ui/optionSelectionScreen.js', import.meta.url), 'utf8');
  assert.match(ui, /event\.repeat/);
  assert.match(ui, /if \(!event\.repeat\) onConfirm\(\)/);
});
