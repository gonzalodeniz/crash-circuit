import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { ParticipantStatus, createRace, raceTimeOf, stepRace } from '../src/logic/race.js';
import { buildRaceResults, resultsTexts } from '../src/logic/raceResults.js';
import { createRaceFromSetup, defaultRaceSetup } from '../src/logic/raceSetup.js';
import { positionOf } from '../src/logic/standings.js';
import { createSeededRandom } from '../src/logic/random.js';
import { GO_SIGNAL, countdownSignal, formatRaceTime } from '../src/logic/raceClock.js';
import { pointAtDistance } from '../src/logic/track.js';

const DT = 1 / 60;
const IDLE = { accelerate: false, brake: false, left: false, right: false };
const MAX_STEPS = 60 * 900;

/** Entrada de un piloto automático sencillo que sigue la línea central. */
function autopilot(race) {
  const p = race.player;
  const target = pointAtDistance(race.track, p.progress.lapPosition + 15);
  const wanted = Math.atan2(target.x - p.x, target.z - p.z);
  const error = Math.atan2(Math.sin(wanted - p.heading), Math.cos(wanted - p.heading));
  return { accelerate: p.speed < 22, brake: false, left: error > 0.05, right: error < -0.05 };
}

/** Sesión con la carrera ya en la parrilla, con la selección por defecto y azar con semilla. */
function createSession(seed = 7) {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(seed) });
  const states = [];
  machine.onChange((from, to) => states.push(to));
  machine.openSelection();
  machine.startRace();
  return { machine, session, states };
}

/** Avanza la sesión con las entradas que da `inputsFor` hasta que se cumple `until`. */
function play({ session }, inputsFor, until) {
  let steps = 0;
  while (!until() && steps++ < MAX_STEPS) session.step(DT, inputsFor(session.race));
  assert.ok(until(), 'la condición se cumple dentro del límite de pasos');
}

/** El jugador no hace nada; los rivales conducen solos. */
const playerIdle = () => ({ player: IDLE });
const playerDrives = (race) => ({ player: autopilot(race) });

/** Los rivales no se mueven, así que el jugador es el único que puede terminar. */
function playerAlone(race) {
  const inputs = { player: autopilot(race) };
  for (const participant of race.participants) if (!participant.isPlayer) inputs[participant.id] = IDLE;
  return inputs;
}

test('un rival gana antes que el jugador: se registra con su instante de llegada y el jugador sigue en carrera (RF-024, RN-03, CA-07)', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  play(ctx, playerIdle, () => session.race.winner !== null);
  const race = session.race;
  const { winner } = race;
  const rival = race.participants.find((participant) => participant.id === winner.id);

  assert.equal(winner.isPlayer, false);
  assert.equal(winner.name, rival.name);
  assert.equal(winner.finishTime, rival.finishTime);
  assert.equal(winner.finishTime, race.clock.raceTime, 'el instante de llegada es el cronómetro de ese paso');
  assert.equal(rival.finished, true);
  assert.equal(race.player.finished, false);
  assert.equal(machine.state, GameState.EN_CARRERA, 'el jugador sigue corriendo');
  assert.equal(race.standings[0], winner.id);

  // El cronómetro del jugador sigue y sus controles siguen actuando.
  const timeBefore = raceTimeOf(race, race.player);
  const lapsBefore = race.player.progress.laps;
  for (let i = 0; i < 120; i++) session.step(DT, { player: { ...IDLE, accelerate: true } });
  assert.ok(raceTimeOf(race, race.player) > timeBefore);
  assert.ok(race.player.speed > 0, 'el jugador sigue controlando su coche');
  assert.equal(race.player.progress.laps, lapsBefore);
  assert.equal(machine.state, GameState.EN_CARRERA);
});

test('el jugador pasa a RESULTADOS solo al completar sus vueltas, una vez, y el ganador y las llegadas reales no cambian (RF-027, RF-025)', () => {
  const ctx = createSession();
  const { machine, session, states } = ctx;
  play(ctx, playerIdle, () => session.race.winner !== null);
  const race = session.race;
  const winnerAtStart = race.winner;
  // El jugador conduce hasta terminar; mientras tanto el resto de rivales sigue llegando.
  play(ctx, playerDrives, () => {
    assert.equal(machine.state === GameState.RESULTADOS, race.player.finished, 'resultados solo al terminar el jugador');
    return machine.state === GameState.RESULTADOS;
  });
  assert.equal(states.filter((state) => state === GameState.RESULTADOS).length, 1);
  assert.equal(race.winner, winnerAtStart, 'el ganador no se sobrescribe');

  const arrivedBefore = race.participants.filter((participant) => participant.finished && participant.id !== 'player');
  assert.ok(arrivedBefore.length >= 1);
  const snapshot = new Map(arrivedBefore.map((participant) => [participant.id, participant.finishTime]));

  // La simulación sigue en RESULTADOS: los rivales que llegan después no alteran los tiempos ya registrados.
  for (let i = 0; i < 60 * 120; i++) session.step(DT, playerIdle());
  for (const [id, finishTime] of snapshot) {
    assert.equal(race.participants.find((participant) => participant.id === id).finishTime, finishTime);
  }
  const finishedCount = race.participants.filter((participant) => participant.finished).length;
  assert.ok(finishedCount >= snapshot.size + 1, 'el jugador cuenta como llegado');
  assert.equal(race.winner, winnerAtStart);
  assert.equal(states.filter((state) => state === GameState.RESULTADOS).length, 1);
});

test('los resultados muestran ganador, puesto sobre diez y solo los llegados antes que el jugador, con tiempo real (RF-024, RF-027, RN-02)', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  play(ctx, playerIdle, () => session.race.winner !== null);
  play(ctx, playerDrives, () => machine.state === GameState.RESULTADOS);
  const race = session.race;
  const results = buildRaceResults(race);

  assert.equal(results.winner, race.winner);
  assert.equal(results.playerWon, false);
  assert.equal(results.player.total, 10);
  assert.equal(results.player.position, positionOf(race, 'player'), 'coherente con la clasificación (RN-02)');
  assert.equal(results.player.finishTime, race.player.finishTime);
  assert.equal(results.arrivals.length, results.player.position - 1);
  assert.equal(results.arrivals[0].id, race.winner.id);
  for (const [index, arrival] of results.arrivals.entries()) {
    const participant = race.participants.find((candidate) => candidate.id === arrival.id);
    assert.equal(arrival.position, index + 1);
    assert.equal(arrival.finishTime, participant.finishTime, 'tiempo real, sin recalcular');
    assert.equal(participant.finished, true);
    assert.ok(arrival.finishTime <= race.player.finishTime, 'llegó antes que el jugador');
    if (index > 0) assert.ok(arrival.finishTime >= results.arrivals[index - 1].finishTime);
  }
  assert.ok(!results.arrivals.some((arrival) => arrival.id === 'player'));
  // Nadie aparece sin haber llegado: los rivales aún en pista no están en la lista (E7 los estima).
  for (const participant of race.participants) {
    if (!participant.finished) assert.ok(!results.arrivals.some((arrival) => arrival.id === participant.id));
  }

  const texts = resultsTexts(results, CONFIG.ui.results);
  assert.equal(texts.playerWon, false);
  assert.equal(texts.winnerName, race.winner.name);
  assert.equal(texts.winnerTime, formatRaceTime(race.winner.finishTime));
  assert.equal(texts.positionText, `${results.player.position} de 10`);
  assert.equal(texts.timeText, formatRaceTime(race.player.finishTime));
  assert.equal(texts.arrivals.length, results.arrivals.length);
});

test('si gana el jugador, queda registrado como ganador y los resultados lo indican (RF-024)', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  play(ctx, playerAlone, () => machine.state === GameState.RESULTADOS);
  const race = session.race;
  assert.equal(race.winner.id, 'player');
  assert.equal(race.winner.isPlayer, true);
  assert.equal(race.winner.finishTime, race.player.finishTime);
  const results = buildRaceResults(race);
  assert.equal(results.playerWon, true);
  assert.equal(results.player.position, 1);
  assert.deepEqual(results.arrivals, []);
  const texts = resultsTexts(results, CONFIG.ui.results);
  assert.equal(texts.playerWon, true);
  assert.equal(texts.winnerName, race.player.name);
  assert.equal(texts.positionText, '1 de 10');
});

test('no hay resultados hasta que el jugador termina', () => {
  const ctx = createSession();
  assert.throws(() => buildRaceResults(ctx.session.race), /solo existen cuando el jugador ha terminado/);
});

test('el ganador se registra una sola vez aunque otros terminen después, y con el tiempo real de su paso', () => {
  const race = createRaceFromSetup(CONFIG, defaultRaceSetup(CONFIG), createSeededRandom(3));
  assert.equal(race.winner, null);
  const winners = [];
  let steps = 0;
  while (race.participants.filter((participant) => participant.finished).length < 3 && steps++ < MAX_STEPS) {
    stepRace(race, { player: IDLE }, DT, CONFIG);
    if (race.winner && winners.at(-1) !== race.winner) winners.push(race.winner);
  }
  assert.equal(winners.length, 1);
  const finishers = race.participants.filter((participant) => participant.finished);
  const earliest = Math.min(...finishers.map((participant) => participant.finishTime));
  assert.equal(race.winner.finishTime, earliest);
  assert.throws(() => {
    'use strict';
    race.winner.id = 'otro';
  }, TypeError, 'el registro del ganador está congelado');
});

test('repetir reinicia ganador, llegadas, tiempos y posiciones de los diez participantes (RF-057)', () => {
  const ctx = createSession();
  const { machine, session } = ctx;
  play(ctx, playerIdle, () => session.race.winner !== null);
  play(ctx, playerDrives, () => machine.state === GameState.RESULTADOS);
  const first = session.race;
  assert.ok(first.winner !== null);

  machine.repeatRace();
  const repeated = session.race;
  assert.notEqual(repeated, first);
  assert.equal(repeated.winner, null);
  assert.equal(repeated.participants.length, 10);
  for (const participant of repeated.participants) {
    assert.equal(participant.finished, false);
    assert.equal(participant.finishTime, null);
    assert.equal(participant.progress.laps, 0);
    assert.equal(participant.status, ParticipantStatus.PARRILLA);
  }
  assert.equal(repeated.clock.raceTime, 0);
  assert.deepEqual(repeated.standings, repeated.participants.map((participant) => participant.id));
  assert.ok(first.winner !== null, 'la carrera anterior conserva su resultado');

  // La repetición vuelve a tener su propio ganador y resultados.
  play(ctx, playerAlone, () => machine.state === GameState.RESULTADOS);
  assert.equal(repeated.winner.id, 'player');
  assert.equal(buildRaceResults(repeated).playerWon, true);
});

test('CA-01: con un coche, un circuito y una vuelta: cuenta atrás, salida de los diez, checkpoints, meta, resultados y repetir', () => {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(11) });
  machine.openSelection();
  session.selectCarModel(CONFIG.cars.models[0].id);
  session.selectTrack(CONFIG.tracks.defaultId);
  session.selectLaps(1);
  session.confirmSelection(); // coche
  session.confirmSelection(); // circuito y vueltas
  session.confirmSelection(); // resumen
  assert.equal(machine.state, GameState.PARRILLA);
  const race = session.race;
  assert.equal(race.participants.length, 10);
  assert.equal(race.totalLaps, 1);
  assert.ok(race.track.checkpoints.length > 0);

  // Cuenta atrás 3-2-1 sin moverse, y salida de los diez a la vez.
  const signals = [];
  let steps = 0;
  while (machine.state !== GameState.EN_CARRERA && steps++ < MAX_STEPS) {
    session.step(DT, { player: { ...IDLE, accelerate: true } });
    const signal = countdownSignal(race.clock, CONFIG.race.countdown);
    if (signals.at(-1) !== signal) signals.push(signal);
    if (machine.state === GameState.CUENTA_ATRAS) {
      assert.ok(race.participants.every((participant) => participant.speed === 0));
    }
  }
  assert.deepEqual(signals.slice(0, 3), [3, 2, 1]);
  assert.equal(signals.at(-1), GO_SIGNAL);
  assert.ok(race.participants.every((participant) => participant.status === ParticipantStatus.EN_CARRERA));

  // Checkpoints en orden hasta la meta.
  const checkpointsSeen = new Set();
  play({ machine, session }, (current) => {
    checkpointsSeen.add(current.player.progress.checkpointIndex);
    return { player: autopilot(current) };
  }, () => machine.state === GameState.RESULTADOS);
  for (let index = 0; index <= race.track.checkpoints.length; index++) {
    if (index < race.track.checkpoints.length) assert.ok(checkpointsSeen.has(index), `cruzó el checkpoint ${index}`);
  }
  assert.equal(race.player.progress.laps, 1);
  assert.equal(race.player.finished, true);

  const results = buildRaceResults(race);
  assert.equal(results.player.finishTime, race.player.finishTime);
  assert.ok(results.player.position >= 1 && results.player.position <= 10);

  // Repetir con la misma configuración.
  machine.repeatRace();
  assert.equal(machine.state, GameState.PARRILLA);
  assert.equal(session.race.totalLaps, 1);
  assert.equal(session.race.player.finished, false);
  assert.equal(session.race.winner, null);
  session.step(DT, { player: IDLE });
  assert.equal(machine.state, GameState.CUENTA_ATRAS);
});

test('los textos nuevos de la pantalla salen de CONFIG.ui.results y la pantalla no los fija (RF-056)', async () => {
  for (const key of ['playerWinsMessage', 'winnerLabel', 'positionLabel', 'positionFormat', 'arrivalsTitle']) {
    assert.equal(typeof CONFIG.ui.results[key], 'string', key);
    assert.ok(CONFIG.ui.results[key].length > 0, key);
  }
  const screen = await readFile(new URL('../src/ui/resultsScreen.js', import.meta.url), 'utf8');
  for (const text of [CONFIG.ui.results.winnerLabel, CONFIG.ui.results.arrivalsTitle, CONFIG.ui.results.playerWinsMessage]) {
    assert.ok(!screen.includes(text), `«${text}» no está fijo en la pantalla`);
  }
});

test('una carrera sin rivales la gana el jugador y sus resultados no tienen llegadas anteriores', () => {
  const race = createRace(CONFIG);
  let steps = 0;
  while (!race.player.finished && steps++ < MAX_STEPS) stepRace(race, { player: autopilot(race) }, DT, CONFIG);
  assert.equal(race.winner.id, 'player');
  const results = buildRaceResults(race);
  assert.equal(results.player.total, 1);
  assert.equal(results.player.position, 1);
});
