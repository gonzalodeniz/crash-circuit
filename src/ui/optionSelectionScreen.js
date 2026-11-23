// Pantalla genérica de selección entre varias opciones (coche, circuito…). Solo interfaz: muestra las
// opciones que recibe y avisa con `onSelect`, `onConfirm` y `onBack`; no decide nada del juego.
// Admite un segundo grupo de opciones independiente (p. ej. las vueltas junto al circuito).
// La escena 3D se ve de fondo.

// Grupo de opciones excluyentes: una sola está elegida y solo esa entra en el orden de tabulación.
class OptionGroup {
  #element;
  #cards = new Map(); // id de la opción -> botón
  #ids;
  #selectedId = null;

  /**
   * @param {Array<{id: string}>} options opciones, en el orden en que se muestran
   * @param {string} groupLabel nombre accesible del grupo
   * @param {{renderOption: (option: object) => Node[], onSelect: (id: string) => void, onConfirm: () => void, listen: Function}} handlers
   *   `listen` registra un escucha para quitarlo al destruir la pantalla
   */
  constructor(options, groupLabel, { renderOption, onSelect, onConfirm, listen }) {
    this.#ids = options.map((option) => option.id);
    this.#element = document.createElement('div');
    this.#element.className = 'selection__options';
    this.#element.setAttribute('role', 'radiogroup');
    this.#element.setAttribute('aria-label', groupLabel);
    for (const option of options) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'selection__option';
      card.dataset.optionId = option.id;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
      card.tabIndex = -1;
      card.append(...renderOption(option));
      this.#cards.set(option.id, card);
      this.#element.append(card);
      listen(card, 'click', () => onSelect(option.id));
    }
    listen(this.#element, 'keydown', (event) => this.#onKeyDown(event, onSelect, onConfirm));
  }

  get element() {
    return this.#element;
  }

  // Flechas: cambian de opción (con ciclo); Intro confirma, como el botón de confirmar, pero solo una
  // vez por pulsación: mantenerla pulsada no encadena confirmaciones (`event.repeat`).
  #onKeyDown(event, onSelect, onConfirm) {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    if (step !== undefined && this.#selectedId !== null) {
      event.preventDefault();
      const index = this.#ids.indexOf(this.#selectedId);
      onSelect(this.#ids[(index + step + this.#ids.length) % this.#ids.length]);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) onConfirm();
    }
  }

  /** Marca como elegida la opción indicada; con `focus`, lleva también el foco a su tarjeta. */
  setSelected(id, focus) {
    this.#selectedId = id;
    for (const [optionId, card] of this.#cards) {
      const selected = optionId === id;
      card.setAttribute('aria-checked', String(selected));
      card.classList.toggle('selection__option--selected', selected);
      card.tabIndex = selected ? 0 : -1;
    }
    if (focus) this.#cards.get(id)?.focus();
  }
}

export class OptionSelectionScreen {
  #root;
  #group;
  #secondaryGroup = null;
  #confirmButton;
  #backButton;
  #listeners = [];

  /**
   * @param {HTMLElement} container elemento donde se inserta la pantalla
   * @param {{id: string, title: string, groupLabel: string, confirmLabel: string, backLabel: string}} texts
   *   identificador del elemento raíz y textos de la pantalla (una sección de `ui` de CONFIG)
   * @param {Array<{id: string}>} options opciones, en el orden en que se muestran
   * @param {{renderOption: (option: object) => Node[], onSelect: (id: string) => void, onConfirm: () => void, onBack: () => void}} handlers
   *   `renderOption` devuelve el contenido de la tarjeta de una opción; el resto son las acciones del jugador
   * @param {{title: string, groupLabel: string, options: Array<{id: string}>, renderOption: (option: object) => Node[], onSelect: (id: string) => void} | null} secondary
   *   segundo grupo de opciones, mostrado bajo el primero con su título (o `null` si no hay)
   */
  constructor(container, texts, options, { renderOption, onSelect, onConfirm, onBack }, secondary = null) {
    this.#root = document.createElement('div');
    this.#root.id = texts.id;
    this.#root.className = 'selection';
    this.#root.hidden = true;
    // Mantener Intro pulsada también repetiría los botones de la pantalla: se ignora la repetición.
    const listen = (target, type, handler) => this.#listen(target, type, handler);
    listen(this.#root, 'keydown', (event) => {
      if (event.key === 'Enter' && event.repeat) event.preventDefault();
    });

    const title = document.createElement('h2');
    title.className = 'selection__title';
    title.textContent = texts.title;

    this.#group = new OptionGroup(options, texts.groupLabel, { renderOption, onSelect, onConfirm, listen });
    const body = document.createElement('div');
    body.className = 'selection__body';
    body.append(this.#group.element);
    if (secondary) {
      this.#secondaryGroup = new OptionGroup(secondary.options, secondary.groupLabel, {
        renderOption: secondary.renderOption,
        onSelect: secondary.onSelect,
        onConfirm,
        listen,
      });
      const heading = document.createElement('h3');
      heading.className = 'selection__subtitle';
      heading.textContent = secondary.title;
      body.append(heading, this.#secondaryGroup.element);
    }

    const actions = document.createElement('div');
    actions.className = 'selection__actions';
    this.#backButton = this.#createButton(texts.backLabel);
    this.#confirmButton = this.#createButton(texts.confirmLabel);
    listen(this.#backButton, 'click', () => onBack());
    listen(this.#confirmButton, 'click', () => onConfirm());
    actions.append(this.#backButton, this.#confirmButton);

    this.#root.append(title, body, actions);
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

  /** Marca como elegida la opción indicada y lleva el foco a su tarjeta. */
  setSelected(id) {
    this.#group.setSelected(id, !this.#root.hidden);
  }

  /** Marca como elegida la opción indicada del segundo grupo y lleva el foco a su tarjeta. */
  setSecondarySelected(id) {
    this.#secondaryGroup.setSelected(id, !this.#root.hidden);
  }

  /** Muestra la pantalla con las opciones indicadas elegidas; el foco queda en el primer grupo. */
  show(selectedId, secondarySelectedId) {
    if (this.#secondaryGroup) this.#secondaryGroup.setSelected(secondarySelectedId, false);
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
