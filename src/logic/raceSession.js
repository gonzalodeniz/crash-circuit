// Sesión de carrera: orquesta el flujo de la partida sobre la máquina de estados. Lógica pura (RNF-05).
// Guarda el coche, el circuito y las vueltas elegidos, los pasos de la selección y la configuración
// confirmada de la que sale la carrera. Decide cuándo se crea y se descarta la carrera, cuándo empieza la cuenta atrás, cuándo se da la salida y cuándo se abren los
// resultados. Quien la use (main.js) solo traduce eventos y dibuja.
import { GameState } from './gameState.js';
import { stepRace } from './race.js';
import { requireCarModel } from './carModels.js';
import { requireTrackDefinition } from './trackCatalog.js';
import { requireLapOption } from './lapOptions.js';
import { createRaceFromSetup, createRaceSetup, defaultRaceSetup } from './raceSetup.js';

// Estados en los que la simulación avanza. En PAUSA (E7) y fuera de la carrera no avanza nada.
// RESULTADOS sigue avanzando: el coche del jugador rueda por inercia tras terminar (RN-03, RF-025).
const SIMULATED_STATES = new Set([GameState.CUENTA_ATRAS, GameState.EN_CARRERA, GameState.RESULTADOS]);

/** Pasos de la selección, en orden: el coche, el circuito con las vueltas y el resumen (RF-002, RF-004, RF-007). */
export const SelectionStep = Object.freeze({ CAR: 'CAR', TRACK: 'TRACK', SUMMARY: 'SUMMARY' });

const NO_PROGRESS = Object.freeze({ started: false, finished: Object.freeze([]), playerFinished: false });

export class RaceSession {
  #stateMachine;
  #config;
  #race = null;
  #selectedCarModelId;
  #selectedTrackId;
  #selectedLaps;
  #confirmedSetup = null;
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
    this.#resetChoices();
    this.#unsubscribe = stateMachine.onChange((from, to) => this.#handleChange(from, to));
  }

  // Vuelve a las opciones preseleccionadas de CONFIG.
  #resetChoices() {
    const defaults = defaultRaceSetup(this.#config);
    this.#selectedCarModelId = defaults.carModelId;
    this.#selectedTrackId = defaults.trackId;
    this.#selectedLaps = defaults.laps;
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

  /** Número de vueltas elegido para la próxima carrera (solo en memoria; se reinicia al recargar). */
  get selectedLaps() {
    return this.#selectedLaps;
  }

  /** Elige el número de vueltas (uno de `race.lapOptions`); solo durante la selección (RF-006). */
  selectLaps(laps) {
    if (this.#stateMachine.state !== GameState.SELECCION) {
      throw new Error(`Solo se puede elegir el número de vueltas en ${GameState.SELECCION}`);
    }
    this.#selectedLaps = requireLapOption(this.#config, laps);
  }

  /**
   * Configuración que se confirmaría ahora (coche, circuito y vueltas elegidos), para el resumen de la
   * selección (RF-007). Lanza un error si falta algún valor o no está en el catálogo.
   */
  get pendingSetup() {
    return createRaceSetup(this.#config, {
      carModelId: this.#selectedCarModelId,
      trackId: this.#selectedTrackId,
      laps: this.#selectedLaps,
    });
  }

  /**
   * Configuración confirmada de la carrera en curso, de la que sale la carrera; `null` fuera de ella.
   * Repetir la carrera la reutiliza (RF-057) y volver al menú o a la selección la descarta.
   */
  get confirmedSetup() {
    return this.#confirmedSetup;
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
   * Confirma el paso en curso de la selección: del coche se pasa al circuito con sus vueltas, de ahí al
   * resumen y, al confirmar el resumen, empieza la carrera (`SELECCION -> PARRILLA`, RF-007).
   */
  confirmSelection() {
    if (this.#stateMachine.state !== GameState.SELECCION) {
      throw new Error(`Solo se puede confirmar la selección en ${GameState.SELECCION}`);
    }
    if (this.#selectionStep === SelectionStep.CAR) this.#selectionStep = SelectionStep.TRACK;
    else if (this.#selectionStep === SelectionStep.TRACK) this.#selectionStep = SelectionStep.SUMMARY;
    else this.#stateMachine.startRace();
  }

  /** Vuelve al paso anterior de la selección; desde el primero, al menú (`SELECCION -> MENU`). */
  backSelection() {
    if (this.#stateMachine.state !== GameState.SELECCION) {
      throw new Error(`Solo se puede volver atrás en ${GameState.SELECCION}`);
    }
    if (this.#selectionStep === SelectionStep.SUMMARY) this.#selectionStep = SelectionStep.TRACK;
    else if (this.#selectionStep === SelectionStep.TRACK) this.#selectionStep = SelectionStep.CAR;
    else this.#stateMachine.cancelSelection();
  }

  #handleChange(from, to) {
    if (to === GameState.PARRILLA) {
      // Al confirmar la selección se fija la configuración; al repetir desde resultados (RF-057) se
      // reutiliza la ya confirmada. La carrera sale siempre de ella (RF-007).
      if (from === GameState.SELECCION) this.#confirmedSetup = this.pendingSetup;
      this.#race = createRaceFromSetup(this.#config, this.#confirmedSetup);
    } else if (to === GameState.MENU || to === GameState.SELECCION) {
      this.#race = null;
      this.#confirmedSetup = null;
      this.#selectionStep = SelectionStep.CAR; // la selección siempre empieza por el coche
      // Una selección nueva desde el menú parte de las opciones por defecto; la de «otra carrera»
      // desde los resultados conserva las últimas elegidas.
      if (to === GameState.MENU) this.#resetChoices();
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
