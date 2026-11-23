// Clasificación en vivo de la carrera (RF-016, RF-023, RF-030, RN-01, RN-02). Lógica pura, sin
// Three.js ni DOM (RNF-05).
//
// Orden (de delante hacia atrás):
// 1. Los participantes que han terminado van por delante de los que no (RN-02), ordenados por su
//    instante real de llegada (`finishTime`, el cronómetro del paso en que cruzan la meta final).
// 2. Los que no han terminado se ordenan por progreso válido (RN-01, RF-023): `progress.progress` es
//    vueltas válidas × longitud + distancia válida en la vuelta, y nunca decrece. Retroceder,
//    recortar o saltarse checkpoints no lo aumenta, así que no mejora la posición.
// 3. Desempate determinista: a igualdad exacta de instante de llegada o de progreso (por ejemplo, la
//    parrilla antes de la salida, o dos llegadas en el mismo paso de simulación) va por delante el
//    que sale antes en la parrilla (`gridIndex` menor). El resultado no depende del orden de entrada.
//
// La posición solo depende del progreso real de cada coche: el orden cambia cuando un coche
// adelanta a otro en la pista (RF-030), no por animaciones.

/**
 * Compara dos participantes: negativo si `a` va por delante de `b`, positivo si va por detrás.
 * @param {{finished: boolean, finishTime: number|null, gridIndex: number, progress: {progress: number}}} a
 * @param {{finished: boolean, finishTime: number|null, gridIndex: number, progress: {progress: number}}} b
 */
export function compareParticipants(a, b) {
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  if (a.finished && a.finishTime !== b.finishTime) return a.finishTime - b.finishTime;
  if (!a.finished && a.progress.progress !== b.progress.progress) return b.progress.progress - a.progress.progress;
  return a.gridIndex - b.gridIndex;
}

/**
 * Participantes ordenados de primero a último. No modifica la lista recibida.
 * @param {Array} participants participantes de una carrera
 */
export function rankParticipants(participants) {
  return [...participants].sort(compareParticipants);
}

/**
 * Identificadores de los participantes en orden de clasificación, sin repetidos.
 * @param {{participants: Array}} race
 * @returns {string[]}
 */
export function standingsOf(race) {
  return rankParticipants(race.participants).map((participant) => participant.id);
}

/**
 * Posición de un participante en la clasificación en vivo (1 = primero).
 * @param {{standings: string[]}} race carrera con `standings` actualizada
 * @param {string} id identificador del participante
 */
export function positionOf(race, id) {
  const index = race.standings.indexOf(id);
  if (index < 0) throw new Error(`Participante desconocido en la clasificación: ${id}`);
  return index + 1;
}
