// Sesión de carrera: orquesta el flujo de la partida sobre la máquina de estados. Lógica pura (RNF-05).
// Guarda el coche y el circuito elegidos y los pasos de la selección. Decide cuándo se crea y se
// descarta la carrera, cuándo empieza la cuenta atrás, cuándo se da la salida y cuándo se abren los
// resultados. Quien la use (main.js) solo traduce eventos y dibuja.
import { GameState } from './gameState.js';
import { createRace, stepRace } from './race.js';
import { requireCarModel } from './carModels.js';
import { requireTrackDefinition } from './trackCatalog.js';

// Estados en los que la simulación avanza. En PAUSA (E7) y fuera de la carrera no avanza nada.
// RESULTADOS sigue avanzando: el coche del jugador rueda por inercia tras terminar (RN-03, RF-025).
const SIMULATED_STATES = new Set([GameState.CUENTA_ATRAS, GameState.EN_CARRERA, GameState.RESULTADOS]);

/** Pasos de la selección, en orden: primero el coche y después el circuito (RF-002, RF-004). */
export const SelectionStep = Object.freeze({ CAR: 'CAR', TRACK: 'TRACK' });

const NO_PROGRESS = Object.freeze({ started: false, finished: Object.freeze([]), playerFinished: false });

export class RaceSession {
  #stateMachine;
  #config;
  #race = null;
  #selectedCarModelId;
  #selectedTrackId;
  #selectionStep = SelectionStep.CAR;
  #unsubscribe;

  /**
   * Se suscribe a la máquina de estados. Debe crearse antes que cualquier otro oyente que lea `race`,
   * porque los oyentes se avisan en orden de registro y la carrera se crea al entrar en `PARRILLA`.
   * @param {import('./gameState.js').GameStateMachine} stateMachine
   * @param {object} config CONFIG
   */
  constructor(stateMachine, config) {
    this.#stateMachine = stateMachine;
    this.#config = config;
    this.#selectedCarModelId = config.cars.defaultModelId;
    this.#selectedTrackId = config.tracks.defaultId;
    this.#unsubscribe = stateMachine.onChange((from, to) => this.#handleChange(to));
  }

  /** Carrera en curso, o `null` si no hay ninguna (menú o selección). */
  get race() {
    return this.#race;
  }

  /** Modelo de coche elegido para la próxima carrera (solo en memoria; se reinicia al recargar). */
  get selectedCarModelId() {
    return this.#selectedCarModelId;
  }

  /** Elige el modelo de coche del jugador; solo se puede cambiar durante la selección (RF-002). */
  selectCarModel(id) {
    if (this.#stateMachine.state !== GameState.SELECCION) {
      throw new Error(`Solo se puede elegir coche en ${GameState.SELECCION}`);
    }
    this.#selectedCarModelId = requireCarModel(this.#config, id).id;
  }

  /** Circuito elegido para la próxima carrera (solo en memoria; se reinicia al recargar). */
  get selectedTrackId() {
    return this.#selectedTrackId;
  }

  /** Paso en curso de la selección (`SelectionStep`); solo tiene sentido en `SELECCION`. */
  get selectionStep() {
    return this.#selectionStep;
  }

  /** Elige el circuito de la carrera; solo se puede cambiar durante la selección (RF-004). */
  selectTrack(id) {
    if (this.#stateMachine.state !== GameState.SELECCION) {
      throw new Error(`Solo se puede elegir circuito en ${GameState.SELECCION}`);
    }
    this.#selectedTrackId = requireTrackDefinition(this.#config, id).id;
  }

  /**
   * Confirma el paso en curso de la selección: del coche se pasa al circuito y, al confirmar el
   * circuito, empieza la carrera (`SELECCION -> PARRILLA`).
   */
  confirmSelection() {
    if (this.#stateMachine.state !== GameState.SELECCION) {
      throw new Error(`Solo se puede confirmar la selección en ${GameState.SELECCION}`);
    }
    if (this.#selectionStep === SelectionStep.CAR) this.#selectionStep = SelectionStep.TRACK;
    else this.#stateMachine.startRace();
  }

  /** Vuelve al paso anterior de la selección; desde el primero, al menú (`SELECCION -> MENU`). */
  backSelection() {
    if (this.#stateMachine.state !== GameState.SELECCION) {
      throw new Error(`Solo se puede volver atrás en ${GameState.SELECCION}`);
    }
    if (this.#selectionStep === SelectionStep.TRACK) this.#selectionStep = SelectionStep.CAR;
    else this.#stateMachine.cancelSelection();
  }

  #handleChange(to) {
    if (to === GameState.PARRILLA) {
      // También al repetir desde resultados: una carrera nueva con el mismo modelo elegido (RF-057).
      const player = { ...this.#config.race.player, carModelId: this.#selectedCarModelId };
      this.#race = createRace(this.#config, [player], this.#selectedTrackId);
    } else if (to === GameState.MENU || to === GameState.SELECCION) {
      this.#race = null;
      this.#selectionStep = SelectionStep.CAR; // la selección siempre empieza por el coche
    }
  }

  /**
   * Avanza la partida `dt` segundos y aplica las transiciones que corresponden:
   * `PARRILLA -> CUENTA_ATRAS` (RF-020), `CUENTA_ATRAS -> EN_CARRERA` con la señal de salida (RF-021)
   * y `EN_CARRERA -> RESULTADOS` cuando el jugador termina (RN-03, RF-025), una sola vez.
   * No avanza nada si no hay carrera o el estado no es `CUENTA_ATRAS`, `EN_CARRERA` ni `RESULTADOS`.
   * @param {number} dt segundos desde la actualización anterior (la lógica lo limita a `maxStep`)
   * @param {Record<string, {accelerate: boolean, brake: boolean, left: boolean, right: boolean}>} inputs entradas por id de participante
   * @returns {{started: boolean, finished: readonly string[], playerFinished: boolean}}
   */
  step(dt, inputs) {
    if (this.#race === null) return NO_PROGRESS;
    // La parrilla da paso a la cuenta atrás; esa transición no avanza la simulación.
    if (this.#stateMachine.state === GameState.PARRILLA) {
      this.#stateMachine.beginCountdown();
    }
    if (!SIMULATED_STATES.has(this.#stateMachine.state)) return NO_PROGRESS;

    const race = this.#race;
    const { started, finished } = stepRace(race, inputs, dt, this.#config);
    if (started) this.#stateMachine.startGo();
    const playerFinished = finished.includes(race.player.id);
    if (playerFinished) this.#stateMachine.finishRace();
    return { started, finished, playerFinished };
  }

  /** Deja de escuchar a la máquina de estados y descarta la carrera. */
  dispose() {
    this.#unsubscribe();
    this.#race = null;
  }
}
