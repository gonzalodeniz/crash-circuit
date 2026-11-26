import { CONFIG } from '../../src/config/config.js';

/**
 * Copia de la configuración en la que ningún golpe es fuerte, así que nadie se destruye. Es para las pruebas
 * de otra cosa (respuesta física de los rebotes y contactos) que necesitan que el golpe no saque al coche de
 * la prueba. Las carreras completas se prueban con la configuración real.
 * @param {object} [config] configuración de partida
 */
export function withoutDestruction(config = CONFIG) {
  return { ...config, impact: { ...config.impact, strongSpeed: Number.POSITIVE_INFINITY } };
}

// No es una prueba (no termina en `.test.js`).
