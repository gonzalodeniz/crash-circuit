// Entrada de teclado (DOM). Solo recoge las teclas pulsadas; no decide nada de la conducción.
// Mientras está activa, las flechas no disparan acciones del navegador (RF-010).

export class KeyboardInput {
  #controlKeys;
  #pressed = new Set();
  #enabled = false;
  #onKeyDown = (event) => {
    if (!this.#enabled || !this.#controlKeys.has(event.code)) return;
    event.preventDefault(); // evita el desplazamiento de la página y otras acciones del navegador
    this.#pressed.add(event.code);
  };
  #onKeyUp = (event) => {
    if (!this.#controlKeys.has(event.code)) return;
    if (this.#enabled) event.preventDefault();
    this.#pressed.delete(event.code);
  };
  #onBlur = () => this.#pressed.clear();

  /**
   * @param {object} controls sección `controls` de CONFIG
   */
  constructor(controls) {
    this.#controlKeys = new Set([
      controls.steerLeft,
      controls.steerRight,
      controls.accelerate,
      controls.brakeReverse,
    ]);
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', this.#onBlur);
  }

  /** Activa o desactiva la captura de las flechas (activa solo durante la carrera). */
  setEnabled(enabled) {
    this.#enabled = enabled;
    if (!enabled) this.#pressed.clear();
  }

  /** Códigos de las teclas de conducción pulsadas ahora. */
  get pressedKeys() {
    return this.#pressed;
  }

  dispose() {
    window.removeEventListener('keydown', this.#onKeyDown);
    window.removeEventListener('keyup', this.#onKeyUp);
    window.removeEventListener('blur', this.#onBlur);
  }
}
