import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { createRace, stepRace } from '../src/logic/race.js';
import {
  ClockPhase, GO_SIGNAL, countdownSignal, createRaceClock, formatRaceTime, stepRaceClock,
} from '../src/logic/raceClock.js';

const countdown = { steps: 3, stepDuration: 1, goDisplayDuration: 1 };
const noInput = { accelerate: false, brake: false, left: false, right: false };
const fullThrottle = { ...noInput, accelerate: true, left: true };

function signalsEvery(dt, until) {
  let clock = createRaceClock();
  const seen = [];
  for (let t = 0; t < until; t += dt) {
    const signal = countdownSignal(clock, countdown);
    if (seen.at(-1) !== signal) seen.push(signal);
    clock = stepRaceClock(clock, dt, countdown);
  }
  return seen;
}

test('la secuencia de la cuenta atrás es 3, 2, 1, salida y nada', () => {
  assert.deepEqual(signalsEvery(0.25, 5), [3, 2, 1, GO_SIGNAL, null]);
});

test('la secuencia no depende del tamaño del paso de tiempo', () => {
  assert.deepEqual(signalsEvery(1 / 60, 5), [3, 2, 1, GO_SIGNAL, null]);
  assert.deepEqual(signalsEvery(0.5, 5), [3, 2, 1, GO_SIGNAL, null]);
});

test('la duración de cada paso sale de la configuración', () => {
  const slow = { steps: 3, stepDuration: 2, goDisplayDuration: 1 };
  let clock = createRaceClock();
  clock = stepRaceClock(clock, 1.5, slow);
  assert.equal(countdownSignal(clock, slow), 3);
  clock = stepRaceClock(clock, 1, slow); // 2,5 s
  assert.equal(countdownSignal(clock, slow), 2);
  clock = stepRaceClock(clock, 2, slow); // 4,5 s
  assert.equal(countdownSignal(clock, slow), 1);
  assert.equal(clock.phase, ClockPhase.COUNTDOWN);
  assert.ok(CONFIG.race.countdown.stepDuration > 0 && CONFIG.race.countdown.steps === 3);
});

test('el cronómetro vale cero durante la cuenta atrás y después acumula exactamente el tiempo simulado', () => {
  let clock = createRaceClock();
  for (let i = 0; i < 11; i++) {
    clock = stepRaceClock(clock, 0.25, countdown); // 2,75 s
    assert.equal(clock.raceTime, 0);
    assert.equal(clock.phase, ClockPhase.COUNTDOWN);
  }
  clock = stepRaceClock(clock, 0.25, countdown); // 3,0 s: salida exacta
  assert.equal(clock.phase, ClockPhase.RUNNING);
  assert.equal(clock.raceTime, 0);
  for (let i = 0; i < 6; i++) clock = stepRaceClock(clock, 0.25, countdown);
  assert.equal(clock.raceTime, 1.5);
});

test('si la salida cae dentro de un paso, el sobrante cuenta como tiempo de carrera', () => {
  let clock = stepRaceClock(createRaceClock(), 2.75, countdown);
  clock = stepRaceClock(clock, 0.5, countdown);
  assert.equal(clock.phase, ClockPhase.RUNNING);
  assert.equal(clock.raceTime, 0.25);
});

test('el reloj no cambia el estado recibido ni avanza con pasos negativos', () => {
  const clock = createRaceClock();
  const next = stepRaceClock(clock, 1, countdown);
  assert.equal(clock.countdownElapsed, 0);
  assert.equal(stepRaceClock(next, -5, countdown).countdownElapsed, 1);
});

test('formatRaceTime da mm:ss.cc y trunca', () => {
  assert.equal(formatRaceTime(0), '00:00.00');
  assert.equal(formatRaceTime(1.5), '00:01.50');
  assert.equal(formatRaceTime(61.239), '01:01.23');
  assert.equal(formatRaceTime(599.999), '09:59.99');
  assert.equal(formatRaceTime(-3), '00:00.00');
});

test('antes de la salida las flechas no producen movimiento ni progreso', () => {
  const race = createRace(CONFIG);
  const start = { x: race.player.x, z: race.player.z, heading: race.player.heading };
  for (let t = 0; t < 2.9; t += 1 / 60) {
    const { started } = stepRace(race, { player: fullThrottle }, 1 / 60, CONFIG);
    assert.equal(started, false);
  }
  assert.equal(race.clock.phase, ClockPhase.COUNTDOWN);
  assert.equal(race.clock.raceTime, 0);
  assert.deepEqual({ x: race.player.x, z: race.player.z, heading: race.player.heading }, start);
  assert.equal(race.player.speed, 0);
  assert.equal(race.player.status, GameState.PARRILLA);
});

test('la salida cambia el estado de todos los participantes en el mismo paso', () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, isPlayer: i === 0 }));
  const race = createRace(CONFIG, entries);
  const total = CONFIG.race.countdown.steps * CONFIG.race.countdown.stepDuration;
  const dt = CONFIG.carPerformance.maxStep;
  let startedSteps = 0;
  let before = null;
  for (let t = 0; startedSteps === 0 && t < total + 1; t += dt) {
    before = race.participants.map((p) => p.status);
    startedSteps += stepRace(race, {}, dt, CONFIG).started ? 1 : 0;
  }
  assert.equal(startedSteps, 1);
  assert.ok(before.every((status) => status === GameState.PARRILLA));
  assert.ok(race.participants.every((p) => p.status === GameState.EN_CARRERA));
  assert.equal(stepRace(race, {}, dt, CONFIG).started, false); // la señal se da una sola vez
});

test('tras la salida el coche responde a las flechas y el cronómetro suma el tiempo simulado', () => {
  const race = createRace(CONFIG);
  const dt = CONFIG.carPerformance.maxStep;
  while (race.clock.phase === ClockPhase.COUNTDOWN) stepRace(race, { player: fullThrottle }, dt, CONFIG);
  assert.ok(race.clock.raceTime < dt + 1e-9);
  const timeAtStart = race.clock.raceTime;
  for (let i = 0; i < 30; i++) stepRace(race, { player: fullThrottle }, dt, CONFIG);
  assert.ok(Math.abs(race.clock.raceTime - (timeAtStart + 30 * dt)) < 1e-9);
  assert.ok(race.player.speed > 0);
});

test('un paso de tiempo grande se limita a maxStep también en el reloj', () => {
  const race = createRace(CONFIG);
  stepRace(race, {}, 10, CONFIG);
  assert.equal(race.clock.countdownElapsed, CONFIG.carPerformance.maxStep);
});

test('la máquina de estados enlaza parrilla, cuenta atrás y carrera', () => {
  const machine = new GameStateMachine();
  machine.startRace();
  assert.equal(machine.beginCountdown(), GameState.CUENTA_ATRAS);
  assert.equal(machine.startGo(), GameState.EN_CARRERA);
  assert.throws(() => new GameStateMachine().startGo(), /no permitida/);
});

test('el reloj de carrera no depende de Three.js, del DOM ni de relojes del navegador', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const file of ['raceClock.js', 'race.js']) {
    const source = await readFile(new URL(`../src/logic/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from\s+['"]three['"]|document\.|window\.|Date\.now|performance\.now|setTimeout|setInterval/);
  }
});
