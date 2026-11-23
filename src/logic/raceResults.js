// Resultados de la carrera para el jugador (RF-024, RF-027, RN-02, RN-03). Lógica pura, sin Three.js
// ni DOM (RNF-05).
//
// En E3 solo se listan los participantes que han llegado a la meta antes que el jugador, con su tiempo
// real. Quienes siguen en pista no aparecen: su clasificación y sus estimaciones son de E7 (RF-054, RN-05).
import { positionOf } from './standings.js';
import { formatRaceTime } from './raceClock.js';

/**
 * Datos de los resultados cuando el jugador ha terminado. Los tiempos son los reales de llegada
 * (`finishTime`), nunca recalculados; los puestos salen de la clasificación (RN-02).
 * @param {{participants: Array, standings: string[], winner: object|null, player: object}} race
 * @returns {{winner: {id: string, name: string, isPlayer: boolean, finishTime: number},
 *   playerWon: boolean,
 *   player: {id: string, name: string, position: number, total: number, finishTime: number},
 *   arrivals: Array<{position: number, id: string, name: string, finishTime: number}>}}
 */
export function buildRaceResults(race) {
  const { player, winner } = race;
  if (!player.finished || winner === null) {
    throw new Error('Los resultados solo existen cuando el jugador ha terminado');
  }
  const position = positionOf(race, player.id);
  // Quienes van por delante del jugador han terminado antes que él (los que terminan van primero, RN-02).
  const arrivals = race.standings.slice(0, position - 1).map((id, index) => {
    const participant = race.participants.find((candidate) => candidate.id === id);
    return { position: index + 1, id, name: participant.name, finishTime: participant.finishTime };
  });
  return {
    winner,
    playerWon: winner.isPlayer,
    player: { id: player.id, name: player.name, position, total: race.participants.length, finishTime: player.finishTime },
    arrivals,
  };
}

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key]));
}

/**
 * Textos de la pantalla de resultados a partir de los datos y de `ui.results` de la configuración.
 * @param {ReturnType<typeof buildRaceResults>} results
 * @param {{positionFormat: string}} resultsConfig sección `ui.results` de CONFIG
 */
export function resultsTexts(results, resultsConfig) {
  const { player, winner } = results;
  return {
    playerWon: results.playerWon,
    winnerName: winner.name,
    winnerTime: formatRaceTime(winner.finishTime),
    positionText: fill(resultsConfig.positionFormat, { position: player.position, total: player.total }),
    timeText: formatRaceTime(player.finishTime),
    arrivals: results.arrivals.map((arrival) => ({
      positionText: String(arrival.position),
      name: arrival.name,
      timeText: formatRaceTime(arrival.finishTime),
    })),
  };
}
