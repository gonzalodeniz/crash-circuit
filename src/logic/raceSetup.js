// Configuración confirmada de una carrera (RF-007): coche, circuito y vueltas. Lógica pura (RNF-05).
// Es la única fuente de la que se crea la carrera: no se lee ningún valor suelto de otra parte.
import { createRace } from './race.js';
import { requireCarModel } from './carModels.js';
import { requireTrackDefinition } from './trackCatalog.js';
import { requireLapOption } from './lapOptions.js';
import { createGridEntries } from './startingGrid.js';

/**
 * Valida y congela una configuración de carrera. Lanza un error si falta alguno de los tres valores
 * o si alguno no está en el catálogo (modelo, circuito o una de las opciones de vueltas).
 * @param {object} config CONFIG
 * @param {{carModelId?: string, trackId?: string, laps?: number}} choice
 * @returns {Readonly<{carModelId: string, trackId: string, laps: number}>}
 */
export function createRaceSetup(config, choice) {
  const { carModelId, trackId, laps } = choice ?? {};
  const missing = Object.entries({ carModelId, trackId, laps })
    .filter(([, value]) => value === undefined || value === null)
    .map(([name]) => name);
  if (missing.length > 0) throw new Error(`Configuración de carrera incompleta: falta ${missing.join(', ')}`);
  return Object.freeze({
    carModelId: requireCarModel(config, carModelId).id,
    trackId: requireTrackDefinition(config, trackId).id,
    laps: requireLapOption(config, laps),
  });
}

/** Configuración con las opciones preseleccionadas de CONFIG (la de partida de cada selección). */
export function defaultRaceSetup(config) {
  return createRaceSetup(config, {
    carModelId: config.cars.defaultModelId,
    trackId: config.tracks.defaultId,
    laps: config.race.defaultLaps,
  });
}

/**
 * Crea la carrera a partir de una configuración confirmada, y solo de ella. La configuración se
 * vuelve a validar, así que una incompleta o fuera del catálogo no llega a crear nada. La carrera
 * tiene diez participantes: el jugador y los nueve pilotos IA de la configuración (RF-016).
 */
export function createRaceFromSetup(config, setup) {
  const { carModelId, trackId, laps } = createRaceSetup(config, setup);
  return createRace(config, createGridEntries(config, carModelId), trackId, laps);
}

/**
 * Datos del resumen que se muestra antes de empezar (RF-007): nombre del coche, nombre y dificultad
 * del circuito (el identificador de la etiqueta, que traduce la interfaz) y número de vueltas.
 */
export function raceSetupSummary(config, setup) {
  const { carModelId, trackId, laps } = createRaceSetup(config, setup);
  const track = requireTrackDefinition(config, trackId);
  return {
    carName: requireCarModel(config, carModelId).name,
    trackName: track.name,
    difficulty: track.difficulty,
    laps,
  };
}
