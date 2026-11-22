// HUD de la carrera (DOM): señal de la cuenta atrás, cronómetro y vuelta (RF-020, RF-045, RF-044).
// Solo dibuja lo que recibe; no calcula tiempos ni decide nada de la competición.

export class RaceHud {
  #root;
  #signal;
  #timer;
  #lap;

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

    this.#lap = document.createElement('div');
    this.#lap.className = 'hud__lap';

    this.#root.append(this.#signal, this.#timer, this.#lap);
    container.append(this.#root);
  }

  /**
   * @param {string} signalText texto de la cuenta atrás o de la salida ('' si no hay nada)
   * @param {string} timeText tiempo de carrera ya formateado
   * @param {string} lapText contador de vueltas ya formateado, p. ej. «Vuelta 1/3»
   */
  update(signalText, timeText, lapText) {
    if (this.#signal.textContent !== signalText) this.#signal.textContent = signalText;
    if (this.#timer.textContent !== timeText) this.#timer.textContent = timeText;
    if (this.#lap.textContent !== lapText) this.#lap.textContent = lapText;
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
