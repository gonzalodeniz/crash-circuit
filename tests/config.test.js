import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';

test('la configuración está congelada en profundidad', () => {
  assert.ok(Object.isFrozen(CONFIG));
  assert.ok(Object.isFrozen(CONFIG.scoring));
  assert.ok(Object.isFrozen(CONFIG.scoring.positionPoints));
  assert.ok(Object.isFrozen(CONFIG.controls.pause));
});

test('la tabla de puntos por llegada tiene 10 posiciones y decrece', () => {
  const points = CONFIG.scoring.positionPoints;
  assert.equal(points.length, 10);
  assert.deepEqual(points, [100, 80, 65, 55, 45, 35, 25, 15, 10, 5]);
  for (let i = 1; i < points.length; i++) assert.ok(points[i] < points[i - 1]);
});

test('contiene los valores «propuesta» de la sección 4 de requisitos', () => {
  assert.equal(CONFIG.scoring.overtakeBonus, 5);
  assert.equal(CONFIG.scoring.fastLapBonus, 10);
  assert.equal(CONFIG.scoring.accidentPenalty, 10);
  assert.deepEqual(CONFIG.controls.pause, ['Escape', 'KeyP']);
  assert.equal(CONFIG.performance.targetFps, 60);
});

test('no se puede modificar un valor de la configuración', () => {
  assert.throws(() => {
    CONFIG.scoring.overtakeBonus = 99;
  }, TypeError);
});
