// Reaparición de un coche destruido y protección posterior (RF-039, RF-042, RN-04). Lógica pura, sin
// Three.js ni DOM (RNF-05). Vale igual para los diez participantes y para cualquier modelo (RN-07).
//
// Cuándo reaparece un coche lo decide `race.js` (al acabar el bloqueo de `destruction.js`). Aquí se elige
// el sitio y se lleva el temporizador de la protección, que avanza con el paso de la simulación: si la
// simulación no avanza (pausa), la protección tampoco.
//
// El sitio preferido es el centro de la calzada a la altura del último avance válido del coche. Si no está
// libre, se prueba a los lados y, después, cada vez más atrás: nunca se busca hacia delante, así que
// reaparecer no regala distancia ni salta checkpoints (RN-01). Un sitio no está libre si lo ocupa un coche
// o si va a pasar por él enseguida uno que viene lanzado (RF-042). Quien ya ha terminado la carrera no
// vuelve a moverse, así que solo reaparece pegado a un borde, para no quedarse en mitad de la pista.
import { carsOverlap } from './carContacts.js';
import { touchesScenery } from './collisions.js';
import { TIME_EPSILON } from './destruction.js';
import { NEAREST_SEARCH_SPAN, validDistanceCap } from './progress.js';
import { forwardOf, nearestOnCenterline, pointAtDistance, rightOf, signedDistance, wrapDistance } from './track.js';

/** Margen (m) de redondeo al comprobar que un sitio no queda por delante de la distancia válida. */
const DISTANCE_EPSILON = 0.01;

/**
 * Desplazamientos laterales (m) que se prueban sin sacar el coche de la calzada: del centro hacia los
 * bordes o, si se pide `aside`, solo los dos bordes.
 */
function lateralOffsets(track, car, step, aside) {
  const limit = (track.width - car.width) / 2;
  if (aside) return [limit, -limit];
  const offsets = [0];
  for (let offset = step; offset <= limit; offset += step) offsets.push(offset, -offset);
  return offsets;
}

/** Pose a `distance` metros de recorrido, `lateral` a la derecha del centro y en el sentido de la carrera. */
function poseOnTrack(track, distance, lateral) {
  const center = pointAtDistance(track, distance);
  const right = rightOf(center.heading);
  return { x: center.x + right.x * lateral, z: center.z + right.z * lateral, heading: center.heading };
}

/**
 * Poses que ocupa un coche ahora y las que ocupará en los próximos `time` segundos si sigue como va:
 * avanzando por el trazado a su velocidad y a la misma distancia del centro. Van lo bastante juntas como
 * para no dejar huecos entre ellas. Un coche parado solo ocupa la suya.
 */
function posesAhead(track, car, other, time) {
  const speed = other.speed ?? 0;
  if (speed === 0 || time <= 0) return [other];
  const { along } = nearestOnCenterline(track, other.x, other.z);
  const center = pointAtDistance(track, along);
  const right = rightOf(center.heading);
  const lateral = (other.x - center.x) * right.x + (other.z - center.z) * right.z;
  // Lo que avanza por el trazado: negativo si va en sentido contrario o marcha atrás.
  const forward = forwardOf(center.heading);
  const facing = forwardOf(other.heading);
  const travel = speed * (facing.x * forward.x + facing.z * forward.z) * time;
  const count = Math.ceil(Math.abs(travel) / car.length);
  const ahead = Array.from({ length: count }, (_, i) => poseOnTrack(track, along + (travel * (i + 1)) / count, lateral));
  return [other, ...ahead];
}

/**
 * Sitio en el que reaparece un coche: sobre la calzada, mirando en el sentido de la carrera, sin tocar el
 * escenario, a `clearance` metros como mínimo de los demás coches y fuera del paso de los que lleguen en
 * `approachTime` segundos, nunca por delante de su distancia válida y detrás de la puerta que tiene
 * pendiente (para que cruzarla vuelva a contar).
 * @param {{track: object, scenery: object, car: {length: number, width: number}}} world carrera
 * @param {object} progress progreso del coche que reaparece (`progress.js`)
 * @param {ReadonlyArray<{x: number, z: number, heading: number, speed?: number}>} others los demás coches
 * @param {object} params sección `respawn` de CONFIG
 * @param {{aside?: boolean}} [options] `aside`: solo pegado a un borde, para un coche que no va a moverse
 * @returns {{x: number, z: number, heading: number}|null} `null` si no hay ningún sitio libre en el tramo
 *   que se busca
 */
export function findRespawnSpot({ track, scenery, car }, progress, others, params, { aside = false } = {}) {
  // Se comprueba con el coche agrandado, para que quede holgura alrededor.
  const room = { length: car.length + params.clearance, width: car.width + params.clearance };
  const preferred = Math.min(progress.lapDistance, validDistanceCap(progress, track) - params.gateClearance);
  const offsets = lateralOffsets(track, car, params.lateralStep, aside);
  const occupied = others.flatMap((other) => posesAhead(track, car, other, params.approachTime));
  for (let back = 0; back <= params.maxSearchDistance; back += params.searchStep) {
    const distance = preferred - back;
    const hint = { along: wrapDistance(track, distance), span: NEAREST_SEARCH_SPAN };
    for (const offset of offsets) {
      const spot = poseOnTrack(track, distance, offset);
      // En el interior de una curva, un sitio a un lado puede proyectarse sobre el trazado algo más adelante.
      const { along } = nearestOnCenterline(track, spot.x, spot.z, hint);
      if (signedDistance(track, along - progress.lapDistance) > DISTANCE_EPSILON) continue;
      if (touchesScenery(spot, room, scenery)) continue;
      if (occupied.some((pose) => carsOverlap(spot, pose, room))) continue;
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
