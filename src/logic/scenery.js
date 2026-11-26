// Límites y obstáculos del escenario (RF-015) como datos de lógica pura: no importa Three.js ni el DOM
// (RNF-05). Los usan las colisiones (`collisions.js`) y el renderizado, que solo los dibuja.
//
// - `bounds`: límite exterior, un rectángulo que rodea todo el circuito (`limitMargin` metros más allá
//   del borde de la calzada en sus puntos extremos).
// - `obstacles`: círculos (`{type, x, z, radius}`) fuera de la calzada. En la definición del circuito se
//   sitúan respecto al trazado, así que siguen en su sitio si cambian sus puntos de control.
import { pointAtDistance, rightOf } from './track.js';

/** Paso (m) con el que se recorre el trazado para colocar los elementos de una fila. */
const ROW_WALK_STEP = 0.1;

/** Punto a `lateral` metros a la derecha (negativo: izquierda) de la línea central en la distancia `along`. */
function offsetPoint(track, along, lateral) {
  const center = pointAtDistance(track, along);
  const right = rightOf(center.heading);
  return { x: center.x + right.x * lateral, z: center.z + right.z * lateral };
}

// Círculos de una entrada de `obstacles`: uno o una fila de `count` que se tocan (una barrera). La fila se
// mide sobre la línea desplazada, no sobre la central, para que no queden huecos en las curvas.
function obstacleRow(track, entry, types) {
  const { type, at, side, gap, count = 1 } = entry;
  const radius = entry.radius ?? types[type]?.radius;
  if (!(radius > 0)) throw new Error(`Tipo de obstáculo desconocido: ${type}`);
  const lateral = side * (track.width / 2 + gap + radius);
  const spacing = 2 * radius;
  let along = at * track.length;
  let last = offsetPoint(track, along, lateral);
  const row = [last];
  while (row.length < count && along < (at + 1) * track.length) {
    along += ROW_WALK_STEP;
    const point = offsetPoint(track, along, lateral);
    const distance = Math.hypot(point.x - last.x, point.z - last.z);
    if (distance < spacing) continue;
    // La línea desplazada da pequeños saltos al cambiar de tramo: se coloca justo a un diámetro del anterior.
    const t = spacing / distance;
    last = { x: last.x + (point.x - last.x) * t, z: last.z + (point.z - last.z) * t };
    row.push(last);
  }
  return row.map(({ x, z }) => Object.freeze({ type, x, z, radius }));
}

/** Rectángulo exterior del circuito: la caja de la línea central ampliada media calzada y `margin`. */
function outerBounds(track, margin) {
  const extra = track.width / 2 + margin;
  const xs = track.points.map((point) => point.x);
  const zs = track.points.map((point) => point.z);
  return Object.freeze({
    minX: Math.min(...xs) - extra,
    maxX: Math.max(...xs) + extra,
    minZ: Math.min(...zs) - extra,
    maxZ: Math.max(...zs) + extra,
  });
}

/**
 * Escenario sólido de un circuito.
 * @param {object} track trazado (`buildTrack`)
 * @param {object} definition definición del circuito (`requireTrackDefinition`): `limitMargin`,
 *   `obstacleTypes` y `obstacles`, cada uno `{type, at, side, gap, count?, radius?}` con `at` la fracción
 *   de la vuelta desde la meta, `side` 1 (derecha) o -1 (izquierda) y `gap` los metros libres entre el
 *   borde de la calzada y el obstáculo
 * @returns {{bounds: {minX: number, maxX: number, minZ: number, maxZ: number},
 *   obstacles: ReadonlyArray<{type: string, x: number, z: number, radius: number}>}}
 */
export function buildScenery(track, definition) {
  const obstacles = (definition.obstacles ?? []).flatMap((entry) => obstacleRow(track, entry, definition.obstacleTypes));
  return Object.freeze({
    bounds: outerBounds(track, definition.limitMargin),
    obstacles: Object.freeze(obstacles),
  });
}
