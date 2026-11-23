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

test('la sección render conserva las alturas de capas y las proporciones del coche', () => {
  const { layers, road, car } = CONFIG.render;
  assert.deepEqual({ ...layers }, { ground: -0.1, border: 0, road: 0.05, finishLine: 0.1 });
  assert.ok(layers.ground < layers.border && layers.border < layers.road && layers.road < layers.finishLine);
  assert.equal(road.finishLine.lightShade, 255);
  assert.equal(road.finishLine.darkShade, 20);
  // Las proporciones de carrocería y cabina son del aspecto de cada modelo (CONFIG.cars).
  assert.equal('bodyHeightRatio' in car, false);
  const rayo = CONFIG.cars.models.find((model) => model.id === 'rayo').appearance;
  assert.equal(rayo.bodyHeightRatio, 0.5);
  assert.equal(rayo.cabinWidthRatio, 0.8);
  assert.equal(rayo.cabinHeightRatio, 0.45);
  assert.equal(rayo.cabinLengthRatio, 0.45);
  assert.equal(rayo.cabinOffsetRatio, 0.08);
  assert.equal(car.wheelWidth, 0.4);
  assert.equal(car.wheelSegments, 16);
  assert.equal(car.wheelInset, 0.9);
  assert.ok(Object.isFrozen(CONFIG.render.layers));
});

test('el catálogo de circuitos está en la configuración y congelado (RF-004)', () => {
  assert.equal(CONFIG.tracks.circuits.length, 4);
  assert.ok(CONFIG.tracks.circuits.some((circuit) => circuit.id === CONFIG.tracks.defaultId));
  assert.ok(Object.isFrozen(CONFIG.tracks.circuits[0].controlPoints));
  assert.equal('track' in CONFIG, false);
});
