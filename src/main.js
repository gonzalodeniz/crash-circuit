// Punto de entrada: conecta la lógica del juego con el renderizado.
import { CONFIG } from './config/config.js';
import { GameState, GameStateMachine } from './logic/gameState.js';
import { createRace } from './logic/race.js';
import { computeChaseCamera } from './logic/chaseCamera.js';
import { MainMenu } from './ui/mainMenu.js';
import { SceneRenderer } from './render/sceneRenderer.js';

const canvas = document.getElementById('game-canvas');
const stateMachine = new GameStateMachine();
const sceneRenderer = new SceneRenderer(canvas, CONFIG.render);
let race = null;

// El menú solo avisa; la máquina de estados decide (RNF-05).
const mainMenu = new MainMenu(document.body, CONFIG.ui.menu, () => {
  stateMachine.startRace();
  mainMenu.hide();
});

// La escena de la carrera se crea al entrar en PARRILLA y se libera al salir de la carrera (RNF-04).
stateMachine.onChange((from, to) => {
  if (to === GameState.PARRILLA) {
    race = createRace(CONFIG);
    sceneRenderer.buildRace(race);
  } else if (to === GameState.MENU || to === GameState.SELECCION) {
    sceneRenderer.disposeRace();
    race = null;
  }
});

function frame() {
  if (race) {
    for (const participant of race.participants) sceneRenderer.updateCar(participant);
    sceneRenderer.setCamera(computeChaseCamera(race.player, CONFIG.render.chaseCamera));
  }
  sceneRenderer.render();
  requestAnimationFrame(frame);
}

console.info(`Crash Circuit: estado inicial ${stateMachine.state}`);
requestAnimationFrame(frame);
