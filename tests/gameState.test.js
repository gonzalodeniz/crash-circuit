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
