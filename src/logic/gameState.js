// Máquina de estados del juego. Lógica pura: no importa Three.js ni el DOM (RNF-05).

export const GameState = Object.freeze({
  MENU: 'MENU',
  SELECCION: 'SELECCION',
  PARRILLA: 'PARRILLA',
  CUENTA_ATRAS: 'CUENTA_ATRAS',
  EN_CARRERA: 'EN_CARRERA',
  PAUSA: 'PAUSA',
  RESULTADOS: 'RESULTADOS',
});

// Transiciones permitidas entre estados.
export const TRANSITIONS = Object.freeze({
  // Desde E2 el menú pasa por la selección; la parrilla solo se alcanza al confirmarla.
  [GameState.MENU]: [GameState.SELECCION],
  [GameState.SELECCION]: [GameState.MENU, GameState.PARRILLA],
  [GameState.PARRILLA]: [GameState.CUENTA_ATRAS],
  [GameState.CUENTA_ATRAS]: [GameState.EN_CARRERA],
  [GameState.EN_CARRERA]: [GameState.PAUSA, GameState.RESULTADOS],
  // Desde pausa: reanudar, reiniciar (PARRILLA) o abandonar (MENU).
  [GameState.PAUSA]: [GameState.EN_CARRERA, GameState.PARRILLA, GameState.MENU],
  // Desde resultados: repetir (PARRILLA), elegir otra carrera (SELECCION) o menú.
  [GameState.RESULTADOS]: [GameState.PARRILLA, GameState.SELECCION, GameState.MENU],
});

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export class GameStateMachine {
  #state = GameState.MENU;
  #listeners = new Set();

  get state() {
    return this.#state;
  }

  /** Cambia de estado; lanza un error si la transición no está permitida. */
  transitionTo(next) {
    if (!canTransition(this.#state, next)) {
      throw new Error(`Transición no permitida: ${this.#state} -> ${next}`);
    }
    const previous = this.#state;
    this.#state = next;
    for (const listener of this.#listeners) listener(previous, next);
    return this.#state;
  }

  /** Registra una función que recibe `(anterior, nuevo)` en cada cambio de estado; devuelve cómo darla de baja. */
  onChange(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Empieza la cuenta atrás de salida (PARRILLA -> CUENTA_ATRAS). */
  beginCountdown() {
    return this.transitionTo(GameState.CUENTA_ATRAS);
  }

  /** Da la señal de salida (CUENTA_ATRAS -> EN_CARRERA). */
  startGo() {
    return this.transitionTo(GameState.EN_CARRERA);
  }

  /** Abre la selección desde el menú principal (MENU -> SELECCION, RF-002). */
  openSelection() {
    if (this.#state !== GameState.MENU) {
      throw new Error(`Solo se puede abrir la selección desde ${GameState.MENU}`);
    }
    return this.transitionTo(GameState.SELECCION);
  }

  /** Vuelve al menú desde la selección (SELECCION -> MENU). */
  cancelSelection() {
    if (this.#state !== GameState.SELECCION) {
      throw new Error(`Solo se puede cancelar la selección desde ${GameState.SELECCION}`);
    }
    return this.transitionTo(GameState.MENU);
  }

  /** Confirma la selección e inicia la carrera (SELECCION -> PARRILLA). */
  startRace() {
    if (this.#state !== GameState.SELECCION) {
      throw new Error(`Solo se puede iniciar una carrera desde ${GameState.SELECCION}`);
    }
    return this.transitionTo(GameState.PARRILLA);
  }

  /** El jugador completa sus vueltas y se abren los resultados (EN_CARRERA -> RESULTADOS, RF-025). */
  finishRace() {
    return this.transitionTo(GameState.RESULTADOS);
  }

  /** Repite la carrera con la misma configuración (RESULTADOS -> PARRILLA, RF-057). */
  repeatRace() {
    if (this.#state !== GameState.RESULTADOS) {
      throw new Error(`Solo se puede repetir la carrera desde ${GameState.RESULTADOS}`);
    }
    return this.transitionTo(GameState.PARRILLA);
  }

  /** Vuelve al menú principal desde los resultados (RESULTADOS -> MENU, RF-008). */
  backToMenu() {
    if (this.#state !== GameState.RESULTADOS) {
      throw new Error(`Solo se puede volver al menú desde ${GameState.RESULTADOS}`);
    }
    return this.transitionTo(GameState.MENU);
  }
}
