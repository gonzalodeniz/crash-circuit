// Pantalla genérica de selección entre varias opciones (coche, circuito…). Solo interfaz: muestra las
// opciones que recibe y avisa con `onSelect`, `onConfirm` y `onBack`; no decide nada del juego.
// La escena 3D se ve de fondo.

export class OptionSelectionScreen {
  #root;
  #group;
  #confirmButton;
  #backButton;
  #cards = new Map(); // id de la opción -> botón
  #ids;
  #selectedId = null;
  #listeners = [];

  /**
   * @param {HTMLElement} container elemento donde se inserta la pantalla
   * @param {{id: string, title: string, groupLabel: string, confirmLabel: string, backLabel: string}} texts
   *   identificador del elemento raíz y textos de la pantalla (una sección de `ui` de CONFIG)
   * @param {Array<{id: string}>} options opciones, en el orden en que se muestran
   * @param {{renderOption: (option: object) => Node[], onSelect: (id: string) => void, onConfirm: () => void, onBack: () => void}} handlers
   *   `renderOption` devuelve el contenido de la tarjeta de una opción; el resto son las acciones del jugador
   */
  constructor(container, texts, options, { renderOption, onSelect, onConfirm, onBack }) {
    this.#ids = options.map((option) => option.id);
    this.#root = document.createElement('div');
    this.#root.id = texts.id;
    this.#root.className = 'selection';
    this.#root.hidden = true;

    const title = document.createElement('h2');
    title.className = 'selection__title';
    title.textContent = texts.title;

    // Grupo de opciones excluyentes: una sola está elegida y solo esa entra en el orden de tabulación.
    this.#group = document.createElement('div');
    this.#group.className = 'selection__options';
    this.#group.setAttribute('role', 'radiogroup');
    this.#group.setAttribute('aria-label', texts.groupLabel);
    for (const option of options) {
      const card = this.#createCard(option, renderOption(option));
      this.#cards.set(option.id, card);
      this.#group.append(card);
      this.#listen(card, 'click', () => onSelect(option.id));
    }
    this.#listen(this.#group, 'keydown', (event) => this.#onKeyDown(event, onSelect, onConfirm));

    const actions = document.createElement('div');
    actions.className = 'selection__actions';
    this.#backButton = this.#createButton(texts.backLabel);
    this.#confirmButton = this.#createButton(texts.confirmLabel);
    this.#listen(this.#backButton, 'click', () => onBack());
    this.#listen(this.#confirmButton, 'click', () => onConfirm());
    actions.append(this.#backButton, this.#confirmButton);

    this.#root.append(title, this.#group, actions);
    container.append(this.#root);
  }

  #listen(target, type, handler) {
    target.addEventListener(type, handler);
    this.#listeners.push(() => target.removeEventListener(type, handler));
  }

  #createCard(option, content) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'selection__option';
    card.dataset.optionId = option.id;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.tabIndex = -1;
    card.append(...content);
    return card;
  }

  #createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'selection__button';
    button.textContent = label;
    return button;
  }

  // Flechas: cambian de opción (con ciclo); Intro confirma, como el botón de confirmar.
  #onKeyDown(event, onSelect, onConfirm) {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (step !== undefined && this.#selectedId !== null) {
      event.preventDefault();
      const index = this.#ids.indexOf(this.#selectedId);
      onSelect(this.#ids[(index + step + this.#ids.length) % this.#ids.length]);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm();
    }
  }

  /** Marca como elegida la opción indicada y lleva el foco a su tarjeta. */
  setSelected(id) {
    this.#selectedId = id;
    for (const [optionId, card] of this.#cards) {
      const selected = optionId === id;
      card.setAttribute('aria-checked', String(selected));
      card.classList.toggle('selection__option--selected', selected);
      card.tabIndex = selected ? 0 : -1;
    }
    if (!this.#root.hidden) this.#cards.get(id)?.focus();
  }

  /** Muestra la pantalla con la opción indicada elegida. */
  show(selectedId) {
    this.#root.hidden = false;
    this.setSelected(selectedId);
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
