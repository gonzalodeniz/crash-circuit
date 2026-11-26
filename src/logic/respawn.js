// Reaparición de un coche destruido y protección posterior (RF-039, RF-042, RN-04). Lógica pura, sin
// Three.js ni DOM (RNF-05). Vale igual para los diez participantes y para cualquier modelo (RN-07).
//
// Cuándo reaparece un coche lo decide `race.js` (al acabar el bloqueo de `destruction.js`). Aquí se elige
// el sitio y se lleva el temporizador de la protección, que avanza con el paso de la simulación: si la
// simulación no avanza (pausa), la protección tampoco.
//
// El sitio preferido es el centro de la calzada a la altura del último avance válido del coche. Si no está
// libre, se prueba a los lados y, después, cada vez más atrás: nunca se busca hacia delante, así que
// reaparecer no regala distancia ni salta checkpoints (RN-01).
import { carsOverlap } from './carContacts.js';
import { touchesScenery } from './collisions.js';
import { NEAREST_SEARCH_SPAN, validDistanceCap } from './progress.js';
import { nearestOnCenterline, pointAtDistance, rightOf, signedDistance, wrapDistance } from './track.js';

/** Margen (s) para dar por cumplida la protección: la suma de pasos en coma flotante no llega justa a cero. */
const TIME_EPSILON = 1e-9;

/** Margen (m) de redondeo al comprobar que un sitio no queda por delante de la distancia válida. */
const DISTANCE_EPSILON = 0.01;

/** Desplazamientos laterales (m) que se prueban, del centro hacia los bordes, sin sacar el coche de la calzada. */
function lateralOffsets(track, car, step) {
  const limit = (track.width - car.width) / 2;
  const offsets = [0];
  for (let offset = step; offset <= limit; offset += step) offsets.push(offset, -offset);
  return offsets;
}

/**
 * Sitio en el que reaparece un coche: sobre la calzada, mirando en el sentido de la carrera, sin tocar el
 * escenario ni quedar a menos de `clearance` metros de otro coche, nunca por delante de su distancia válida
 * y detrás de la puerta que tiene pendiente (para que cruzarla vuelva a contar).
 * @param {{track: object, scenery: object, car: {length: number, width: number}}} world carrera
 * @param {object} progress progreso del coche que reaparece (`progress.js`)
 * @param {ReadonlyArray<{x: number, z: number, heading: number}>} others los demás coches
 * @param {object} params sección `respawn` de CONFIG
 * @returns {{x: number, z: number, heading: number}|null} `null` si no hay ningún sitio libre en el tramo
 *   que se busca
 */
export function findRespawnSpot({ track, scenery, car }, progress, others, params) {
  // Se comprueba con el coche agrandado, para que quede holgura alrededor.
  const room = { length: car.length + params.clearance, width: car.width + params.clearance };
  const preferred = Math.min(progress.lapDistance, validDistanceCap(progress, track) - params.gateClearance);
  const offsets = lateralOffsets(track, car, params.lateralStep);
  for (let back = 0; back <= params.maxSearchDistance; back += params.searchStep) {
    const distance = preferred - back;
    const center = pointAtDistance(track, distance);
    const right = rightOf(center.heading);
    const hint = { along: wrapDistance(track, distance), span: NEAREST_SEARCH_SPAN };
    for (const offset of offsets) {
      const spot = { x: center.x + right.x * offset, z: center.z + right.z * offset, heading: center.heading };
      // En el interior de una curva, un sitio a un lado puede proyectarse sobre el trazado algo más adelante.
      const { along } = nearestOnCenterline(track, spot.x, spot.z, hint);
      if (signedDistance(track, along - progress.lapDistance) > DISTANCE_EPSILON) continue;
      if (touchesScenery(spot, room, scenery)) continue;
      if (others.some((other) => carsOverlap(spot, other, room))) continue;
      return spot;
    }
  }
  return null;
}

/**
 * Protección de un coche recién reaparecido: `timeLeft` segundos de tiempo activo en los que ningún golpe
 * lo destruye (`impact.js`). `null` si no hay protección.
 * @param {{protectionDuration: number}} params sección `respawn` de CONFIG
 */
export function createProtection(params) {
  return params.protectionDuration > 0 ? Object.freeze({ timeLeft: params.protectionDuration }) : null;
}

/**
 * Avanza la protección `dt` segundos de simulación.
 * @param {ReturnType<typeof createProtection>} protection no se modifica
 * @returns {ReturnType<typeof createProtection>} `null` al agotarse; el mismo objeto si no cambia nada
 */
export function stepProtection(protection, dt) {
  if (protection === null || dt <= 0) return protection;
  const timeLeft = protection.timeLeft - dt;
  return timeLeft <= TIME_EPSILON ? null : Object.freeze({ timeLeft });
}
