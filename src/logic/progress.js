// Progreso de carrera de un participante: vueltas válidas, checkpoints y distancia válida
// (RF-022, RF-023, RN-01). Lógica pura, sin Three.js ni DOM (RNF-05).
//
// Reglas (RN-01):
// - Una vuelta solo se suma al cruzar la meta hacia delante habiendo cruzado antes, en orden y hacia
//   delante, todos los checkpoints de la vuelta. Cruzar la meta sin ellos no hace nada.
// - Cruzar una puerta hacia atrás nunca suma ni resta, y un checkpoint fuera de orden se ignora.
// - La distancia válida en la vuelta nunca disminuye y no puede superar el siguiente checkpoint
//   pendiente: recortar o retroceder no da progreso ficticio.
// - Los coches salen por detrás de la meta: antes de cruzarla por primera vez no tienen vuelta
//   empezada y su distancia es negativa (lo que les falta hasta la meta).
import { crossesGateForward, nearestOnCenterline } from './track.js';

/** Distancia con signo más corta entre dos posiciones a lo largo de un circuito cerrado. */
function wrappedDelta(track, from, to) {
  const half = track.length / 2;
  let delta = to - from;
  if (delta > half) delta -= track.length;
  else if (delta < -half) delta += track.length;
  return delta;
}

/**
 * Progreso inicial de un participante colocado en `pose` (normalmente la parrilla).
 * @param {object} track trazado
 * @param {{x: number, z: number}} pose posición inicial
 */
export function createProgress(track, pose) {
  const { along } = nearestOnCenterline(track, pose.x, pose.z);
  // Detrás de la meta (mitad final de la vuelta) la posición es negativa.
  const lapPosition = along > track.length / 2 ? along - track.length : along;
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
 */
export function stepProgress(state, track, pose) {
  const from = { x: state.x, z: state.z };
  const { along } = nearestOnCenterline(track, pose.x, pose.z);
  const previousAlong = ((state.lapPosition % track.length) + track.length) % track.length;
  let lapPosition = state.lapPosition + wrappedDelta(track, previousAlong, along);
  let { started, laps, checkpointIndex } = state;
  const checkpointCount = track.checkpoints.length;

  // Cruces de puertas en el sentido de la carrera. Una meta cruzada sin todos los checkpoints,
  // o un checkpoint fuera de orden, se ignora (RN-01).
  if (started && checkpointIndex < checkpointCount && crossesGateForward(track.checkpoints[checkpointIndex], from, pose)) {
    checkpointIndex += 1;
  }
  if (crossesGateForward(track.finish, from, pose)) {
    if (!started) {
      started = true;
    } else if (checkpointIndex === checkpointCount) {
      laps += 1;
      checkpointIndex = 0;
      lapPosition -= track.length; // la posición continua vuelve a empezar tras la meta
    }
  }

  // Tope: sin salir, la meta; con la vuelta empezada, el siguiente checkpoint (o la meta, al final).
  let cap = 0;
  if (started) cap = checkpointIndex < checkpointCount ? track.checkpoints[checkpointIndex].distance : track.length;
  const lapChanged = laps !== state.laps;
  const base = lapChanged ? 0 : state.lapDistance;
  const lapDistance = Math.max(base, Math.min(lapPosition, cap));
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
