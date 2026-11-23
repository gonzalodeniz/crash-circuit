import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { createSeededRandom } from '../src/logic/random.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { ParticipantStatus } from '../src/logic/race.js';
import { autopilot } from './helpers/autopilot.js';

const DT = 1 / 60;
const IDLE = { accelerate: false, brake: false, left: false, right: false };
const MAX_STEPS = 60 * 600;

// Semilla de los rivales: la carrera es la misma en cada ejecución y un fallo se puede repetir.
const SEED = 65;
function createSession(config = CONFIG) {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, config, { random: createSeededRandom(SEED) });
  const states = [];
  machine.onChange((from, to) => states.push(to));
  return { machine, session, states };
}

/** Avanza la sesión con el piloto automático hasta que se abren los resultados. */
function playUntilResults({ machine, session }) {
  let steps = 0;
  while (machine.state !== GameState.RESULTADOS && steps++ < MAX_STEPS) {
    session.step(DT, { player: autopilot(session.race) });
  }
  return steps;
}

test('al empezar no hay carrera; entrar en PARRILLA la crea', () => {
  const { machine, session } = createSession();
  assert.equal(session.race, null);
  machine.openSelection();
  machine.startRace();
  assert.equal(machine.state, GameState.PARRILLA);
  assert.notEqual(session.race, null);
  assert.equal(session.race.player.status, ParticipantStatus.PARRILLA);
});

test('el primer paso lleva de la parrilla a la cuenta atrás sin mover los coches (RF-020)', () => {
  const { machine, session } = createSession();
  machine.openSelection();
  machine.startRace();
  const result = session.step(DT, { player: { ...IDLE, accelerate: true } });
  assert.equal(machine.state, GameState.CUENTA_ATRAS);
  assert.equal(result.started, false);
  assert.equal(session.race.player.speed, 0);
});

test('la señal de salida pasa a EN_CARRERA una sola vez (RF-021)', () => {
  const { machine, session, states } = createSession();
  machine.openSelection();
  machine.startRace();
  let starts = 0;
  let steps = 0;
  while (machine.state !== GameState.EN_CARRERA && steps++ < MAX_STEPS) {
    if (session.step(DT, { player: IDLE }).started) starts++;
  }
  assert.equal(machine.state, GameState.EN_CARRERA);
  assert.equal(starts, 1);
  assert.equal(session.race.player.status, ParticipantStatus.EN_CARRERA);
  for (let i = 0; i < 120; i++) assert.equal(session.step(DT, { player: IDLE }).started, false);
  assert.deepEqual(states, [GameState.SELECCION, GameState.PARRILLA, GameState.CUENTA_ATRAS, GameState.EN_CARRERA]);
});

test('al terminar el jugador se abren los resultados y finishRace se llama una sola vez (RN-03, RF-025)', () => {
  const ctx = createSession();
  ctx.machine.openSelection();
  ctx.machine.startRace();
  const finishes = [];
  let steps = 0;
  while (ctx.machine.state !== GameState.RESULTADOS && steps++ < MAX_STEPS) {
    const result = ctx.session.step(DT, { player: autopilot(ctx.session.race) });
    if (result.playerFinished) finishes.push(result.finished);
  }
  assert.equal(ctx.machine.state, GameState.RESULTADOS);
  assert.deepEqual(finishes, [['player']]);
  assert.equal(ctx.session.race.player.finished, true);
  assert.equal(ctx.states.filter((state) => state === GameState.RESULTADOS).length, 1);
  // Seguir llamando a step en RESULTADOS no vuelve a transitar ni lanza errores.
  for (let i = 0; i < 300; i++) {
    const result = ctx.session.step(DT, { player: { ...IDLE, accelerate: true } });
    assert.equal(result.playerFinished, false);
  }
  assert.equal(ctx.machine.state, GameState.RESULTADOS);
  assert.equal(ctx.states.filter((state) => state === GameState.RESULTADOS).length, 1);
});

test('en RESULTADOS la simulación sigue: el coche rueda por inercia hasta detenerse y el tiempo no cambia (RF-025)', () => {
  const ctx = createSession();
  ctx.machine.openSelection();
  ctx.machine.startRace();
  playUntilResults(ctx);
  const { finishTime } = ctx.session.race.player;
  for (let i = 0; i < 60 * 20; i++) ctx.session.step(DT, { player: { ...IDLE, accelerate: true } });
  assert.ok(ctx.session.race.player.speed < CONFIG.carPerformance.stopSpeedEpsilon + 1e-9);
  assert.equal(ctx.session.race.player.finishTime, finishTime);
});

test('repetir crea una carrera nueva, igual que una recién creada, y la anterior conserva su resultado (RF-057)', () => {
  const ctx = createSession();
  ctx.machine.openSelection();
  ctx.machine.startRace();
  playUntilResults(ctx);
  const first = ctx.session.race;
  ctx.machine.repeatRace();
  const repeated = ctx.session.race;
  assert.equal(ctx.machine.state, GameState.PARRILLA);
  assert.notEqual(repeated, first);
  assert.equal(repeated.player.finished, false);
  assert.equal(repeated.player.finishTime, null);
  assert.equal(repeated.player.progress.laps, 0);
  assert.equal(repeated.player.status, ParticipantStatus.PARRILLA);
  assert.equal(repeated.clock.raceTime, 0);
  assert.equal(first.player.finished, true);
  // La repetición vuelve a recorrer parrilla -> cuenta atrás -> carrera -> resultados.
  playUntilResults(ctx);
  assert.equal(ctx.machine.state, GameState.RESULTADOS);
  assert.equal(repeated.player.finished, true);
});

test('volver al menú descarta la carrera y una nueva parte de cero (RF-008)', () => {
  const ctx = createSession();
  ctx.machine.openSelection();
  ctx.machine.startRace();
  playUntilResults(ctx);
  ctx.machine.backToMenu();
  assert.equal(ctx.machine.state, GameState.MENU);
  assert.equal(ctx.session.race, null);
  assert.deepEqual(ctx.session.step(DT, { player: IDLE }), { started: false, finished: [], playerFinished: false });
  ctx.machine.openSelection();
  ctx.machine.startRace();
  assert.equal(ctx.session.race.player.progress.laps, 0);
  assert.equal(ctx.session.race.player.finishTime, null);
});

test('al llegar a SELECCION también se descarta la carrera', () => {
  const ctx = createSession();
  ctx.machine.openSelection();
  ctx.machine.startRace();
  playUntilResults(ctx);
  ctx.machine.transitionTo(GameState.SELECCION);
  assert.equal(ctx.session.race, null);
});

test('sin carrera o fuera de los estados simulados, step no avanza nada', () => {
  const ctx = createSession();
  assert.equal(ctx.session.step(DT, { player: IDLE }).started, false);
  assert.equal(ctx.machine.state, GameState.MENU);

  // PAUSA congela la simulación y todos los relojes (E7): el reloj no avanza.
  ctx.machine.openSelection();
  ctx.machine.startRace();
  ctx.session.step(DT, { player: IDLE }); // PARRILLA -> CUENTA_ATRAS
  let steps = 0;
  while (ctx.machine.state !== GameState.EN_CARRERA && steps++ < MAX_STEPS) ctx.session.step(DT, { player: IDLE });
  ctx.machine.transitionTo(GameState.PAUSA);
  const before = structuredClone({ clock: ctx.session.race.clock, player: ctx.session.race.player });
  for (let i = 0; i < 120; i++) {
    assert.equal(ctx.session.step(DT, { player: { ...IDLE, accelerate: true } }).started, false);
  }
  assert.deepEqual({ clock: ctx.session.race.clock, player: ctx.session.race.player }, before);
  assert.equal(ctx.machine.state, GameState.PAUSA);
});

test('dispose deja de escuchar la máquina de estados y descarta la carrera', () => {
  const { machine, session } = createSession();
  machine.openSelection();
  machine.startRace();
  session.dispose();
  assert.equal(session.race, null);
  machine.beginCountdown();
  machine.startGo();
  machine.finishRace();
  machine.backToMenu();
  machine.openSelection();
  machine.startRace();
  assert.equal(session.race, null);
});

test('main.js no decide transiciones ni crea o descarta la carrera: lo hace la sesión', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /beginCountdown|startGo|finishRace|createRace|stepRace/);
  assert.match(source, /new RaceSession\(/);
});
