// Punto de entrada: conecta la lógica del juego con el renderizado.
import { CONFIG } from './config/config.js';
import { GameStateMachine } from './logic/gameState.js';
import { SceneRenderer } from './render/sceneRenderer.js';

const canvas = document.getElementById('game-canvas');
const stateMachine = new GameStateMachine();
const sceneRenderer = new SceneRenderer(canvas, CONFIG.render);

function frame() {
  sceneRenderer.render();
  requestAnimationFrame(frame);
}

console.info(`Crash Circuit: estado inicial ${stateMachine.state}`);
requestAnimationFrame(frame);
