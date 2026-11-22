// HUD de la carrera (DOM): señal de la cuenta atrás y cronómetro (RF-020, RF-045).
// Solo dibuja lo que recibe; no calcula tiempos ni decide nada de la competición.

export class RaceHud {
  #root;
  #signal;
  #timer;

  /**
   * @param {HTMLElement} container elemento donde se inserta el HUD
   */
  constructor(container) {
    this.#root = document.createElement('div');
    this.#root.id = 'race-hud';
    this.#root.className = 'hud';
    this.#root.hidden = true;

    this.#signal = document.createElement('div');
    this.#signal.className = 'hud__signal';
    this.#signal.setAttribute('aria-live', 'assertive');

    this.#timer = document.createElement('div');
    this.#timer.className = 'hud__timer';

    this.#root.append(this.#signal, this.#timer);
    container.append(this.#root);
  }

  /**
   * @param {string} signalText texto de la cuenta atrás o de la salida ('' si no hay nada)
   * @param {string} timeText tiempo de carrera ya formateado
   */
  update(signalText, timeText) {
    if (this.#signal.textContent !== signalText) this.#signal.textContent = signalText;
    if (this.#timer.textContent !== timeText) this.#timer.textContent = timeText;
  }

  show() {
    this.#root.hidden = false;
  }

  hide() {
    this.#root.hidden = true;
  }

  dispose() {
    this.#root.remove();
  }
}
