// Participantes de la parrilla de salida (RF-016…RF-019, RF-021): el jugador y los nueve pilotos IA,
// en el orden de sus huecos. Lógica pura, sin Three.js ni DOM (RNF-05).
import { requireCarModel } from './carModels.js';

/** Pilotos IA de la configuración (identidad fija entre carreras, RF-017), en el orden de la parrilla. */
export function aiDrivers(config) {
  return config.race.aiDrivers;
}

/**
 * Participantes de una carrera completa en orden de parrilla: el jugador, con el modelo elegido, en el
 * hueco `grid.playerSlotIndex`, y los pilotos IA en los demás. Valida que sean exactamente
 * `race.maxParticipants`, con identificadores únicos y modelos del catálogo (RF-016, RF-018).
 * @param {object} config CONFIG (secciones `race`, `grid` y `cars`)
 * @param {string} playerCarModelId modelo de coche elegido por el jugador
 * @returns {Array<{id: string, name: string, isPlayer?: boolean, carModelId: string}>}
 */
export function createGridEntries(config, playerCarModelId) {
  const drivers = aiDrivers(config);
  const total = config.race.maxParticipants;
  if (drivers.length !== total - 1) {
    throw new Error(`Debe haber ${total - 1} pilotos IA, pero hay ${drivers.length} (RF-016)`);
  }
  const slot = config.grid.playerSlotIndex;
  if (!Number.isInteger(slot) || slot < 0 || slot >= total) {
    throw new Error(`Hueco de parrilla del jugador fuera de rango: ${slot}`);
  }
  for (const driver of drivers) requireCarModel(config, driver.carModelId);

  const player = { ...config.race.player, carModelId: requireCarModel(config, playerCarModelId).id };
  const entries = drivers.map((driver) => ({ id: driver.id, name: driver.name, carModelId: driver.carModelId }));
  entries.splice(slot, 0, player);
  return entries;
}
