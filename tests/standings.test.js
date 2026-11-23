import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { compareParticipants, positionOf, rankParticipants, standingsOf } from '../src/logic/standings.js';
import { createRace, stepRace } from '../src/logic/race.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createSeededRandom } from '../src/logic/random.js';
import { pointAtDistance } from '../src/logic/track.js';

const DT = 1 / 60;
const IDLE = { accelerate: false, brake: false, left: false, right: false };
const MAX_STEPS = 60 * 600;

/** Participante sintético con los campos que usa la clasificación. */
function fake(id, gridIndex, { progress = 0, finished = false, finishTime = null } = {}) {
  return { id, gridIndex, finished, finishTime, progress: { progress } };
}

/** Entradas de un piloto automático sencillo que sigue la línea central. */
function autopilot(race, participant) {
  const target = pointAtDistance(race.track, participant.progress.lapPosition + 15);
  const wanted = Math.atan2(target.x - participant.x, target.z - participant.z);
  const error = Math.atan2(Math.sin(wanted - participant.heading), Math.cos(wanted - participant.heading));
  return { accelerate: participant.speed < 22, brake: false, left: error > 0.05, right: error < -0.05 };
}

/** Carrera de dos participantes: `ahead` en el hueco 0 y `behind` en el 1 (uno de ellos es el jugador). */
function duel(playerAhead) {
  const player = { id: 'player', name: 'Jugador', isPlayer: true };
  const rival = { id: 'rival', name: 'Rival' };
  return createRace(CONFIG, playerAhead ? [player, rival] : [rival, player], CONFIG.tracks.defaultId, 3);
}

const ids = (race) => race.participants.map((p) => p.id);

test('orden por progreso: más vueltas y más distancia van por delante (RF-023)', () => {
  const list = [fake('a', 0, { progress: 100 }), fake('b', 1, { progress: 900 }), fake('c', 2, { progress: 500 })];
  assert.deepEqual(rankParticipants(list).map((p) => p.id), ['b', 'c', 'a']);
  // Una vuelta completa de más pesa más que cualquier distancia de la vuelta actual.
  const length = createRace(CONFIG).track.length;
  const twoLaps = fake('x', 0, { progress: 2 * length + 5 });
  const oneLap = fake('y', 1, { progress: length + (length - 5) });
  assert.deepEqual(rankParticipants([oneLap, twoLaps]).map((p) => p.id), ['x', 'y']);
});

test('adelantamiento: si dos participantes intercambian el progreso, intercambian la posición (RF-030)', () => {
  const a = fake('a', 0, { progress: 300 });
  const b = fake('b', 1, { progress: 200 });
  assert.deepEqual(rankParticipants([a, b]).map((p) => p.id), ['a', 'b']);
  a.progress = { progress: 200 };
  b.progress = { progress: 300 };
  assert.deepEqual(rankParticipants([a, b]).map((p) => p.id), ['b', 'a']);
});

test('los que han terminado van por delante de los demás y se ordenan por su instante de llegada (RN-02)', () => {
  const list = [
    fake('lejos', 0, { progress: 99999 }), // sin terminar, aunque con mucho progreso
    fake('tarde', 1, { finished: true, finishTime: 130.5, progress: 3000 }),
    fake('primero', 2, { finished: true, finishTime: 120.25, progress: 3000 }),
    fake('medio', 3, { progress: 10 }),
  ];
  assert.deepEqual(rankParticipants(list).map((p) => p.id), ['primero', 'tarde', 'lejos', 'medio']);
});

test('desempate determinista por hueco de parrilla, sin depender del orden de entrada', () => {
  const list = [
    fake('c', 2, { progress: 50 }),
    fake('a', 0, { progress: 50 }),
    fake('b', 1, { progress: 50 }),
    fake('f2', 4, { finished: true, finishTime: 100 }),
    fake('f1', 3, { finished: true, finishTime: 100 }),
  ];
  const expected = ['f1', 'f2', 'a', 'b', 'c'];
  assert.deepEqual(rankParticipants(list).map((p) => p.id), expected);
  assert.deepEqual(rankParticipants([...list].reverse()).map((p) => p.id), expected);
  assert.deepEqual(rankParticipants(rankParticipants(list)).map((p) => p.id), expected, 'estable al repetir');
  assert.equal(compareParticipants(list[0], list[0]), 0);
});

test('rankParticipants no modifica la lista recibida', () => {
  const list = [fake('a', 0, { progress: 1 }), fake('b', 1, { progress: 2 })];
  rankParticipants(list);
  assert.deepEqual(list.map((p) => p.id), ['a', 'b']);
});

test('antes de la salida la clasificación es el orden de la parrilla, con el jugador en su hueco (RF-016)', () => {
  const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId: 'sierra', laps: 3 }, createSeededRandom(1));
  assert.equal(race.standings.length, CONFIG.race.maxParticipants);
  assert.deepEqual(race.standings, ids(race), 'misma lista que la parrilla');
  assert.equal(positionOf(race, 'player'), CONFIG.grid.playerSlotIndex + 1);
  assert.throws(() => positionOf(race, 'nadie'), /desconocido/);
});

test('durante una carrera hay siempre diez entradas únicas y coherentes con el progreso (RF-016, RF-023)', () => {
  const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId: 'ribera', laps: 1 }, createSeededRandom(7));
  const all = new Set(ids(race));
  for (let step = 0; step < 60 * 40; step++) {
    stepRace(race, { player: autopilot(race, race.player) }, DT, CONFIG);
    assert.equal(race.standings.length, 10);
    assert.deepEqual(new Set(race.standings), all, 'las diez entradas, sin repetidos');
    assert.deepEqual(race.standings, standingsOf(race), 'la clasificación guardada es la actual');
  }
  const byId = Object.fromEntries(race.participants.map((p) => [p.id, p]));
  for (let i = 1; i < race.standings.length; i++) {
    const ahead = byId[race.standings[i - 1]];
    const behind = byId[race.standings[i]];
    if (ahead.finished && behind.finished) assert.ok(ahead.finishTime <= behind.finishTime, 'llegada más temprana, más adelante');
    else if (!ahead.finished) assert.ok(ahead.progress.progress >= behind.progress.progress, 'más progreso, más adelante');
    else assert.equal(behind.finished, false, 'un llegado nunca va detrás de uno que no ha llegado');
  }
});

test('el jugador adelanta a un rival en la pista y el orden cambia (RF-030)', () => {
  const race = duel(false); // rival delante, parado; el jugador sale detrás
  assert.equal(positionOf(race, 'player'), 2);
  const positions = new Set();
  for (let step = 0; step < MAX_STEPS && positionOf(race, 'player') === 2; step++) {
    stepRace(race, { rival: IDLE, player: autopilot(race, race.player) }, DT, CONFIG);
    // La posición cambia justo cuando el progreso del jugador supera al del rival, no antes.
    const ahead = race.player.progress.progress > race.participants[0].progress.progress;
    assert.equal(positionOf(race, 'player') === 1, ahead);
    positions.add(positionOf(race, 'player'));
  }
  assert.equal(positionOf(race, 'player'), 1, 'el jugador acaba por delante');
  assert.equal(positionOf(race, 'rival'), 2);
  assert.deepEqual([...positions].sort(), [1, 2]);
});

test('un rival adelanta al jugador y la posición del jugador empeora (RF-030)', () => {
  const race = duel(true); // jugador delante, parado; el rival sale detrás
  assert.equal(positionOf(race, 'player'), 1);
  for (let step = 0; step < MAX_STEPS && positionOf(race, 'player') === 1; step++) {
    stepRace(race, { player: IDLE, rival: autopilot(race, race.participants[1]) }, DT, CONFIG);
  }
  assert.equal(positionOf(race, 'player'), 2);
  assert.equal(positionOf(race, 'rival'), 1);
});

test('saltarse checkpoints o retroceder no mejora la posición (RF-030, RN-01)', () => {
  const race = duel(false); // el rival sale delante y conduce bien; el jugador intenta atajar
  const { track } = race;
  // Fase 1: ambos cruzan la meta de salida.
  for (let step = 0; step < MAX_STEPS && !race.player.progress.started; step++) {
    stepRace(race, { rival: autopilot(race, race.participants[0]), player: autopilot(race, race.player) }, DT, CONFIG);
  }
  assert.ok(race.player.progress.started);
  // Fase 2: el jugador se teletransporta a media vuelta, sin pasar por los checkpoints.
  const shortcut = pointAtDistance(track, track.length * 0.6);
  race.player.x = shortcut.x;
  race.player.z = shortcut.z;
  race.player.speed = 0;
  let rivalMinusPlayer = 0;
  for (let step = 0; step < 60 * 30; step++) {
    stepRace(race, { rival: autopilot(race, race.participants[0]), player: IDLE }, DT, CONFIG);
    rivalMinusPlayer = race.participants[0].progress.progress - race.player.progress.progress;
  }
  assert.ok(race.player.progress.progress <= track.checkpoints[race.player.progress.checkpointIndex].distance, 'tope del siguiente checkpoint');
  assert.ok(race.player.progress.progress < track.length * 0.6, 'el atajo no da progreso');
  assert.equal(race.player.progress.laps, 0);
  assert.ok(rivalMinusPlayer > 0, 'el rival, que sí cruza los checkpoints, sigue por delante');
  assert.equal(positionOf(race, 'player'), 2);

  // Retroceder tampoco mejora: el progreso del jugador no sube con la marcha atrás.
  const before = race.player.progress.progress;
  for (let step = 0; step < 60 * 5; step++) {
    stepRace(race, { rival: IDLE, player: { ...IDLE, brake: true } }, DT, CONFIG);
  }
  assert.ok(race.player.progress.progress <= before, 'la marcha atrás no suma progreso');
  assert.equal(positionOf(race, 'player'), 2);
});

test('los llegados quedan por delante en todo momento y en el orden real de llegada (RN-02, RF-027)', () => {
  const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId: 'llanura', laps: 1 }, createSeededRandom(3));
  const arrivals = [];
  let steps = 0;
  while (arrivals.length < 9 && steps++ < MAX_STEPS) {
    const result = stepRace(race, {}, DT, CONFIG); // el jugador queda quieto en la parrilla
    arrivals.push(...result.finished);
    const finishedCount = race.participants.filter((p) => p.finished).length;
    const byId = Object.fromEntries(race.participants.map((p) => [p.id, p]));
    const order = race.standings.map((id) => byId[id]);
    // Los llegados forman el principio de la lista y, entre ellos, van por instante de llegada.
    assert.ok(order.slice(0, finishedCount).every((p) => p.finished));
    assert.ok(order.slice(finishedCount).every((p) => !p.finished));
    assert.deepEqual(race.standings.slice(0, arrivals.length), arrivals, 'el orden de llegada se conserva');
  }
  assert.ok(arrivals.length >= 1, 'algún rival termina');
  assert.equal(race.player.finished, false);
  assert.equal(positionOf(race, 'player') > arrivals.length, true);
  const times = race.standings.slice(0, arrivals.length).map((id) => race.participants.find((p) => p.id === id).finishTime);
  assert.deepEqual([...times].sort((a, b) => a - b), times, 'por tiempo real de llegada creciente');
});
