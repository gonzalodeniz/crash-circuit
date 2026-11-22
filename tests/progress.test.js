import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import { buildTrack, crossesGateForward, pointAtDistance, rightOf } from '../src/logic/track.js';
import { createProgress, currentLap, lapCounterText, stepProgress } from '../src/logic/progress.js';
import { createRace, stepRace } from '../src/logic/race.js';

const track = buildTrack(CONFIG.track);
const count = track.checkpoints.length;

/** Punto a `distance` de la meta y `lateral` metros a la derecha de la línea central. */
function at(distance, lateral = 0) {
  const p = pointAtDistance(track, distance);
  const right = rightOf(p.heading);
  return { x: p.x + right.x * lateral, z: p.z + right.z * lateral };
}

/** Recorre posiciones de la línea central de `from` a `to` (metros, con signo) en pasos de 1 m. */
function drive(state, from, to, lateral = 0, step = 1) {
  const sign = Math.sign(to - from) || 1;
  let current = state;
  for (let d = from + sign * step; sign * d <= sign * to + 1e-9; d += sign * step) {
    current = stepProgress(current, track, at(d, lateral));
  }
  return current;
}

/** Progreso de un coche en la parrilla, ya detrás de la meta. */
const grid = () => createProgress(track, at(-8));

test('el circuito tiene checkpoints invisibles secuenciales y una meta como datos de lógica (RF-022)', () => {
  assert.equal(count, CONFIG.track.checkpointCount);
  assert.ok(count >= 1);
  const distances = track.checkpoints.map((c) => c.distance);
  for (let i = 0; i < count; i++) {
    assert.equal(track.checkpoints[i].index, i);
    assert.ok(distances[i] > 0 && distances[i] < track.length);
    if (i > 0) assert.ok(distances[i] > distances[i - 1]);
    // Cada checkpoint está sobre la línea central y cubre la calzada entera.
    const p = pointAtDistance(track, distances[i]);
    assert.ok(Math.hypot(p.x - track.checkpoints[i].x, p.z - track.checkpoints[i].z) < 1e-9);
    assert.ok(track.checkpoints[i].halfWidth >= track.width / 2);
  }
  assert.equal(track.finish.distance, 0);
  assert.throws(() => buildTrack({ ...CONFIG.track, checkpointCount: 0 }), /checkpoint/);
});

test('crossesGateForward solo cuenta el cruce hacia delante y dentro de la anchura de la puerta', () => {
  const gate = track.finish;
  assert.equal(crossesGateForward(gate, at(-1), at(1)), true);
  assert.equal(crossesGateForward(gate, at(1), at(-1)), false); // hacia atrás
  assert.equal(crossesGateForward(gate, at(-3), at(-1)), false); // sin llegar
  assert.equal(crossesGateForward(gate, at(-1, gate.halfWidth + 5), at(1, gate.halfWidth + 5)), false); // por fuera
});

test('el progreso inicial de la parrilla es negativo: falta recorrer hasta la meta', () => {
  const state = grid();
  assert.equal(state.started, false);
  assert.equal(state.laps, 0);
  assert.ok(Math.abs(state.progress + 8) < 0.01);
});

test('una vuelta completa en orden suma exactamente una vuelta', () => {
  let state = grid();
  state = drive(state, -8, track.length + 20);
  assert.equal(state.laps, 1);
  assert.equal(state.checkpointIndex, 0);
  assert.ok(state.progress > track.length);
});

test('los checkpoints se cuentan en orden durante la vuelta', () => {
  let state = drive(grid(), -8, 5);
  assert.equal(state.started, true);
  assert.equal(state.checkpointIndex, 0);
  for (let i = 0; i < count; i++) {
    const target = track.checkpoints[i].distance;
    state = drive(state, i === 0 ? 5 : track.checkpoints[i - 1].distance + 1, target + 1);
    assert.equal(state.checkpointIndex, i + 1);
    assert.equal(state.laps, 0);
  }
});

test('cruzar la meta saltándose un checkpoint no suma vuelta (CA-02)', () => {
  for (let skipped = 0; skipped < count; skipped++) {
    const gate = track.checkpoints[skipped].distance;
    let state = drive(grid(), -8, gate - 5);
    // Rodea el checkpoint por fuera de la puerta y vuelve a la calzada.
    const outside = track.width / 2 + CONFIG.track.checkpointMargin + 30;
    state = stepProgress(state, track, at(gate - 4, outside));
    state = stepProgress(state, track, at(gate + 4, outside));
    state = drive(state, gate + 4, track.length + 20);
    assert.equal(state.laps, 0, `checkpoint ${skipped} omitido`);
    assert.equal(state.checkpointIndex, skipped);
  }
});

test('el progreso no supera el siguiente checkpoint pendiente aunque se recorte', () => {
  const gate = track.checkpoints[2].distance;
  const outside = track.width / 2 + CONFIG.track.checkpointMargin + 30;
  let state = drive(grid(), -8, gate - 5);
  state = stepProgress(state, track, at(gate - 4, outside));
  state = stepProgress(state, track, at(gate + 100, outside));
  assert.ok(state.lapDistance <= gate + 1e-9);
  assert.ok(state.progress <= gate + 1e-9);
});

test('cruzar los checkpoints fuera de orden no los valida', () => {
  // Salta del checkpoint 0 al 2 por la calzada sin pasar por el 1 (teletransporte con cruce de la puerta 2).
  let state = drive(grid(), -8, track.checkpoints[0].distance + 1);
  assert.equal(state.checkpointIndex, 1);
  state = stepProgress(state, track, at(track.checkpoints[2].distance - 1));
  state = stepProgress(state, track, at(track.checkpoints[2].distance + 1));
  assert.equal(state.checkpointIndex, 1);
});

test('cruzar la meta hacia atrás y otra vez hacia delante no suma vueltas ficticias', () => {
  let state = drive(grid(), -8, track.length + 20);
  assert.equal(state.laps, 1);
  const before = state.progress;
  // Vuelve atrás sobre la meta y la cruza de nuevo hacia delante, varias veces.
  for (let i = 0; i < 4; i++) {
    state = drive(state, track.length + 20, track.length - 20);
    state = drive(state, track.length - 20, track.length + 20);
  }
  assert.equal(state.laps, 1);
  assert.ok(state.progress >= before);
  // Solo puede ganar lo que le faltaba hasta la posición real más avanzada (menos de un paso de 1 m).
  assert.ok(state.progress < before + 1, 'el progreso no crece por zigzaguear');
});

test('zigzaguear sobre la meta antes de completar la vuelta no suma vueltas', () => {
  let state = drive(grid(), -8, 15);
  for (let i = 0; i < 5; i++) {
    state = drive(state, 15, -15);
    state = drive(state, -15, 15);
  }
  assert.equal(state.laps, 0);
  assert.equal(state.checkpointIndex, 0);
});

test('en la meta final, retroceder y volver a cruzar suma una sola vuelta', () => {
  let state = drive(grid(), -8, track.length - 5);
  assert.equal(state.checkpointIndex, count);
  for (let i = 0; i < 3; i++) {
    state = drive(state, track.length - 5, track.length - 30);
    state = drive(state, track.length - 30, track.length - 5);
  }
  assert.equal(state.laps, 0);
  state = drive(state, track.length - 5, track.length + 10);
  assert.equal(state.laps, 1);
  state = drive(state, track.length + 10, track.length - 10);
  state = drive(state, track.length - 10, track.length + 10);
  assert.equal(state.laps, 1);
});

test('la marcha atrás y el retroceso no aumentan el progreso', () => {
  let state = drive(grid(), -8, 100);
  const peak = state.progress;
  state = drive(state, 100, 40);
  assert.equal(state.progress, peak);
  state = drive(state, 40, 99); // vuelve hasta donde estaba: aún sin ganar nada
  assert.equal(state.progress, peak);
  state = drive(state, 99, 130);
  assert.ok(state.progress > peak);
  assert.ok(Math.abs(state.progress - 130) < 1, 'ahora sí avanza con el coche');
});

test('el progreso crece de forma monótona al avanzar y es comparable entre vueltas', () => {
  let state = grid();
  let previous = state.progress;
  const sample = [];
  for (let d = -7; d <= track.length * 2 + 10; d += 1) {
    state = stepProgress(state, track, at(d));
    assert.ok(state.progress >= previous - 1e-9, `retrocede en ${d}`);
    previous = state.progress;
    sample.push(state.progress);
  }
  assert.equal(state.laps, 2);
  // Un coche con más distancia recorrida tiene más progreso que otro con menos.
  const ahead = drive(grid(), -8, 300);
  const behind = drive(grid(), -8, 200);
  assert.ok(ahead.progress > behind.progress);
  // Una vuelta más pesa más que cualquier distancia de la vuelta anterior.
  const lapTwo = drive(grid(), -8, track.length + 5);
  const nearEnd = drive(grid(), -8, track.length - 5);
  assert.ok(lapTwo.progress > nearEnd.progress);
});

test('el contador de vueltas del HUD es correcto en cada tramo, incluida la última', () => {
  const total = 3;
  const label = CONFIG.ui.hud.lapLabel;
  let state = grid();
  assert.equal(lapCounterText(label, state, total), `${label} 1/3`);
  state = drive(state, -8, track.checkpoints[count - 1].distance + 1);
  assert.equal(lapCounterText(label, state, total), `${label} 1/3`);
  state = drive(state, track.checkpoints[count - 1].distance + 1, track.length + 5);
  assert.equal(lapCounterText(label, state, total), `${label} 2/3`);
  state = drive(state, track.length + 5, track.length * 2 + 5);
  assert.equal(lapCounterText(label, state, total), `${label} 3/3`);
  assert.equal(state.checkpointIndex, 0);
  // En la última vuelta, tras el último checkpoint, sigue siendo la 3/3 hasta cruzar la meta.
  state = drive(state, track.length * 2 + 5, track.length * 3 - 5);
  assert.equal(currentLap(state, total), 3);
  state = drive(state, track.length * 3 - 5, track.length * 3 + 5);
  assert.equal(state.laps, 3);
  assert.equal(lapCounterText(label, state, total), `${label} 3/3`); // no pasa de 3/3
});

test('la carrera lee el total de vueltas de la configuración', () => {
  const race = createRace(CONFIG);
  assert.equal(race.totalLaps, CONFIG.race.laps);
  assert.equal(createRace({ ...CONFIG, race: { ...CONFIG.race, laps: 5 } }).totalLaps, 5);
  assert.equal(race.player.progress.laps, 0);
});

test('conduciendo de verdad con stepRace, el progreso sigue al coche y completa una vuelta', () => {
  const race = createRace(CONFIG);
  const dt = 1 / 60;
  const idle = { accelerate: false, brake: false, left: false, right: false };
  // Cuenta atrás: el coche no avanza ni gana progreso.
  const initialProgress = race.player.progress.progress;
  for (let t = 0; race.clock.phase === 'COUNTDOWN'; t += dt) {
    stepRace(race, { player: { ...idle, accelerate: true } }, dt, CONFIG);
  }
  assert.equal(race.player.progress.progress <= initialProgress + 1, true);
  // Piloto automático sencillo: apunta a un punto de la línea central por delante y limita la velocidad.
  let steps = 0;
  while (race.player.progress.laps < 1 && steps < 60 * 300) {
    const p = race.player;
    const nearest = p.progress.lapPosition;
    const target = pointAtDistance(track, nearest + 15);
    const wanted = Math.atan2(target.x - p.x, target.z - p.z);
    const error = Math.atan2(Math.sin(wanted - p.heading), Math.cos(wanted - p.heading));
    const input = {
      accelerate: p.speed < 22,
      brake: false,
      left: error > 0.05,
      right: error < -0.05,
    };
    stepRace(race, { player: input }, dt, CONFIG);
    steps++;
  }
  assert.equal(race.player.progress.laps, 1, 'el coche completa la vuelta con los controles normales');
  assert.equal(race.player.progress.checkpointIndex, 0);
});

test('la lógica de progreso no depende de Three.js ni del DOM', async () => {
  const source = await readFile(new URL('../src/logic/progress.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]three['"]|document\.|window\./);
});
