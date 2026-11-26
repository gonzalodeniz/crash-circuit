// Destrucción de un coche y bloqueo posterior (RF-035, RF-038, RN-04). Lógica pura, sin Three.js ni DOM
// (RNF-05). Vale igual para los diez participantes y para cualquier modelo (RN-07).
//
// Qué golpe destruye lo decide `impact.js` (golpe fuerte) y cuándo se aplica, `race.js`; la reaparición
// posterior, `respawn.js`. Aquí solo está el temporizador del coche destruido, que se avanza con el paso de la simulación y nunca con el reloj de
// pared: si la simulación no avanza (pausa), el temporizador tampoco.

/** Resto (s) que se da por cumplido: la suma de pasos en coma flotante no llega exactamente a cero. */
const TIME_EPSILON = 1e-9;

/**
 * Bloqueo de un coche recién destruido.
 * - `timeLeft`: segundos de tiempo activo que le quedan fuera de juego.
 * - `readyToRespawn`: el bloqueo ha terminado y el coche puede reaparecer.
 * @param {{lockDuration: number}} params sección `destruction` de CONFIG
 */
export function createWreck(params) {
  return Object.freeze({ timeLeft: params.lockDuration, readyToRespawn: false });
}

/**
 * Avanza el bloqueo `dt` segundos de simulación.
 * @param {ReturnType<typeof createWreck>} wreck no se modifica
 * @param {number} dt segundos de tiempo activo
 * @returns {ReturnType<typeof createWreck>} el mismo objeto si no cambia nada
 */
export function stepWreck(wreck, dt) {
  if (wreck.readyToRespawn || dt <= 0) return wreck;
  const left = wreck.timeLeft - dt;
  const ready = left <= TIME_EPSILON;
  return Object.freeze({ timeLeft: ready ? 0 : left, readyToRespawn: ready });
}
