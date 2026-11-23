// Estado de la carrera: trazado y participantes. Lógica pura (RNF-05).
import { buildTrack, gridSlot } from './track.js';
import { createCarState, stepCar } from './driving.js';
import { ClockPhase, createRaceClock, stepRaceClock } from './raceClock.js';
import { createProgress, stepProgress } from './progress.js';
import { requireCarModel } from './carModels.js';
import { requireTrackDefinition } from './trackCatalog.js';
import { requireLapOption } from './lapOptions.js';
import { aiInput, aiLevel, createAiDriver } from './aiDriver.js';
import { rankParticipants, standingsOf } from './standings.js';

/**
 * Estado de cada participante, distinto de los estados de la partida.
 * `DESTRUIDO` (subestado del vehículo, RN-04) se añadirá aquí en E5.
 */
export const ParticipantStatus = Object.freeze({
  PARRILLA: 'PARRILLA',
  EN_CARRERA: 'EN_CARRERA',
});

const IDLE_INPUT = Object.freeze({ accelerate: false, brake: false, left: false, right: false });

/**
 * Crea una carrera con sus participantes colocados en la parrilla.
 * La lista admite hasta `race.maxParticipants` (10). La carrera del juego los trae todos (véase
 * `createGridEntries`); con menos, los huecos de parrilla se asignan por orden.
 * Cada participante guarda su modelo de coche (`carModelId`, por defecto `cars.defaultModelId`): solo
 * afecta al aspecto, nunca al rendimiento (RF-003).
 * El circuito es el indicado por `trackId` (por defecto `tracks.defaultId`); la parrilla se coloca en él.
 * Las vueltas son `laps` (por defecto `race.defaultLaps`) y deben ser una de `race.lapOptions` (RF-006).
 * @param {object} config CONFIG (secciones `tracks`, `grid`, `race` y `cars`)
 * @param {Array<{id: string, name: string, isPlayer?: boolean, carModelId?: string}>} entries participantes en orden de parrilla
 * @param {string} trackId identificador del circuito del catálogo
 * @param {number} laps número de vueltas de la carrera
 * Cada participante que no es el jugador conduce solo (RF-028): `race.drivers` guarda el piloto IA de
 * cada uno (trayectoria y ritmo), con el nivel de exigencia de la dificultad del circuito (RF-031) y
 * variaciones sacadas de `random` (RF-029).
 * @param {() => number} random fuente de aleatoriedad en [0, 1) (por defecto `Math.random`); con una
 *   fuente con semilla (`createSeededRandom`) la carrera es reproducible
 */
export function createRace(
  config,
  entries = [config.race.player],
  trackId = config.tracks.defaultId,
  laps = config.race.defaultLaps,
  random = Math.random,
) {
  if (entries.length === 0 || entries.length > config.race.maxParticipants) {
    throw new Error(`La carrera admite de 1 a ${config.race.maxParticipants} participantes`);
  }
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
    throw new Error('Los participantes deben tener identificadores únicos');
  }
  if (entries.filter((entry) => entry.isPlayer).length !== 1) {
    throw new Error('Debe haber exactamente un participante jugador');
  }

  const definition = requireTrackDefinition(config, trackId);
  const track = buildTrack(definition);
  const participants = entries.map((entry, index) => {
    const slot = gridSlot(track, config.grid, index);
    return {
      id: entry.id,
      name: entry.name,
      carModelId: requireCarModel(config, entry.carModelId ?? config.cars.defaultModelId).id,
      isPlayer: Boolean(entry.isPlayer),
      gridIndex: index,
      status: ParticipantStatus.PARRILLA, // pasa a EN_CARRERA con la señal de salida (RF-021)
      finished: false, // ha completado todas las vueltas (RF-025)
      finishTime: null, // tiempo real de llegada en s, congelado al terminar (RF-025)
      ...createCarState(slot), // pose en la parrilla más el estado dinámico del coche (parado)
      progress: createProgress(track, slot), // vueltas válidas, checkpoints y distancia válida (RN-01)
    };
  });

  // Pilotos IA por identificador de participante, en el orden de la parrilla (el azar se consume en ese orden).
  const drivers = {};
  const level = participants.some((participant) => !participant.isPlayer) ? aiLevel(config.ai, definition.difficulty) : null;
  for (const participant of participants) {
    if (participant.isPlayer) continue;
    drivers[participant.id] = createAiDriver(track, config.ai, level, config.carPerformance, config.race.car, random);
  }

  return {
    track,
    car: config.race.car,
    totalLaps: requireLapOption(config, laps),
    participants,
    drivers,
    standings: standingsOf({ participants }), // clasificación en vivo (ids de primero a último); `stepRace` la actualiza
    winner: null, // ganador (RF-024): el primero en completar las vueltas; se fija una vez y no cambia
    clock: createRaceClock(), // cuenta atrás y cronómetro de carrera
    get player() {
      return participants.find((participant) => participant.isPlayer);
    },
  };
}

/**
 * Avanza el reloj de la carrera y la señal de salida.
 * Mientras dura la cuenta atrás nadie se mueve (RF-020). En el paso en que termina, todos los
 * participantes pasan a `EN_CARRERA` a la vez (RF-021) y el cronómetro arranca desde cero; el sobrante
 * de ese paso cuenta ya como tiempo de carrera (RF-045).
 * @returns {{started: boolean, drivingTime: number}} `started` es verdadero solo en el paso de la señal
 *   de salida; `drivingTime` es el tiempo de carrera transcurrido en este paso (cero en la cuenta atrás)
 */
function advanceClock(race, step, config) {
  const previous = race.clock;
  race.clock = stepRaceClock(previous, step, config.race.countdown);
  const started = previous.phase !== race.clock.phase;
  if (started) {
    for (const participant of race.participants) participant.status = ParticipantStatus.EN_CARRERA;
  }
  let drivingTime = 0;
  if (started) drivingTime = race.clock.raceTime;
  else if (previous.phase === ClockPhase.RUNNING) drivingTime = step;
  return { started, drivingTime };
}

/**
 * Entrada que recibe un participante en este paso: ninguna si ya ha terminado (solo la inercia detiene
 * su coche), la indicada en `inputs` o, si no hay, la de su piloto IA (RF-028) o el reposo.
 * Los rivales usan las mismas entradas que el jugador (RF-003, RN-07).
 */
function participantInput(race, participant, inputs, config) {
  if (participant.finished) return IDLE_INPUT;
  const driver = race.drivers[participant.id];
  return inputs[participant.id] ?? (driver ? aiInput(driver, participant, config.ai) : IDLE_INPUT);
}

/**
 * Actualiza el progreso válido (RN-01) del participante tras moverse y lo marca como terminado al
 * completar las vueltas (RF-025): congela su `finishTime` (el cronómetro de ese paso).
 * @returns {boolean} verdadero si termina en este paso
 */
function updateProgress(race, participant) {
  // Un coche que no se ha movido no cambia su progreso: se evita buscar su punto más cercano del
  // trazado (el paso más caro) para los rivales parados en la parrilla.
  if (participant.x === participant.progress.x && participant.z === participant.progress.z) return false;
  participant.progress = stepProgress(participant.progress, race.track, participant);
  if (participant.progress.laps < race.totalLaps) return false;
  participant.finished = true;
  participant.finishTime = race.clock.raceTime;
  return true;
}

/**
 * Mueve un participante `drivingTime` segundos y actualiza su progreso.
 * Quien ya ha terminado se mueve por inercia, pero su progreso y su tiempo ya no cambian (RF-025, RF-027).
 * @returns {boolean} verdadero si termina en este paso
 */
function stepParticipant(race, participant, inputs, drivingTime, config) {
  const input = participantInput(race, participant, inputs, config);
  Object.assign(participant, stepCar(participant, input, drivingTime, config.carPerformance));
  if (participant.finished) return false;
  return updateProgress(race, participant);
}

/** Avanza a los participantes que ya están en carrera. @returns {string[]} los que terminan en este paso */
function stepParticipants(race, inputs, drivingTime, config) {
  const finished = [];
  if (drivingTime <= 0) return finished;
  for (const participant of race.participants) {
    if (participant.status !== ParticipantStatus.EN_CARRERA) continue;
    if (stepParticipant(race, participant, inputs, drivingTime, config)) finished.push(participant.id);
  }
  return finished;
}

/**
 * Registra el ganador (RF-024, RN-03) si aún no lo hay y alguien termina en este paso. Si varios llegan
 * en el mismo paso, gana el que va por delante en la clasificación (desempate por parrilla). Después ya
 * no cambia, ni siquiera cuando termina el jugador (RF-027).
 */
function recordWinner(race, finished) {
  if (race.winner !== null || finished.length === 0) return;
  const first = rankParticipants(race.participants.filter((participant) => finished.includes(participant.id)))[0];
  race.winner = Object.freeze({ id: first.id, name: first.name, isPlayer: first.isPlayer, finishTime: first.finishTime });
}

/**
 * Avanza la carrera `dt` segundos de simulación; modifica `race` en el sitio.
 * Encadena: reloj y salida, paso de cada participante (movimiento, progreso y llegada), ganador y
 * clasificación en vivo (`race.standings`, véase `standings.js`).
 * @param {ReturnType<typeof createRace>} race
 * @param {Record<string, {accelerate: boolean, brake: boolean, left: boolean, right: boolean}>} inputs entradas por id de participante;
 *   los pilotos IA (`race.drivers`) sin entrada propia producen las suyas (RF-028)
 * @param {number} dt segundos desde la actualización anterior (se limita a `carPerformance.maxStep`)
 * @param {object} config CONFIG (secciones `race`, `ai` y `carPerformance`)
 * Al completar `race.totalLaps` vueltas válidas, el participante termina (RF-025): su tiempo de llegada
 * y su progreso quedan congelados, sus controles dejan de actuar y su coche rueda por inercia hasta
 * detenerse. El reloj de la carrera no se detiene.
 * @returns {{started: boolean, finished: string[]}} `started` es verdadero solo en el paso de la señal
 *   de salida; `finished` lista los participantes que terminan en este paso
 */
export function stepRace(race, inputs, dt, config) {
  const step = Math.min(Math.max(dt, 0), config.carPerformance.maxStep);
  const { started, drivingTime } = advanceClock(race, step, config);
  const finished = stepParticipants(race, inputs, drivingTime, config);
  recordWinner(race, finished);
  race.standings = standingsOf(race);
  return { started, finished };
}

/** Tiempo de carrera de un participante: su tiempo final si ya ha terminado, o el cronómetro en curso. */
export function raceTimeOf(race, participant) {
  return participant.finishTime ?? race.clock.raceTime;
}
