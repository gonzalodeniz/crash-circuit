// Pantalla de selección de coche (RF-002). Solo interfaz: muestra los modelos que recibe y avisa con
// `onSelect`, `onConfirm` y `onBack`; no decide nada del juego. El coche se ve en la escena 3D de fondo.

export class CarSelectionScreen {
  #root;
  #group;
  #confirmButton;
  #backButton;
  #cards = new Map(); // id del modelo -> botón
  #ids;
  #selectedId = null;
  #listeners = [];

  /**
   * @param {HTMLElement} container elemento donde se inserta la pantalla
   * @param {object} selectionConfig sección `ui.selection` de CONFIG
   * @param {Array<{id: string, name: string, appearance: object}>} models modelos del catálogo (`cars.models`)
   * @param {{onSelect: (id: string) => void, onConfirm: () => void, onBack: () => void}} callbacks acciones del jugador
   */
  constructor(container, selectionConfig, models, { onSelect, onConfirm, onBack }) {
    this.#ids = models.map((model) => model.id);
    this.#root = document.createElement('div');
    this.#root.id = 'car-selection';
    this.#root.className = 'selection';
    this.#root.hidden = true;

    const title = document.createElement('h2');
    title.className = 'selection__title';
    title.textContent = selectionConfig.title;

    // Grupo de opciones excluyentes: una sola está elegida y solo esa entra en el orden de tabulación.
    this.#group = document.createElement('div');
    this.#group.className = 'selection__cars';
    this.#group.setAttribute('role', 'radiogroup');
    this.#group.setAttribute('aria-label', selectionConfig.groupLabel);
    for (const model of models) {
      const card = this.#createCard(model);
      this.#cards.set(model.id, card);
      this.#group.append(card);
      this.#listen(card, 'click', () => onSelect(model.id));
    }
    this.#listen(this.#group, 'keydown', (event) => this.#onKeyDown(event, onSelect, onConfirm));

    const actions = document.createElement('div');
    actions.className = 'selection__actions';
    this.#backButton = this.#createButton(selectionConfig.backLabel);
    this.#confirmButton = this.#createButton(selectionConfig.confirmLabel);
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

  #createCard(model) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'selection__car';
    card.dataset.modelId = model.id;
    card.setAttribute('role', 'radio');
    card.setAttribute('aria-checked', 'false');
    card.tabIndex = -1;

    // Muestra de los colores del modelo (carrocería, cabina y adorno).
    const swatch = document.createElement('span');
    swatch.className = 'selection__swatch';
    for (const color of [model.appearance.bodyColor, model.appearance.cabinColor, model.appearance.accentColor]) {
      const chip = document.createElement('span');
      chip.className = 'selection__chip';
      chip.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`; // CSSOM: la CSP no lo bloquea
      swatch.append(chip);
    }
    const name = document.createElement('span');
    name.className = 'selection__name';
    name.textContent = model.name;
    card.append(swatch, name);
    return card;
  }

  #createButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'selection__button';
    button.textContent = label;
    return button;
  }

  // Flechas: cambian de modelo (con ciclo); Intro confirma, como el botón «Confirmar».
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

  /** Marca como elegido el modelo indicado y lleva el foco a su tarjeta. */
  setSelected(id) {
    this.#selectedId = id;
    for (const [modelId, card] of this.#cards) {
      const selected = modelId === id;
      card.setAttribute('aria-checked', String(selected));
      card.classList.toggle('selection__car--selected', selected);
      card.tabIndex = selected ? 0 : -1;
    }
    if (!this.#root.hidden) this.#cards.get(id)?.focus();
  }

  /** Muestra la pantalla con el modelo indicado elegido. */
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
