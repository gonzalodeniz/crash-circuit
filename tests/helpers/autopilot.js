import { pointAtDistance } from '../../src/logic/track.js';

/** Variante prudente: mira más cerca y frena en las curvas cerradas (la usan las matrices de circuitos). */
export const CORNERING_AUTOPILOT = Object.freeze({ lookahead: 12, topSpeed: 18, cornerSpeed: 10 });

// Zona muerta del giro (rad) y error de rumbo (rad) a partir del cual se considera curva cerrada.
const STEERING_DEAD_ZONE = 0.05;
const TIGHT_CORNER_ERROR = 0.25;
// Margen (m/s) sobre la velocidad objetivo a partir del cual se frena en vez de soltar el acelerador.
const BRAKE_MARGIN = 4;

/**
 * Piloto automático de las pruebas: apunta a un punto de la línea central por delante y gira con
 * una zona muerta. Devuelve las cuatro entradas del jugador.
 *
 * Por defecto acelera hasta `topSpeed` sin frenar. Si se indica `cornerSpeed`, limita la
 * velocidad a ese valor en las curvas cerradas y frena cuando se pasa del límite.
 *
 * @param {object} race carrera en curso (usa `race.track`).
 * @param {object} [participant] coche que se conduce; por defecto, el jugador.
 * @param {{lookahead?: number, topSpeed?: number, cornerSpeed?: number|null}} [options]
 */
export function autopilot(race, participant = race.player, { lookahead = 15, topSpeed = 22, cornerSpeed = null } = {}) {
  const target = pointAtDistance(race.track, participant.progress.lapPosition + lookahead);
  const wanted = Math.atan2(target.x - participant.x, target.z - participant.z);
  const error = Math.atan2(Math.sin(wanted - participant.heading), Math.cos(wanted - participant.heading));
  const steer = { left: error > STEERING_DEAD_ZONE, right: error < -STEERING_DEAD_ZONE };
  if (cornerSpeed === null) return { accelerate: participant.speed < topSpeed, brake: false, ...steer };
  const maxSpeed = Math.abs(error) > TIGHT_CORNER_ERROR ? cornerSpeed : topSpeed;
  return { accelerate: participant.speed < maxSpeed, brake: participant.speed > maxSpeed + BRAKE_MARGIN, ...steer };
}
