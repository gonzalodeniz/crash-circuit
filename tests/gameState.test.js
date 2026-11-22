import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameState, GameStateMachine, TRANSITIONS, canTransition } from '../src/logic/gameState.js';

test('define los siete estados del juego', () => {
  assert.deepEqual(Object.keys(GameState).sort(), [
    'CUENTA_ATRAS', 'EN_CARRERA', 'MENU', 'PARRILLA', 'PAUSA', 'RESULTADOS', 'SELECCION',
  ]);
});

test('todos los estados tienen transiciones definidas a estados válidos', () => {
  for (const state of Object.values(GameState)) {
    assert.ok(TRANSITIONS[state], `falta ${state}`);
    for (const target of TRANSITIONS[state]) assert.ok(Object.values(GameState).includes(target));
  }
});

test('la máquina arranca en MENU y recorre el flujo hasta resultados', () => {
  const machine = new GameStateMachine();
  assert.equal(machine.state, GameState.MENU);
  for (const next of [
    GameState.SELECCION, GameState.PARRILLA, GameState.CUENTA_ATRAS,
    GameState.EN_CARRERA, GameState.PAUSA, GameState.EN_CARRERA, GameState.RESULTADOS,
  ]) {
    assert.equal(machine.transitionTo(next), next);
  }
});

test('rechaza transiciones no permitidas y conserva el estado', () => {
  const machine = new GameStateMachine();
  assert.throws(() => machine.transitionTo(GameState.EN_CARRERA), /no permitida/);
  assert.equal(machine.state, GameState.MENU);
  assert.equal(canTransition(GameState.MENU, GameState.RESULTADOS), false);
});

test('el módulo de lógica no depende de Three.js ni del DOM', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/logic/gameState.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]three['"]|document\.|window\./);
});

test('el estado inicial es MENU', () => {
  assert.equal(new GameStateMachine().state, GameState.MENU);
});

test('iniciar carrera desde el menú lleva a PARRILLA', () => {
  const machine = new GameStateMachine();
  assert.equal(machine.startRace(), GameState.PARRILLA);
  assert.equal(machine.state, GameState.PARRILLA);
});

test('iniciar carrera fuera del menú se rechaza y conserva el estado', () => {
  const machine = new GameStateMachine();
  machine.startRace();
  assert.throws(() => machine.startRace(), /Solo se puede iniciar/);
  assert.equal(machine.state, GameState.PARRILLA);
});

test('desde MENU solo se permite ir a SELECCION o PARRILLA', () => {
  for (const state of Object.values(GameState)) {
    const allowed = state === GameState.SELECCION || state === GameState.PARRILLA;
    assert.equal(canTransition(GameState.MENU, state), allowed, `MENU -> ${state}`);
  }
});

test('no se permiten saltos que se salten estados del flujo', () => {
  assert.equal(canTransition(GameState.PARRILLA, GameState.EN_CARRERA), false);
  assert.equal(canTransition(GameState.CUENTA_ATRAS, GameState.RESULTADOS), false);
  assert.equal(canTransition(GameState.RESULTADOS, GameState.EN_CARRERA), false);
});

test('onChange avisa de cada cambio de estado y permite darse de baja', () => {
  const machine = new GameStateMachine();
  const changes = [];
  const off = machine.onChange((from, to) => changes.push([from, to]));
  machine.startRace();
  assert.deepEqual(changes, [[GameState.MENU, GameState.PARRILLA]]);
  off();
  machine.transitionTo(GameState.CUENTA_ATRAS);
  assert.equal(changes.length, 1);
});
