// Conductor del jugador en las pruebas de carreras completas: un piloto IA propio, que sabe salir de un
// atasco. Hace falta porque los coches son sólidos y quien va doblado se encuentra en la calzada con los que
// ya han terminado. No es una prueba (no termina en `.test.js`).
import { CONFIG } from '../../src/config/config.js';
import { aiDrive, aiLevel, createAiDriver, createAiRecovery } from '../../src/logic/aiDriver.js';
import { ParticipantStatus } from '../../src/logic/race.js';
import { createSeededRandom } from '../../src/logic/random.js';
import { requireTrackDefinition } from '../../src/logic/trackCatalog.js';
import { NONE as IDLE } from './accidents.js';

/**
 * @param {object} race carrera en curso
 * @param {number} seed semilla de la trayectoria del piloto
 * @param {number} dt segundos de cada paso
 * @returns {() => object} las entradas del jugador para el paso siguiente
 */
export function playerPilot(race, seed, dt) {
  const level = aiLevel(CONFIG.ai, requireTrackDefinition(CONFIG, race.track.id).difficulty);
  const driver = createAiDriver(race.track, CONFIG.ai, level, CONFIG.carPerformance, race.car, createSeededRandom(seed));
  let recovery = createAiRecovery();
  return () => {
    // Como hace la carrera con los rivales: destruido no conduce y al volver no arrastra el atasco.
    if (race.player.status === ParticipantStatus.DESTRUIDO) {
      recovery = createAiRecovery();
      return IDLE;
    }
    const result = aiDrive(recovery, driver, race.player, CONFIG.ai, dt);
    recovery = result.recovery;
    return result.input;
  };
}
