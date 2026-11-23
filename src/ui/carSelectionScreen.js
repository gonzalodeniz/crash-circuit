// Pantalla de selección de coche (RF-002), primer paso de la selección. Solo interfaz: muestra los
// modelos que recibe como opciones y avisa con `onSelect`, `onConfirm` y `onBack`; no decide nada del
// juego. El coche se ve en la escena 3D de fondo.
import { OptionSelectionScreen } from './optionSelectionScreen.js';

// Tarjeta de un modelo: muestra de sus colores (carrocería, cabina y adorno) y su nombre.
function renderCarOption(model) {
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
  return [swatch, name];
}

/**
 * @param {HTMLElement} container elemento donde se inserta la pantalla
 * @param {object} selectionConfig sección `ui.selection` de CONFIG
 * @param {Array<{id: string, name: string, appearance: object}>} models modelos del catálogo (`cars.models`)
 * @param {{onSelect: (id: string) => void, onConfirm: () => void, onBack: () => void}} callbacks acciones del jugador
 */
export function createCarSelectionScreen(container, selectionConfig, models, callbacks) {
  return new OptionSelectionScreen(
    container,
    { ...selectionConfig, id: 'car-selection' },
    models,
    { ...callbacks, renderOption: renderCarOption },
  );
}
