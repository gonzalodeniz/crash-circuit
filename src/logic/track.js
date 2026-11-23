// Trazado del circuito como dato de lógica pura: no importa Three.js ni el DOM (RNF-05).
// Convenciones: plano XZ con Y hacia arriba. `heading` (rumbo) es el ángulo tal que el
// sentido de avance es (sin heading, cos heading), igual que `rotation.y` en Three.js.
// El sentido de la carrera es el de índices crecientes de la línea central.

/** Vector unitario de avance para un rumbo. */
export function forwardOf(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/** Vector unitario hacia la derecha del piloto (Y hacia arriba) para un rumbo. */
export function rightOf(heading) {
  return { x: -Math.cos(heading), z: Math.sin(heading) };
}

// Catmull-Rom uniforme cerrada: devuelve `samplesPerSegment` puntos por cada tramo entre
// puntos de control. El último tramo enlaza con el primero, sin duplicar el punto inicial.
function sampleClosedCatmullRom(controlPoints, samplesPerSegment) {
  const count = controlPoints.length;
  const points = [];
  for (let i = 0; i < count; i++) {
    const p0 = controlPoints[(i - 1 + count) % count];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % count];
    const p3 = controlPoints[(i + 2) % count];
    for (let step = 0; step < samplesPerSegment; step++) {
      const t = step / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a, b, c, d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      points.push({ x: blend(p0[0], p1[0], p2[0], p3[0]), z: blend(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  return points;
}

/**
 * Construye el trazado a partir de su definición (un circuito de `tracks.circuits` de CONFIG, con los
 * valores de `tracks.common`; véase `requireTrackDefinition`).
 * La línea central es un polígono cerrado: el tramo del último punto al primero existe
 * y es uno más. La meta está en el punto 0 y su rumbo es el del primer tramo.
 */
export function buildTrack(definition) {
  const { id, name, width, controlPoints, samplesPerSegment, checkpointCount, checkpointMargin } = definition;
  if (controlPoints.length < 3) throw new Error('Un circuito cerrado necesita al menos 3 puntos de control');
  if (!(checkpointCount >= 1)) throw new Error('Un circuito necesita al menos 1 checkpoint (RF-022)');
  const points = sampleClosedCatmullRom(controlPoints, samplesPerSegment);
  const count = points.length;

  // `starts[i]` es la distancia recorrida al llegar al punto i; `headings[i]`, el rumbo del tramo i -> i+1.
  const starts = [];
  const headings = [];
  let length = 0;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % count];
    starts.push(length);
    headings.push(Math.atan2(b.x - a.x, b.z - a.z));
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }

  const finish = { x: points[0].x, z: points[0].z, heading: headings[0] };
  const track = { id, name, width, points, starts, headings, length, finish };

  // Puertas de cruce: la meta (distancia 0) y los checkpoints invisibles, en el orden de la carrera.
  // Todas cruzan la calzada en perpendicular a la línea central y sobresalen `checkpointMargin`.
  const halfWidth = width / 2 + checkpointMargin;
  track.finish = { ...finish, distance: 0, halfWidth };
  track.checkpoints = Array.from({ length: checkpointCount }, (_, i) => {
    const distance = (length * (i + 1)) / (checkpointCount + 1);
    return { index: i, distance, ...pointAtDistance(track, distance), halfWidth };
  });
  track.checkpoints.forEach(Object.freeze);
  Object.freeze(track.checkpoints);
  Object.freeze(track.finish);
  return Object.freeze(track);
}

/**
 * Indica si el desplazamiento de `from` a `to` cruza la puerta en el sentido de la carrera
 * (de detrás a delante de su plano) dentro de su anchura. Cruzar hacia atrás no cuenta.
 * @param {{x: number, z: number, heading: number, halfWidth: number}} gate meta o checkpoint
 * @param {{x: number, z: number}} from posición anterior
 * @param {{x: number, z: number}} to posición nueva
 */
export function crossesGateForward(gate, from, to) {
  const forward = forwardOf(gate.heading);
  const before = (from.x - gate.x) * forward.x + (from.z - gate.z) * forward.z;
  const after = (to.x - gate.x) * forward.x + (to.z - gate.z) * forward.z;
  if (!(before < 0 && after >= 0)) return false;
  const t = before / (before - after);
  const right = rightOf(gate.heading);
  const crossX = from.x + (to.x - from.x) * t - gate.x;
  const crossZ = from.z + (to.z - from.z) * t - gate.z;
  return Math.abs(crossX * right.x + crossZ * right.z) <= gate.halfWidth;
}

/** Normaliza una distancia al intervalo [0, length) del circuito cerrado. */
export function wrapDistance(track, distance) {
  return ((distance % track.length) + track.length) % track.length;
}

/**
 * Distancia con signo equivalente en el circuito cerrado: el valor del intervalo (-length/2, length/2]
 * (la mitad exacta es positiva). Sirve para saber si una posición está detrás de la meta (negativa)
 * o delante (positiva), y para el desplazamiento más corto entre dos posiciones.
 */
export function signedDistance(track, distance) {
  const wrapped = wrapDistance(track, distance);
  return wrapped > track.length / 2 ? wrapped - track.length : wrapped;
}

/** Posición y rumbo de la línea central a `distance` desde la meta (el circuito es cíclico). */
export function pointAtDistance(track, distance) {
  const s = wrapDistance(track, distance);
  // Búsqueda binaria del tramo que contiene s.
  let low = 0;
  let high = track.points.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (track.starts[mid] <= s) low = mid;
    else high = mid - 1;
  }
  const a = track.points[low];
  const b = track.points[(low + 1) % track.points.length];
  const segmentLength = (low + 1 < track.points.length ? track.starts[low + 1] : track.length) - track.starts[low];
  const t = segmentLength === 0 ? 0 : (s - track.starts[low]) / segmentLength;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: track.headings[low] };
}

/** Distancia lateral mínima de un punto a la línea central y distancia recorrida del punto más cercano. */
export function nearestOnCenterline(track, x, z) {
  let best = { distance: Infinity, along: 0 };
  const count = track.points.length;
  for (let i = 0; i < count; i++) {
    const a = track.points[i];
    const b = track.points[(i + 1) % count];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const segmentLength2 = dx * dx + dz * dz;
    const t = segmentLength2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / segmentLength2));
    const distance = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (distance < best.distance) best = { distance, along: track.starts[i] + t * Math.sqrt(segmentLength2) };
  }
  return best;
}

/** Indica si un punto está sobre la calzada; `margin` reduce la anchura útil (p. ej. la mitad del coche). */
export function isOnRoad(track, x, z, margin = 0) {
  return nearestOnCenterline(track, x, z).distance + margin <= track.width / 2;
}

/**
 * Posición de parrilla `index` (0 = pole): filas de dos coches escalonadas por detrás de la meta
 * (en el sentido contrario al de la carrera), con el rumbo del trazado en ese punto.
 * @param {object} gridConfig sección `grid` de CONFIG
 */
export function gridSlot(track, gridConfig, index) {
  const row = Math.floor(index / 2);
  const side = index % 2 === 0 ? -1 : 1; // -1: izquierda; 1: derecha
  const along = -(gridConfig.firstSlotDistance + row * gridConfig.slotSpacing);
  const center = pointAtDistance(track, along);
  const right = rightOf(center.heading);
  const lateral = side * gridConfig.lateralOffset;
  return {
    index,
    x: center.x + right.x * lateral,
    z: center.z + right.z * lateral,
    heading: center.heading,
  };
}
