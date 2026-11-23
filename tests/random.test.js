import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom } from '../src/logic/random.js';

test('la misma semilla da la misma secuencia y semillas distintas dan secuencias distintas (RF-029)', () => {
  const take = (seed) => {
    const random = createSeededRandom(seed);
    return Array.from({ length: 50 }, () => random());
  };
  assert.deepEqual(take(7), take(7));
  assert.notDeepEqual(take(7), take(8));
});

test('los valores están en [0, 1) y se reparten por todo el intervalo', () => {
  const random = createSeededRandom(123);
  const values = Array.from({ length: 2000 }, () => random());
  assert.ok(values.every((value) => value >= 0 && value < 1));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(mean > 0.45 && mean < 0.55, `media ${mean}`);
  assert.ok(Math.min(...values) < 0.05 && Math.max(...values) > 0.95);
});
