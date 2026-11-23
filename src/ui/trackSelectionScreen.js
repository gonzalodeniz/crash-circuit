// Pantalla de selección de circuito y vueltas (RF-004, RF-005, RF-006), segundo paso de la selección.
// Solo interfaz: muestra los circuitos que recibe (nombre, dificultad y datos básicos) y las opciones
// de vueltas, y avisa con `onSelect`, `onSelectLaps`, `onConfirm` y `onBack`; no decide nada del juego.
import { OptionSelectionScreen } from './optionSelectionScreen.js';

/**
 * @param {HTMLElement} container elemento donde se inserta la pantalla
 * @param {object} texts sección `ui.trackSelection` de CONFIG
 * @param {Array<{id: string, name: string, difficulty: string, length: number, curves: number}>} summaries
 *   datos básicos de los circuitos, en el orden en que se muestran
 * @param {number[]} lapOptions números de vueltas que se pueden elegir (`race.lapOptions`)
 * @param {{onSelect: (id: string) => void, onSelectLaps: (laps: number) => void, onConfirm: () => void, onBack: () => void}} callbacks acciones del jugador
 */
export function createTrackSelectionScreen(container, texts, summaries, lapOptions, callbacks) {
  // Tarjeta de un circuito: nombre, dificultad, longitud y número de curvas.
  const renderTrackOption = (summary) => {
    const name = document.createElement('span');
    name.className = 'selection__name';
    name.textContent = summary.name;
    const facts = [
      [texts.difficultyLabel, texts.difficultyLabels[summary.difficulty]],
      [texts.lengthLabel, `${Math.round(summary.length)} ${texts.lengthUnit}`],
      [texts.curvesLabel, String(summary.curves)],
    ].map(([label, value]) => {
      const fact = document.createElement('span');
      fact.className = 'selection__fact';
      fact.textContent = `${label}: ${value}`;
      return fact;
    });
    return [name, ...facts];
  };
  // Tarjeta de una opción de vueltas: el número. El identificador de la opción es el propio número.
  const renderLapsOption = (option) => {
    const name = document.createElement('span');
    name.className = 'selection__name';
    name.textContent = String(option.id);
    return [name];
  };
  const { onSelectLaps, ...callbacksForTracks } = callbacks;
  return new OptionSelectionScreen(
    container,
    { ...texts, id: 'track-selection' },
    summaries,
    { ...callbacksForTracks, renderOption: renderTrackOption },
    {
      title: texts.lapsTitle,
      groupLabel: texts.lapsGroupLabel,
      options: lapOptions.map((laps) => ({ id: laps })),
      renderOption: renderLapsOption,
      onSelect: (laps) => onSelectLaps(laps),
    },
  );
}
