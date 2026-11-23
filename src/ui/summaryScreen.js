// Resumen de la selección (RF-007), tercer paso. Solo interfaz: muestra los datos que recibe ya
// preparados (coche, circuito, dificultad y vueltas) y avisa con `onConfirm` y `onBack`; no decide
// nada del juego. La escena 3D se ve de fondo.

export class SummaryScreen {
  #root;
  #values = new Map(); // clave del dato -> elemento con su valor
  #confirmButton;
  #backButton;
  #listeners = [];
  #difficultyLabels;

  /**
   * @param {HTMLElement} container elemento donde se inserta la pantalla
   * @param {object} texts sección `ui.summary` de CONFIG
   * @param {Record<string, string>} difficultyLabels etiquetas de dificultad (`ui.trackSelection.difficultyLabels`)
   * @param {{onConfirm: () => void, onBack: () => void}} callbacks acciones del jugador
   */
  constructor(container, texts, difficultyLabels, { onConfirm, onBack }) {
    this.#difficultyLabels = difficultyLabels;
    this.#root = document.createElement('div');
    this.#root.id = 'race-summary';
    this.#root.className = 'selection';
    this.#root.hidden = true;
    // Mantener Intro pulsada también repetiría los botones de la pantalla: se ignora la repetición.
    this.#listen(this.#root, 'keydown', (event) => {
      if (event.key === 'Enter' && event.repeat) event.preventDefault();
    });

    const title = document.createElement('h2');
    title.className = 'selection__title';
    title.textContent = texts.title;

    const list = document.createElement('dl');
    list.className = 'selection__summary';
    for (const [key, label] of [
      ['carName', texts.carLabel],
      ['trackName', texts.trackLabel],
      ['difficulty', texts.difficultyLabel],
      ['laps', texts.lapsLabel],
    ]) {
      const term = document.createElement('dt');
      term.textContent = label;
      const value = document.createElement('dd');
      this.#values.set(key, value);
      list.append(term, value);
    }

    const actions = document.createElement('div');
    actions.className = 'selection__actions';
    this.#backButton = this.#createButton(texts.backLabel);
    this.#confirmButton = this.#createButton(texts.confirmLabel);
    this.#listen(this.#backButton, 'click', () => onBack());
    this.#listen(this.#confirmButton, 'click', () => onConfirm());
    actions.append(this.#backButton, this.#confirmButton);

    this.#root.append(title, list, actions);
    container.append(this.#root);
  }

  #listen(target, type, handler) {
    target.addEventListener(type, handler);
    this.#listeners.push(() => target.removeEventListener(type, handler));
  }

  #createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'selection__button';
    button.textContent = label;
    return button;
  }

  /**
   * Muestra la pantalla con los datos de la configuración elegida y da el foco a «¡A correr!».
   * @param {{carName: string, trackName: string, difficulty: string, laps: number}} summary
   */
  show({ carName, trackName, difficulty, laps }) {
    this.#values.get('carName').textContent = carName;
    this.#values.get('trackName').textContent = trackName;
    this.#values.get('difficulty').textContent = this.#difficultyLabels[difficulty];
    this.#values.get('laps').textContent = String(laps);
    this.#root.hidden = false;
    this.#confirmButton.focus();
  }

  hide() {
    this.#root.hidden = true;
  }

  /** Quita la pantalla y sus escuchas. */
  dispose() {
    for (const remove of this.#listeners) remove();
    this.#listeners = [];
    this.#root.remove();
  }
}
