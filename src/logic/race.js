// Estado de la carrera: trazado y participantes. Lógica pura (RNF-05).
import { buildTrack, gridSlot } from './track.js';
import { createCarState, stepCar } from './driving.js';
import { GameState } from './gameState.js';
import { ClockPhase, createRaceClock, stepRaceClock } from './raceClock.js';

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
      status: GameState.PARRILLA, // pasa a EN_CARRERA con la señal de salida (RF-021)
      ...createCarState(slot), // pose en la parrilla más el estado dinámico del coche (parado)
    };
  });

  return {
    track,
    car: config.race.car,
    participants,
    clock: createRaceClock(), // cuenta atrás y cronómetro de carrera
    get player() {
      return participants.find((participant) => participant.isPlayer);
    },
  };
}

/**
 * Avanza la carrera `dt` segundos de simulación; modifica `race` en el sitio.
 * Mientras dura la cuenta atrás nadie se mueve, aunque haya entradas (RF-020). En el paso en que
 * termina, todos los participantes pasan a `EN_CARRERA` a la vez (RF-021) y el cronómetro arranca
 * desde cero; el sobrante de ese paso cuenta ya como tiempo de carrera (RF-045).
 * @param {ReturnType<typeof createRace>} race
 * @param {Record<string, {accelerate: boolean, brake: boolean, left: boolean, right: boolean}>} inputs entradas por id de participante
 * @param {number} dt segundos desde la actualización anterior (se limita a `carPerformance.maxStep`)
 * @param {object} config CONFIG (secciones `race` y `carPerformance`)
 * @returns {{started: boolean}} `started` es verdadero solo en el paso de la señal de salida
 */
export function stepRace(race, inputs, dt, config) {
  const step = Math.min(Math.max(dt, 0), config.carPerformance.maxStep);
  const previous = race.clock;
  race.clock = stepRaceClock(previous, step, config.race.countdown);
  const started = previous.phase !== race.clock.phase;

  if (started) {
    for (const participant of race.participants) participant.status = GameState.EN_CARRERA;
  }
  // Tiempo de carrera que ha transcurrido en este paso: cero durante la cuenta atrás.
  let drivingTime = 0;
  if (started) drivingTime = race.clock.raceTime;
  else if (previous.phase === ClockPhase.RUNNING) drivingTime = step;
  if (drivingTime > 0) {
    for (const participant of race.participants) {
      if (participant.status !== GameState.EN_CARRERA) continue;
      const input = inputs[participant.id] ?? { accelerate: false, brake: false, left: false, right: false };
      Object.assign(participant, stepCar(participant, input, drivingTime, config.carPerformance));
    }
  }
  return { started };
}
