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
  // En E1 no hay selección: el menú pasa directo a la parrilla. SELECCION se usará desde E2.
  [GameState.MENU]: [GameState.SELECCION, GameState.PARRILLA],
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

  /** Inicia una carrera desde el menú principal (MENU -> PARRILLA). */
  startRace() {
    if (this.#state !== GameState.MENU) {
      throw new Error(`Solo se puede iniciar una carrera desde ${GameState.MENU}`);
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
