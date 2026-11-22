// Menú principal (RF-001). Solo interfaz: no decide nada del juego; avisa con `onStart`.

export class MainMenu {
  #root;
  #button;
  #onClick;

  /**
   * @param {HTMLElement} container elemento donde se inserta el menú
   * @param {object} menuConfig sección `ui.menu` de CONFIG
   * @param {() => void} onStart se llama al activar la opción de empezar
   */
  constructor(container, menuConfig, onStart) {
    this.#root = document.createElement('div');
    this.#root.id = 'main-menu';
    this.#root.className = 'menu';

    const title = document.createElement('h1');
    title.className = 'menu__title';
    title.textContent = menuConfig.title;

    // Un <button> se activa con el ratón y con Intro/Espacio sin código extra.
    this.#button = document.createElement('button');
    this.#button.type = 'button';
    this.#button.className = 'menu__start';
    this.#button.textContent = menuConfig.startLabel;
    this.#onClick = () => onStart();
    this.#button.addEventListener('click', this.#onClick);

    this.#root.append(title, this.#button);
    container.append(this.#root);
    this.#button.focus();
  }

  show() {
    this.#root.hidden = false;
    this.#button.focus();
  }

  hide() {
    this.#root.hidden = true;
  }

  /** Quita el menú y sus escuchas. */
  dispose() {
    this.#button.removeEventListener('click', this.#onClick);
    this.#root.remove();
  }
}
