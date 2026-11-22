// Estado de la carrera: trazado y participantes. Lógica pura (RNF-05).
import { buildTrack, gridSlot } from './track.js';

/**
 * Crea una carrera con sus participantes colocados en la parrilla.
 * La lista admite hasta `race.maxParticipants` (10 desde E3); en E1 solo contiene al jugador.
 * @param {object} config CONFIG (secciones `track`, `grid` y `race`)
 * @param {Array<{id: string, name: string, isPlayer?: boolean}>} entries participantes en orden de parrilla
 */
export function createRace(config, entries = [config.race.player]) {
  if (entries.length === 0 || entries.length > config.race.maxParticipants) {
    throw new Error(`La carrera admite de 1 a ${config.race.maxParticipants} participantes`);
  }
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new Error('Los participantes deben tener identificadores únicos');
  }
  if (entries.filter((entry) => entry.isPlayer).length !== 1) {
    throw new Error('Debe haber exactamente un participante jugador');
  }

  const track = buildTrack(config.track);
  const participants = entries.map((entry, index) => {
    const slot = gridSlot(track, config.grid, index);
    return {
      id: entry.id,
      name: entry.name,
      isPlayer: Boolean(entry.isPlayer),
      gridIndex: index,
      x: slot.x,
      z: slot.z,
      heading: slot.heading,
    };
  });

  return {
    track,
    car: config.race.car,
    participants,
    get player() {
      return participants.find((participant) => participant.isPlayer);
    },
  };
}
