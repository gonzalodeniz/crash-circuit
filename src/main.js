// Punto de entrada: conecta la lógica del juego con el renderizado.
import { CONFIG } from './config/config.js';
import { GameState, GameStateMachine } from './logic/gameState.js';
import { createRace, stepRace } from './logic/race.js';
import { computeChaseCamera } from './logic/chaseCamera.js';
import { inputFromKeys } from './logic/driving.js';
import { GO_SIGNAL, countdownSignal, formatRaceTime } from './logic/raceClock.js';
import { KeyboardInput } from './ui/keyboardInput.js';
import { MainMenu } from './ui/mainMenu.js';
import { RaceHud } from './ui/raceHud.js';
import { SceneRenderer } from './render/sceneRenderer.js';

const canvas = document.getElementById('game-canvas');
const stateMachine = new GameStateMachine();
const sceneRenderer = new SceneRenderer(canvas, CONFIG.render);
let race = null;
let lastTime = null;
const keyboard = new KeyboardInput(CONFIG.controls);
const hud = new RaceHud(document.body);

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
    lastTime = null;
    keyboard.setEnabled(true); // las flechas conducen y no actúan sobre el navegador (RF-010)
    hud.show();
    stateMachine.beginCountdown(); // la parrilla da paso a la cuenta atrás (RF-020)
  } else if (to === GameState.MENU || to === GameState.SELECCION) {
    keyboard.setEnabled(false);
    hud.hide();
    sceneRenderer.disposeRace();
    race = null;
  }
});

function frame(time) {
  if (race) {
    const dt = lastTime === null ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    // La lógica limita el paso de tiempo (CONFIG.carPerformance.maxStep) para evitar saltos.
    // Durante la cuenta atrás los coches no se mueven; con la señal de salida pasan todos a EN_CARRERA.
    const input = inputFromKeys(keyboard.pressedKeys, CONFIG.controls);
    const { started } = stepRace(race, { [race.player.id]: input }, dt, CONFIG);
    if (started) stateMachine.startGo();
    const signal = countdownSignal(race.clock, CONFIG.race.countdown);
    hud.update(
      signal === GO_SIGNAL ? CONFIG.ui.hud.goLabel : (signal ?? ''),
      formatRaceTime(race.clock.raceTime),
    );
    for (const participant of race.participants) sceneRenderer.updateCar(participant);
    sceneRenderer.setCamera(computeChaseCamera(race.player, CONFIG.render.chaseCamera));
  }
  sceneRenderer.render();
  requestAnimationFrame(frame);
}

console.info(`Crash Circuit: estado inicial ${stateMachine.state}`);
requestAnimationFrame(frame);
