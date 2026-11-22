// Pantalla de resultados (RF-056). Solo interfaz: muestra el tiempo que recibe y avisa con
// `onRepeat` y `onMenu`; no decide nada de la competición.

export class ResultsScreen {
  #root;
  #time;
  #repeatButton;
  #menuButton;
  #onRepeat;
  #onMenu;

  /**
   * @param {HTMLElement} container elemento donde se inserta la pantalla
   * @param {object} resultsConfig sección `ui.results` de CONFIG
   * @param {{onRepeat: () => void, onMenu: () => void}} callbacks acciones que el jugador puede elegir
   */
  constructor(container, resultsConfig, { onRepeat, onMenu }) {
    this.#root = document.createElement('div');
    this.#root.id = 'results-screen';
    this.#root.className = 'results';
    this.#root.hidden = true;

    const title = document.createElement('h2');
    title.className = 'results__title';
    title.textContent = resultsConfig.title;

    const timeLabel = document.createElement('div');
    timeLabel.className = 'results__label';
    timeLabel.textContent = resultsConfig.timeLabel;

    this.#time = document.createElement('div');
    this.#time.className = 'results__time';
    this.#time.setAttribute('aria-live', 'polite');

    // Los <button> se activan con el ratón y con Intro/Espacio sin código extra.
    const actions = document.createElement('div');
    actions.className = 'results__actions';
    this.#repeatButton = this.#createButton(resultsConfig.repeatLabel);
    this.#menuButton = this.#createButton(resultsConfig.menuLabel);
    this.#onRepeat = () => onRepeat();
    this.#onMenu = () => onMenu();
    this.#repeatButton.addEventListener('click', this.#onRepeat);
    this.#menuButton.addEventListener('click', this.#onMenu);
    actions.append(this.#repeatButton, this.#menuButton);

    this.#root.append(title, timeLabel, this.#time, actions);
    container.append(this.#root);
  }

  #createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'results__button';
    button.textContent = label;
    return button;
  }

  /** Muestra la pantalla con el tiempo final ya formateado y da el foco a «Repetir». */
  show(timeText) {
    this.#time.textContent = timeText;
    this.#root.hidden = false;
    this.#repeatButton.focus();
  }

  hide() {
    this.#root.hidden = true;
  }

  /** Quita la pantalla y sus escuchas. */
  dispose() {
    this.#repeatButton.removeEventListener('click', this.#onRepeat);
    this.#menuButton.removeEventListener('click', this.#onMenu);
    this.#root.remove();
  }
}
