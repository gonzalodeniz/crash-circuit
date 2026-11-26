import { CONFIG } from '../../src/config/config.js';

/**
 * Copia de la configuración en la que ningún golpe es fuerte, así que nadie se destruye. Es para las pruebas
 * de otra cosa (conducción de los rivales, matriz de circuitos, rebotes) que necesitan que los coches sigan
 * rodando. Un coche destruido no vuelve hasta que exista la reaparición (#92): con ella, las carreras
 * completas deben volver a probarse con la configuración real (#94).
 * @param {object} [config] configuración de partida
 */
export function withoutDestruction(config = CONFIG) {
  return { ...config, impact: { ...config.impact, strongSpeed: Number.POSITIVE_INFINITY } };
}

// No es una prueba (no termina en `.test.js`).
