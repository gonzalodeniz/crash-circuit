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

test('el estado inicial es MENU', () => {
  assert.equal(new GameStateMachine().state, GameState.MENU);
});

test('el menú abre la selección y confirmarla lleva a PARRILLA (MENU -> SELECCION -> PARRILLA)', () => {
  const machine = new GameStateMachine();
  assert.equal(machine.openSelection(), GameState.SELECCION);
  assert.equal(machine.state, GameState.SELECCION);
  assert.equal(machine.startRace(), GameState.PARRILLA);
  assert.equal(machine.state, GameState.PARRILLA);
});

test('desde el menú no se puede ir directo a PARRILLA: hay que pasar por la selección', () => {
  const machine = new GameStateMachine();
  assert.throws(() => machine.startRace(), /Solo se puede iniciar/);
  assert.throws(() => machine.transitionTo(GameState.PARRILLA), /no permitida/);
  assert.equal(machine.state, GameState.MENU);
});

test('cancelar la selección vuelve al menú, y solo se puede hacer desde la selección', () => {
  const machine = new GameStateMachine();
  assert.throws(() => machine.cancelSelection(), /Solo se puede cancelar/);
  machine.openSelection();
  assert.equal(machine.cancelSelection(), GameState.MENU);
  assert.throws(() => machine.cancelSelection(), /Solo se puede cancelar/);
});

test('abrir la selección o iniciar la carrera fuera de su estado se rechaza y conserva el estado', () => {
  const machine = new GameStateMachine();
  machine.openSelection();
  assert.throws(() => machine.openSelection(), /Solo se puede abrir la selección/);
  machine.startRace();
  assert.throws(() => machine.startRace(), /Solo se puede iniciar/);
  assert.throws(() => machine.openSelection(), /Solo se puede abrir la selección/);
  assert.equal(machine.state, GameState.PARRILLA);
});

test('desde MENU solo se permite ir a SELECCION', () => {
  for (const state of Object.values(GameState)) {
    assert.equal(canTransition(GameState.MENU, state), state === GameState.SELECCION, `MENU -> ${state}`);
  }
});

test('desde SELECCION solo se permite volver al menú o ir a la parrilla', () => {
  for (const state of Object.values(GameState)) {
    const allowed = state === GameState.MENU || state === GameState.PARRILLA;
    assert.equal(canTransition(GameState.SELECCION, state), allowed, `SELECCION -> ${state}`);
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
  machine.openSelection();
  machine.startRace();
  assert.deepEqual(changes, [[GameState.MENU, GameState.SELECCION], [GameState.SELECCION, GameState.PARRILLA]]);
  off();
  machine.transitionTo(GameState.CUENTA_ATRAS);
  assert.equal(changes.length, 2);
});
