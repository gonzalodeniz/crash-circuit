// Progreso de carrera de un participante: vueltas válidas, checkpoints y distancia válida
// (RF-022, RF-023, RN-01). Lógica pura, sin Three.js ni DOM (RNF-05).
//
// Reglas (RN-01):
// - Una vuelta solo se suma al cruzar la meta hacia delante habiendo cruzado antes, en orden y hacia
//   delante, todos los checkpoints de la vuelta. Cruzar la meta sin ellos no hace nada.
// - Cruzar una puerta hacia atrás nunca suma ni resta, y un checkpoint fuera de orden se ignora.
// - La distancia válida en la vuelta nunca disminuye y no puede superar el siguiente checkpoint
//   pendiente.
// - Solo avanza con el coche sobre la calzada y de forma continua desde donde iba. Quien se salta un
//   trozo del trazado (p. ej. atajando por fuera) no lo recibe al volver: tiene que regresar a donde
//   dejó el recorrido válido o cruzar en orden el checkpoint pendiente, que valida todo lo anterior.
// - Los coches salen por detrás de la meta: antes de cruzarla por primera vez no tienen vuelta
//   empezada y su distancia es negativa (lo que les falta hasta la meta).
import { crossesGateForward, nearestOnCenterline, signedDistance, wrapDistance } from './track.js';

/**
 * Semiancho (m) del tramo del trazado donde se busca el punto más cercano, alrededor de la posición
 * anterior del coche. Un coche avanza como mucho `maxSpeed * maxStep` (1,5 m) por paso, así que sobra
 * de largo; si el coche aparece lejos de ese tramo, `nearestOnCenterline` busca en todo el trazado.
 */
export const NEAREST_SEARCH_SPAN = 30;

/**
 * Progreso inicial de un participante colocado en `pose` (normalmente la parrilla).
 * @param {object} track trazado
 * @param {{x: number, z: number}} pose posición inicial
 */
export function createProgress(track, pose) {
  const { along } = nearestOnCenterline(track, pose.x, pose.z);
  // Detrás de la meta (mitad final de la vuelta) la posición es negativa.
  const lapPosition = signedDistance(track, along);
  return {
    started: false, // ha cruzado la meta de salida
    laps: 0, // vueltas válidas completadas
    checkpointIndex: 0, // checkpoints válidos cruzados en la vuelta actual (el siguiente es este índice)
    lapPosition, // posición continua (sin saltos al cruzar la meta) respecto al inicio de la vuelta, en m
    lapDistance: lapPosition, // distancia válida recorrida en la vuelta actual, en m
    progress: lapPosition, // vueltas * longitud + distancia válida; no decrece nunca, en m
    x: pose.x,
    z: pose.z,
  };
}

/**
 * Avanza el progreso con el nuevo desplazamiento del coche. No modifica el estado recibido.
 * @param {ReturnType<typeof createProgress>} state progreso actual
 * @param {object} track trazado
 * @param {{x: number, z: number}} pose posición nueva del coche
 * @param {{margin: number, maxRejoinAdvance: number}} offRoad sección `offRoad` de CONFIG: margen de la
 *   calzada y máximo de recorrido sin validar que se reconoce al avanzar (RN-01)
 */
export function stepProgress(state, track, pose, offRoad) {
  const from = { x: state.x, z: state.z };
  const previousAlong = wrapDistance(track, state.lapPosition);
  const hint = { along: previousAlong, span: NEAREST_SEARCH_SPAN };
  const { along, distance } = nearestOnCenterline(track, pose.x, pose.z, hint);
  let lapPosition = state.lapPosition + signedDistance(track, along - previousAlong);
  let { started, laps, checkpointIndex, lapDistance } = state;
  const checkpointCount = track.checkpoints.length;

  // Cruces de puertas en el sentido de la carrera. Una meta cruzada sin todos los checkpoints,
  // o un checkpoint fuera de orden, se ignora (RN-01).
  if (started && checkpointIndex < checkpointCount && crossesGateForward(track.checkpoints[checkpointIndex], from, pose)) {
    lapDistance = Math.max(lapDistance, track.checkpoints[checkpointIndex].distance);
    checkpointIndex += 1;
  }
  if (crossesGateForward(track.finish, from, pose)) {
    if (!started) {
      started = true;
      lapDistance = Math.max(lapDistance, 0);
    } else if (checkpointIndex === checkpointCount) {
      laps += 1;
      checkpointIndex = 0;
      lapPosition -= track.length; // la posición continua vuelve a empezar tras la meta
      lapDistance = 0;
    }
  }

  // Tope: sin salir, la meta; con la vuelta empezada, el siguiente checkpoint (o la meta, al final).
  let cap = 0;
  if (started) cap = checkpointIndex < checkpointCount ? track.checkpoints[checkpointIndex].distance : track.length;
  // Lo que el coche está por delante de su recorrido válido. Se mide sobre el trazado, no con
  // `lapPosition`, que tras un atajo largo puede haber quedado una vuelta desplazada.
  const advance = signedDistance(track, along - lapDistance);
  const onRoad = distance <= track.width / 2 + offRoad.margin;
  if (onRoad && advance > 0 && advance <= offRoad.maxRejoinAdvance) {
    lapDistance = Math.max(lapDistance, Math.min(lapDistance + advance, cap));
  }
  const progress = Math.max(state.progress, laps * track.length + lapDistance);

  return { started, laps, checkpointIndex, lapPosition, lapDistance, progress, x: pose.x, z: pose.z };
}

/** Vuelta que se muestra al jugador (1 a `totalLaps`): no pasa del total en la última vuelta ni al terminar. */
export function currentLap(state, totalLaps) {
  return Math.min(state.laps + 1, totalLaps);
}

/** Texto del contador de vueltas del HUD, p. ej. «Vuelta 2/3» (RF-044). */
export function lapCounterText(label, state, totalLaps) {
  return `${label} ${currentLap(state, totalLaps)}/${totalLaps}`;
}
