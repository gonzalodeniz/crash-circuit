// Pantalla de resultados (RF-056, RF-024, RF-027). Solo interfaz: muestra los textos que recibe
// (ganador, puesto y tiempo del jugador y llegadas anteriores) y avisa con `onRepeat` y `onMenu`; no
// decide nada de la competición.

export class ResultsScreen {
  #root;
  #banner;
  #winner;
  #position;
  #time;
  #arrivalsSection;
  #arrivals;
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

    // Aviso destacado: solo se ve si gana el jugador.
    this.#banner = document.createElement('div');
    this.#banner.className = 'results__banner';
    this.#banner.textContent = resultsConfig.playerWinsMessage;
    this.#banner.hidden = true;

    this.#winner = this.#createSummaryLine(resultsConfig.winnerLabel);
    this.#position = this.#createSummaryLine(resultsConfig.positionLabel);

    const timeLabel = document.createElement('div');
    timeLabel.className = 'results__label';
    timeLabel.textContent = resultsConfig.timeLabel;

    this.#time = document.createElement('div');
    this.#time.className = 'results__time';
    this.#time.setAttribute('aria-live', 'polite');

    // Participantes que llegaron antes que el jugador, con su tiempo real (RF-027).
    this.#arrivalsSection = document.createElement('div');
    this.#arrivalsSection.className = 'results__arrivals';
    const arrivalsTitle = document.createElement('div');
    arrivalsTitle.className = 'results__label';
    arrivalsTitle.textContent = resultsConfig.arrivalsTitle;
    this.#arrivals = document.createElement('ol');
    this.#arrivals.className = 'results__list';
    this.#arrivalsSection.append(arrivalsTitle, this.#arrivals);

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

    this.#root.append(title, this.#banner, this.#winner.line, this.#position.line, timeLabel, this.#time, this.#arrivalsSection, actions);
    container.append(this.#root);
  }

  // Línea «Etiqueta: valor»; devuelve la línea y el elemento del valor.
  #createSummaryLine(label) {
    const line = document.createElement('div');
    line.className = 'results__line';
    const name = document.createElement('span');
    name.className = 'results__label';
    name.textContent = label;
    const value = document.createElement('span');
    value.className = 'results__value';
    line.append(name, value);
    return { line, value };
  }

  #createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'results__button';
    button.textContent = label;
    return button;
  }

  /**
   * Muestra la pantalla con los textos ya preparados y da el foco a «Repetir».
   * @param {{playerWon: boolean, winnerName: string, winnerTime: string, positionText: string, timeText: string,
   *   arrivals: Array<{positionText: string, name: string, timeText: string}>}} view
   */
  show(view) {
    this.#banner.hidden = !view.playerWon;
    this.#winner.value.textContent = `${view.winnerName} · ${view.winnerTime}`;
    this.#position.value.textContent = view.positionText;
    this.#time.textContent = view.timeText;
    this.#arrivals.replaceChildren(
      ...view.arrivals.map((arrival) => {
        const item = document.createElement('li');
        item.className = 'results__item';
        for (const text of [arrival.positionText, arrival.name, arrival.timeText]) {
          const cell = document.createElement('span');
          cell.textContent = text;
          item.append(cell);
        }
        return item;
      }),
    );
    this.#arrivalsSection.hidden = view.arrivals.length === 0;
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
