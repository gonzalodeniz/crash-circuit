// Estado de la carrera: trazado y participantes. Lógica pura (RNF-05).
import { buildTrack, gridSlot } from './track.js';
import { createCarState, stepCar } from './driving.js';
import { GameState } from './gameState.js';
import { ClockPhase, createRaceClock, stepRaceClock } from './raceClock.js';
import { createProgress, stepProgress } from './progress.js';

const IDLE_INPUT = Object.freeze({ accelerate: false, brake: false, left: false, right: false });

/**
 * Crea una carrera con sus participantes colocados en la parrilla.
 * La lista admite hasta `race.maxParticipants` (10 desde E3); en E1 solo contiene al jugador.
 * @param {object} config CONFIG (secciones `track`, `grid` y `race`; `race.laps` fija las vueltas)
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
      finished: false, // ha completado todas las vueltas (RF-025)
      finishTime: null, // tiempo real de llegada en s, congelado al terminar (RF-025)
      ...createCarState(slot), // pose en la parrilla más el estado dinámico del coche (parado)
      progress: createProgress(track, slot), // vueltas válidas, checkpoints y distancia válida (RN-01)
    };
  });

  return {
    track,
    car: config.race.car,
    totalLaps: config.race.laps,
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
 * Tras mover cada coche se actualiza su progreso (vueltas y checkpoints válidos) con el desplazamiento real.
 * Al completar `race.totalLaps` vueltas válidas, el participante termina (RF-025): se congelan su
 * tiempo de llegada (`finishTime`, el cronómetro de ese paso) y su progreso, sus controles dejan de
 * actuar y su coche rueda por inercia hasta detenerse. El reloj de la carrera no se detiene.
 * @returns {{started: boolean, finished: string[]}} `started` es verdadero solo en el paso de la señal
 *   de salida; `finished` lista los participantes que terminan en este paso
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
  const finished = [];
  if (drivingTime > 0) {
    for (const participant of race.participants) {
      if (participant.status !== GameState.EN_CARRERA) continue;
      // Quien ya ha terminado no recibe órdenes: solo la inercia detiene su coche.
      const input = participant.finished ? IDLE_INPUT : (inputs[participant.id] ?? IDLE_INPUT);
      Object.assign(participant, stepCar(participant, input, drivingTime, config.carPerformance));
      if (participant.finished) continue; // su progreso y su tiempo ya no cambian (RF-025, RF-027)
      participant.progress = stepProgress(participant.progress, race.track, participant);
      if (participant.progress.laps >= race.totalLaps) {
        participant.finished = true;
        participant.finishTime = race.clock.raceTime;
        finished.push(participant.id);
      }
    }
  }
  return { started, finished };
}

/** Tiempo de carrera de un participante: su tiempo final si ya ha terminado, o el cronómetro en curso. */
export function raceTimeOf(race, participant) {
  return participant.finishTime ?? race.clock.raceTime;
}
