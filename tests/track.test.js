import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { requireTrackDefinition } from '../src/logic/trackCatalog.js';
import {
  buildTrack, forwardOf, gridSlot, isOnRoad, nearestOnCenterline, pointAtDistance, rightOf, signedDistance, wrapDistance,
} from '../src/logic/track.js';

const track = buildTrack(requireTrackDefinition(CONFIG, CONFIG.tracks.defaultId));
const angleDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

test('el trazado es cerrado: el último tramo enlaza con el primero', () => {
  const count = track.points.length;
  const last = track.points[count - 1];
  const first = track.points[0];
  const closing = Math.hypot(first.x - last.x, first.z - last.z);
  // El tramo de cierre es del mismo orden que los demás (no hay hueco ni salto).
  const average = track.length / count;
  assert.ok(closing > 0 && closing < average * 2, `tramo de cierre ${closing}, media ${average}`);
  // La longitud total incluye el tramo de cierre.
  const summed = track.points.reduce((sum, p, i) => {
    const next = track.points[(i + 1) % count];
    return sum + Math.hypot(next.x - p.x, next.z - p.z);
  }, 0);
  assert.ok(Math.abs(summed - track.length) < 1e-9);
  // El rumbo no da un salto brusco en la unión (curva suave en la meta).
  assert.ok(angleDiff(track.headings[count - 1], track.headings[0]) < 0.2);
  // Recorrer una vuelta completa devuelve a la meta.
  const back = pointAtDistance(track, track.length);
  assert.ok(Math.hypot(back.x - track.finish.x, back.z - track.finish.z) < 1e-6);
});

test('la meta está en el primer punto y su rumbo es el del sentido de la carrera', () => {
  assert.equal(track.finish.x, track.points[0].x);
  assert.equal(track.finish.z, track.points[0].z);
  const next = track.points[1];
  const forward = forwardOf(track.finish.heading);
  const dx = next.x - track.finish.x;
  const dz = next.z - track.finish.z;
  assert.ok((forward.x * dx + forward.z * dz) / Math.hypot(dx, dz) > 0.999);
});

test('el circuito no se solapa consigo mismo', () => {
  const minArc = track.width * 3;
  const count = track.points.length;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const arc = Math.min(track.starts[j] - track.starts[i], track.length - (track.starts[j] - track.starts[i]));
      if (arc < minArc) continue;
      const distance = Math.hypot(track.points[i].x - track.points[j].x, track.points[i].z - track.points[j].z);
      assert.ok(distance > track.width, `puntos ${i} y ${j} a ${distance} m`);
    }
  }
});

test('pointAtDistance recorre la línea central y es cíclico', () => {
  const a = pointAtDistance(track, 100);
  const b = pointAtDistance(track, 100 + track.length);
  const c = pointAtDistance(track, 100 - track.length);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
  assert.ok(Math.hypot(a.x - c.x, a.z - c.z) < 1e-6);
  assert.ok(nearestOnCenterline(track, a.x, a.z).distance < 1e-6);
});

test('wrapDistance normaliza a [0, length): negativos, mayores que length y múltiplos', () => {
  const length = track.length;
  assert.equal(wrapDistance(track, 0), 0);
  assert.ok(Math.abs(wrapDistance(track, 100) - 100) < 1e-9);
  assert.ok(Math.abs(wrapDistance(track, -100) - (length - 100)) < 1e-9);
  assert.ok(Math.abs(wrapDistance(track, length + 100) - 100) < 1e-9);
  assert.ok(Math.abs(wrapDistance(track, 3 * length - 100) - (length - 100)) < 1e-9);
  assert.equal(wrapDistance(track, length), 0);
  assert.equal(wrapDistance(track, -length), 0);
  for (const d of [-2.5 * length, -1, 0, 1, length / 2, length - 1e-9, 7.3 * length]) {
    const w = wrapDistance(track, d);
    assert.ok(w >= 0 && w < length, `wrapDistance(${d}) = ${w} fuera de [0, length)`);
  }
});

test('signedDistance da la distancia con signo en (-length/2, length/2]', () => {
  const length = track.length;
  const half = length / 2;
  assert.equal(signedDistance(track, 0), 0);
  assert.ok(Math.abs(signedDistance(track, 100) - 100) < 1e-9);
  // Más allá de la mitad de la vuelta, la posición queda detrás de la meta (negativa).
  assert.ok(Math.abs(signedDistance(track, length - 100) - -100) < 1e-9);
  assert.ok(Math.abs(signedDistance(track, -100) - -100) < 1e-9);
  // Mayores que length: se normalizan antes.
  assert.ok(Math.abs(signedDistance(track, length + 100) - 100) < 1e-9);
  assert.ok(Math.abs(signedDistance(track, 2 * length - 100) - -100) < 1e-9);
  // La mitad exacta es positiva; justo por debajo de -mitad se pasa al lado positivo.
  assert.equal(signedDistance(track, half), half);
  assert.equal(signedDistance(track, -half), half);
  assert.ok(signedDistance(track, half + 1) < 0);
  assert.ok(signedDistance(track, half - 1) > 0);
  assert.ok(signedDistance(track, -half - 1) > 0);
});

test('isOnRoad distingue calzada y exterior', () => {
  const p = pointAtDistance(track, 50);
  assert.ok(isOnRoad(track, p.x, p.z));
  assert.equal(isOnRoad(track, p.x + 500, p.z + 500), false);
});

test('la posición de parrilla del jugador está dentro de la calzada, con el coche entero', () => {
  const halfCar = Math.hypot(CONFIG.race.car.width / 2, CONFIG.race.car.length / 2);
  for (let index = 0; index < CONFIG.race.maxParticipants; index++) {
    const slot = gridSlot(track, CONFIG.grid, index);
    assert.ok(isOnRoad(track, slot.x, slot.z, halfCar), `hueco ${index} fuera de la calzada`);
  }
});

test('la posición de parrilla mira en el sentido de la carrera y queda antes de la meta', () => {
  const slot = gridSlot(track, CONFIG.grid, 0);
  const { along } = nearestOnCenterline(track, slot.x, slot.z);
  // Detrás de la meta: la distancia recorrida está justo antes de completar la vuelta.
  assert.ok(along > track.length - CONFIG.grid.firstSlotDistance * 2 && along < track.length);
  // El rumbo coincide con el del trazado en ese punto.
  const center = pointAtDistance(track, along);
  assert.ok(angleDiff(slot.heading, center.heading) < 1e-6);
  assert.ok(angleDiff(slot.heading, track.finish.heading) < 0.2);
});

/** Huecos de parrilla de todos los participantes, con la configuración de parrilla indicada. */
function gridSlots(grid) {
  return Array.from({ length: CONFIG.race.maxParticipants }, (_, i) => gridSlot(track, grid, i));
}

/**
 * Pares de huecos cuyos coches (rectángulo de largo × ancho, orientado como el hueco) se solapan:
 * se solapan si su separación longitudinal no supera el largo y la lateral no supera el ancho.
 */
function overlappingPairs(slots, car) {
  const pairs = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const dx = slots[j].x - slots[i].x;
      const dz = slots[j].z - slots[i].z;
      const forward = forwardOf(slots[i].heading);
      const right = rightOf(slots[i].heading);
      const longitudinal = Math.abs(dx * forward.x + dz * forward.z);
      const lateral = Math.abs(dx * right.x + dz * right.z);
      if (longitudinal <= car.length && lateral <= car.width) pairs.push([i, j]);
    }
  }
  return pairs;
}

test('los huecos de parrilla no se solapan', () => {
  const pairs = overlappingPairs(gridSlots(CONFIG.grid), CONFIG.race.car);
  assert.deepEqual(pairs, [], `huecos solapados: ${JSON.stringify(pairs)}`);
});

test('la comprobación de solapamiento detecta filas más juntas que el largo del coche', () => {
  const tooClose = { ...CONFIG.grid, slotSpacing: 3.2 }; // filas a 3,2 m con coches de 4,4 m
  assert.ok(overlappingPairs(gridSlots(tooClose), CONFIG.race.car).length > 0);
});

test('un circuito con menos de 3 puntos de control no es cerrable', () => {
  assert.throws(() => buildTrack({ name: 'x', width: 10, controlPoints: [[0, 0], [1, 1]], samplesPerSegment: 4 }));
});
