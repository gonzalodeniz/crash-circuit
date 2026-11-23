// Punto de entrada: conecta la lógica del juego con el renderizado.
import { CONFIG } from './config/config.js';
import { GameState, GameStateMachine } from './logic/gameState.js';
import { raceTimeOf } from './logic/race.js';
import { RaceSession, SelectionStep } from './logic/raceSession.js';
import { trackSummaries } from './logic/trackCatalog.js';
import { lapOptions } from './logic/lapOptions.js';
import { computeChaseCamera } from './logic/chaseCamera.js';
import { inputFromKeys } from './logic/driving.js';
import { lapCounterText } from './logic/progress.js';
import { GO_SIGNAL, countdownSignal, formatRaceTime } from './logic/raceClock.js';
import { createCarSelectionScreen } from './ui/carSelectionScreen.js';
import { KeyboardInput } from './ui/keyboardInput.js';
import { MainMenu } from './ui/mainMenu.js';
import { RaceHud } from './ui/raceHud.js';
import { ResultsScreen } from './ui/resultsScreen.js';
import { createTrackSelectionScreen } from './ui/trackSelectionScreen.js';
import { SceneRenderer } from './render/sceneRenderer.js';

const canvas = document.getElementById('game-canvas');
const stateMachine = new GameStateMachine();
const sceneRenderer = new SceneRenderer(canvas, CONFIG.render, CONFIG.cars.models);
// Debe crearse antes que los demás oyentes: crea y descarta la carrera y encadena los estados (RNF-05).
const session = new RaceSession(stateMachine, CONFIG);
let lastTime = null;
const keyboard = new KeyboardInput(CONFIG.controls);
const hud = new RaceHud(document.body);

// El menú solo avisa; la máquina de estados decide (RNF-05).
const mainMenu = new MainMenu(document.body, CONFIG.ui.menu, () => stateMachine.openSelection());

// La selección tiene dos pasos, coche y circuito (RF-002, RF-004). Las pantallas solo avisan; la sesión
// guarda lo elegido y decide el paso siguiente, y la máquina de estados decide los estados.
const onConfirm = () => {
  session.confirmSelection();
  showSelectionStep();
};
const onBack = () => {
  session.backSelection();
  showSelectionStep();
};
const selectionScreen = createCarSelectionScreen(document.body, CONFIG.ui.selection, CONFIG.cars.models, {
  onSelect: (id) => {
    session.selectCarModel(id);
    selectionScreen.setSelected(session.selectedCarModelId);
    sceneRenderer.showCarPreview(CONFIG.race.car, session.selectedCarModelId);
  },
  onConfirm,
  onBack,
});
const trackSelectionScreen = createTrackSelectionScreen(document.body, CONFIG.ui.trackSelection, trackSummaries(CONFIG), lapOptions(CONFIG), {
  onSelect: (id) => {
    session.selectTrack(id);
    trackSelectionScreen.setSelected(session.selectedTrackId);
  },
  onSelectLaps: (laps) => {
    session.selectLaps(laps);
    trackSelectionScreen.setSecondarySelected(session.selectedLaps);
  },
  onConfirm,
  onBack,
});

// Muestra la pantalla del paso en curso de la selección (la vista previa del coche sigue de fondo).
function showSelectionStep() {
  if (stateMachine.state !== GameState.SELECCION) return; // al confirmar el circuito o volver al menú, cambia de estado
  const isCarStep = session.selectionStep === SelectionStep.CAR;
  trackSelectionScreen.hide();
  selectionScreen.hide();
  if (isCarStep) selectionScreen.show(session.selectedCarModelId);
  else trackSelectionScreen.show(session.selectedTrackId, session.selectedLaps);
}

// Igual que el menú: la pantalla de resultados solo avisa y la máquina de estados decide (RF-057, RF-008).
const resultsScreen = new ResultsScreen(document.body, CONFIG.ui.results, {
  onRepeat: () => stateMachine.repeatRace(),
  onMenu: () => stateMachine.backToMenu(),
});

// Solo muestra u oculta pantallas y crea o libera la escena; la lógica decide los estados (RNF-04, RNF-05).
stateMachine.onChange((from, to) => {
  if (to === GameState.PARRILLA) {
    // También al repetir desde resultados: la sesión ya ha creado una carrera nueva (RF-057).
    selectionScreen.hide();
    trackSelectionScreen.hide();
    sceneRenderer.disposePreview();
    resultsScreen.hide();
    sceneRenderer.buildRace(session.race);
    lastTime = null;
    keyboard.setEnabled(true); // las flechas conducen y no actúan sobre el navegador (RF-010)
    hud.show();
  } else if (to === GameState.RESULTADOS) {
    keyboard.setEnabled(false); // los controles del jugador se detienen (RF-025)
    hud.hide();
    const { race } = session;
    resultsScreen.show(formatRaceTime(raceTimeOf(race, race.player)));
  } else if (to === GameState.MENU || to === GameState.SELECCION) {
    keyboard.setEnabled(false);
    hud.hide();
    resultsScreen.hide();
    sceneRenderer.disposeRace();
    if (to === GameState.MENU) {
      selectionScreen.hide();
      trackSelectionScreen.hide();
      sceneRenderer.disposePreview();
      mainMenu.show();
    } else {
      mainMenu.hide();
      showSelectionStep();
      sceneRenderer.showCarPreview(CONFIG.race.car, session.selectedCarModelId);
    }
  }
});

function frame(time) {
  const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
  lastTime = time;
  // La sesión avanza la carrera y cambia de estado (salida, resultados); aquí solo se traducen las teclas.
  const race = session.race;
  if (race) {
    const input = inputFromKeys(keyboard.pressedKeys, CONFIG.controls);
    session.step(dt, { [race.player.id]: input });
    const signal = countdownSignal(race.clock, CONFIG.race.countdown);
    hud.update(
      signal === GO_SIGNAL ? CONFIG.ui.hud.goLabel : (signal ?? ''),
      formatRaceTime(raceTimeOf(race, race.player)),
      lapCounterText(CONFIG.ui.hud.lapLabel, race.player.progress, race.totalLaps),
    );
    for (const participant of race.participants) sceneRenderer.updateCar(participant);
    sceneRenderer.setCamera(computeChaseCamera(race.player, CONFIG.render.chaseCamera));
  } else if (stateMachine.state === GameState.SELECCION) {
    sceneRenderer.spinCarPreview(dt);
  }
  sceneRenderer.render();
  requestAnimationFrame(frame);
}

console.info(`Crash Circuit: estado inicial ${stateMachine.state}`);
requestAnimationFrame(frame);
