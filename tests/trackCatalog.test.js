import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../src/config/config.js';
import {
  buildTrack, crossesGateForward, forwardOf, gridSlot, isOnRoad, nearestOnCenterline, pointAtDistance, rightOf,
} from '../src/logic/track.js';
import { createProgress, stepProgress } from '../src/logic/progress.js';
import {
  countCurves, findTrackDefinition, requireTrackDefinition, trackDefinitions, trackSummaries, trackSummary,
} from '../src/logic/trackCatalog.js';

const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const definitions = trackDefinitions(CONFIG);
const tracks = definitions.map((definition) => buildTrack(definition));
const EXPECTED_DIFFICULTIES = ['veryEasy', 'easy', 'medium', 'hard'];

/** Punto a `distance` de la meta y `lateral` metros a la derecha de la línea central. */
function at(track, distance, lateral = 0) {
  const p = pointAtDistance(track, distance);
  const right = rightOf(p.heading);
  return { x: p.x + right.x * lateral, z: p.z + right.z * lateral };
}

/** Recorre la línea central de `from` a `to` (metros) en pasos de 1 m, con una desviación lateral opcional. */
function drive(state, track, from, to, lateral = 0) {
  let current = state;
  for (let d = from + 1; d <= to + 1e-9; d += 1) current = stepProgress(current, track, at(track, d, lateral));
  return current;
}

test('hay exactamente cuatro circuitos con identificador y nombre únicos (RF-004)', () => {
  assert.equal(definitions.length, 4);
  assert.equal(new Set(definitions.map((d) => d.id)).size, 4);
  assert.equal(new Set(definitions.map((d) => d.name)).size, 4);
  for (const definition of definitions) assert.match(definition.id, /^[a-z]+$/);
  assert.ok(findTrackDefinition(CONFIG, CONFIG.tracks.defaultId));
});

test('las cuatro dificultades aparecen una vez cada una y todas tienen etiqueta (RF-005)', () => {
  assert.deepEqual(definitions.map((d) => d.difficulty), EXPECTED_DIFFICULTIES);
  for (const difficulty of EXPECTED_DIFFICULTIES) {
    assert.ok(CONFIG.ui.trackSelection.difficultyLabels[difficulty].length > 0);
  }
  const labels = Object.values(CONFIG.ui.trackSelection.difficultyLabels);
  assert.equal(new Set(labels).size, 4);
  assert.deepEqual(labels, ['Muy fácil', 'Fácil', 'Medio', 'Difícil']);
});

test('los circuitos solo tienen datos de trazado: la dificultad no depende del coche (RN-07, RF-031)', () => {
  for (const circuit of CONFIG.tracks.circuits) {
    assert.deepEqual(
      Object.keys(circuit).sort(),
      ['checkpointCount', 'controlPoints', 'difficulty', 'id', 'name', 'width'],
    );
  }
  for (const key of Object.keys(CONFIG.tracks.common)) assert.doesNotMatch(key, /speed|accel|steer|brake|grip/i);
});

test('los cuatro circuitos tienen longitudes distintas y más curvas cuanto mayor es la dificultad (RF-014)', () => {
  const summaries = trackSummaries(CONFIG);
  const lengths = summaries.map((s) => s.length);
  const curves = summaries.map((s) => s.curves);
  assert.equal(new Set(lengths.map((length) => Math.round(length))).size, 4);
  assert.equal(new Set(curves).size, 4);
  for (let i = 1; i < summaries.length; i++) {
    assert.ok(lengths[i] > lengths[i - 1], `longitud ${summaries[i].id}`);
    assert.ok(curves[i] > curves[i - 1], `curvas ${summaries[i].id}`);
  }
  // Los datos del resumen coinciden con el trazado construido.
  assert.equal(trackSummary(CONFIG, 'sierra').length, tracks[2].length);
  assert.equal(trackSummary(CONFIG, 'sierra').width, 14);
});

test('countCurves cuenta tramos de giro sostenido y separa una chicane en dos curvas', () => {
  const detection = CONFIG.tracks.curveDetection;
  const base = requireTrackDefinition(CONFIG, 'llanura');
  // Un rectángulo redondeado muy estirado: dos giros de 180 grados.
  assert.equal(countCurves(buildTrack(base), detection), 2);
  // Una recta con una chicane: una curva a cada lado.
  const chicane = {
    ...base,
    controlPoints: [[0, 0], [100, 0], [160, 30], [220, -30], [280, 0], [380, 0], [380, 200], [0, 200]],
  };
  assert.ok(countCurves(buildTrack(chicane), detection) >= 4);
});

test('pedir un circuito desconocido devuelve undefined y requireTrackDefinition lanza un error', () => {
  assert.equal(findTrackDefinition(CONFIG, 'inexistente'), undefined);
  assert.throws(() => requireTrackDefinition(CONFIG, 'inexistente'), /Circuito desconocido/);
});

for (const track of tracks) {
  const label = `${track.id}:`;
  const count = track.checkpoints.length;
  const grid = () => createProgress(track, at(track, -8));

  test(`${label} el trazado es cerrado y se enlaza en la meta (RF-014)`, () => {
    const points = track.points;
    const closing = Math.hypot(points[0].x - points.at(-1).x, points[0].z - points.at(-1).z);
    assert.ok(closing > 0 && closing < (track.length / points.length) * 2, `tramo de cierre ${closing}`);
    assert.ok(angleDiff(track.headings.at(-1), track.headings[0]) < 0.2, 'el rumbo da un salto en la meta');
    const back = pointAtDistance(track, track.length);
    assert.ok(Math.hypot(back.x - track.finish.x, back.z - track.finish.z) < 1e-6);
    assert.ok(track.length > 0 && track.width > 0);
  });

  test(`${label} el circuito no se solapa consigo mismo`, () => {
    const minArc = track.width * 3;
    const n = track.points.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const arc = Math.min(track.starts[j] - track.starts[i], track.length - (track.starts[j] - track.starts[i]));
        if (arc < minArc) continue;
        const distance = Math.hypot(track.points[i].x - track.points[j].x, track.points[i].z - track.points[j].z);
        // Las puertas sobresalen del borde: otro tramo no debe quedar al alcance de una puerta.
        assert.ok(distance > track.width / 2 + track.finish.halfWidth, `puntos ${i} y ${j} a ${distance} m`);
      }
    }
  });

  test(`${label} la parrilla queda dentro de la calzada y orientada en el sentido de la carrera`, () => {
    const halfCar = Math.hypot(CONFIG.race.car.width / 2, CONFIG.race.car.length / 2);
    for (let index = 0; index < CONFIG.race.maxParticipants; index++) {
      const slot = gridSlot(track, CONFIG.grid, index);
      assert.ok(isOnRoad(track, slot.x, slot.z, halfCar), `hueco ${index} fuera de la calzada`);
      const { along } = nearestOnCenterline(track, slot.x, slot.z);
      assert.ok(along < track.length, 'el hueco queda antes de la meta');
      // El rumbo coincide con el de la línea central en ese punto y con el de la meta.
      assert.ok(angleDiff(slot.heading, pointAtDistance(track, along).heading) < 0.05, `rumbo del hueco ${index}`);
      assert.ok(angleDiff(slot.heading, track.finish.heading) < 0.2, `rumbo respecto a la meta ${index}`);
      assert.ok(forwardOf(slot.heading).x * forwardOf(track.finish.heading).x
        + forwardOf(slot.heading).z * forwardOf(track.finish.heading).z > 0.97);
    }
  });

  test(`${label} los checkpoints están en orden a lo largo de la vuelta y cubren la calzada`, () => {
    assert.ok(count >= 1);
    for (let i = 0; i < count; i++) {
      const gate = track.checkpoints[i];
      assert.equal(gate.index, i);
      assert.ok(gate.distance > 0 && gate.distance < track.length);
      if (i > 0) assert.ok(gate.distance > track.checkpoints[i - 1].distance);
      assert.ok(gate.halfWidth >= track.width / 2);
      assert.ok(nearestOnCenterline(track, gate.x, gate.z).distance < 1e-6);
    }
    assert.equal(track.finish.distance, 0);
  });

  test(`${label} recorrer la línea central completa suma exactamente una vuelta válida (RN-01, CA-02)`, () => {
    let state = grid();
    assert.equal(state.laps, 0);
    for (let i = 0; i < count; i++) {
      state = drive(state, track, i === 0 ? -8 : track.checkpoints[i - 1].distance, track.checkpoints[i].distance + 1);
      assert.equal(state.checkpointIndex, i + 1, `checkpoint ${i}`);
      assert.equal(state.laps, 0);
    }
    state = drive(state, track, track.checkpoints[count - 1].distance + 1, track.length + 20);
    assert.equal(state.laps, 1);
    assert.equal(state.checkpointIndex, 0);
    // Otra vuelta entera suma otra más, no más.
    state = drive(state, track, track.length + 20, 2 * track.length + 20);
    assert.equal(state.laps, 2);
  });

  test(`${label} saltarse un checkpoint no suma la vuelta (RN-01, CA-02)`, () => {
    const margin = CONFIG.tracks.common.checkpointMargin;
    const outside = track.width / 2 + margin + 30;
    for (let skipped = 0; skipped < count; skipped++) {
      const gate = track.checkpoints[skipped].distance;
      let state = drive(grid(), track, -8, gate - 5);
      // Rodea el checkpoint por fuera de su puerta y vuelve a la calzada.
      state = stepProgress(state, track, at(track, gate - 4, outside));
      state = stepProgress(state, track, at(track, gate + 4, outside));
      state = drive(state, track, gate + 4, track.length + 20);
      assert.equal(state.laps, 0, `checkpoint ${skipped} omitido`);
      assert.equal(state.checkpointIndex, skipped);
    }
  });

  test(`${label} ninguna puerta de checkpoint se cruza desde otro tramo del circuito`, () => {
    // Un coche que recorre la línea central solo cruza cada puerta una vez por vuelta y en orden.
    const gates = [track.finish, ...track.checkpoints];
    const crossings = gates.map(() => 0);
    let previous = at(track, 0.5 - track.length);
    for (let d = 0.5 - track.length + 1; d <= 1.5; d += 1) {
      const next = at(track, d);
      gates.forEach((gate, i) => {
        if (crossesGateForward(gate, previous, next)) crossings[i]++;
      });
      previous = next;
    }
    assert.deepEqual(crossings, gates.map(() => 1));
  });
}

test('la carrera se puede crear en cada circuito y la parrilla es la de ese circuito', async () => {
  const { createRace } = await import('../src/logic/race.js');
  for (const definition of definitions) {
    const race = createRace(CONFIG, undefined, definition.id);
    assert.equal(race.track.id, definition.id);
    assert.equal(race.track.name, definition.name);
    const slot = gridSlot(race.track, CONFIG.grid, 0);
    assert.equal(race.player.x, slot.x);
    assert.equal(race.player.z, slot.z);
  }
  assert.equal(createRace(CONFIG).track.id, CONFIG.tracks.defaultId);
  assert.throws(() => createRace(CONFIG, undefined, 'inexistente'), /Circuito desconocido/);
});

test('la lógica del catálogo de circuitos no usa persistencia ni depende del renderizado (RF-060, RNF-05)', async () => {
  for (const file of ['logic/trackCatalog.js', 'ui/trackSelectionScreen.js', 'ui/optionSelectionScreen.js']) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest/);
  }
  const catalog = await readFile(new URL('../src/logic/trackCatalog.js', import.meta.url), 'utf8');
  assert.doesNotMatch(catalog, /from\s+['"][^'"]*(three|render\/|ui\/)/);
});
