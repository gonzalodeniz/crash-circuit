import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { createDamage, stepDamage } from '../src/logic/impact.js';
import { createCarMesh } from '../src/render/carMesh.js';
import { createDamageVisuals } from '../src/render/damageVisuals.js';

// Three.js construye geometrías y materiales sin WebGL, así que lo que se muestra se comprueba en Node.
// Cómo se ve se comprueba jugando.
const IMPACT = CONFIG.impact;
const DT = 1 / 60;
const LIGHT = stepDamage(createDamage(), IMPACT.minSpeed, DT, IMPACT);
const STRONG = stepDamage(createDamage(), IMPACT.strongSpeed, DT, IMPACT);

function build(model = CONFIG.cars.models[0]) {
  const car = createCarMesh(CONFIG.race.car, CONFIG.render.car, model.appearance);
  const visuals = createDamageVisuals(CONFIG.race.car, CONFIG.render.damage, car.body);
  car.group.add(visuals.group);
  const part = (name) => visuals.group.getObjectByName(name);
  const shown = () => ({
    light: part('marks-light').visible,
    strong: part('marks-strong').visible,
    sparks: part('sparks').visible ? part('sparks').children.filter((spark) => spark.visible).length : 0,
    smoke: part('smoke').visible,
    color: car.body.material.color.getHex(),
  });
  return { car, visuals, shown, model };
}

test('sin golpes no se ve ningún daño y la carrocería conserva el color de su modelo', () => {
  for (const model of CONFIG.cars.models) {
    const { shown } = build(model);
    assert.deepEqual(shown(), { light: false, strong: false, sparks: 0, smoke: false, color: model.appearance.bodyColor });
  }
});

test('un golpe leve deja marcas y unas chispas; uno fuerte, bastante más (RF-034)', () => {
  const brightness = (hex) => (hex >> 16) + ((hex >> 8) & 255) + (hex & 255);
  const { visuals, shown, model } = build();
  visuals.update(LIGHT);
  const light = shown();
  assert.equal(light.light, true);
  assert.equal(light.strong, false);
  assert.equal(light.smoke, false);
  assert.equal(light.sparks, CONFIG.render.damage.sparks.light.count);
  visuals.update(STRONG);
  const strong = shown();
  assert.equal(strong.light, true);
  assert.equal(strong.strong, true);
  assert.equal(strong.smoke, true);
  assert.ok(strong.sparks > light.sparks);
  assert.ok(brightness(strong.color) < brightness(light.color));
  assert.ok(brightness(light.color) < brightness(model.appearance.bodyColor));
});

test('al acabar la reacción se apagan chispas y humo y quedan las marcas; sin daño todo vuelve a estar limpio', () => {
  const { visuals, shown, model } = build();
  visuals.update(STRONG);
  visuals.update(stepDamage(STRONG, 0, IMPACT.strong.effectDuration, IMPACT));
  assert.equal(shown().sparks, 0);
  assert.equal(shown().smoke, false);
  assert.equal(shown().strong, true);
  visuals.update(createDamage());
  assert.deepEqual(shown(), { light: false, strong: false, sparks: 0, smoke: false, color: model.appearance.bodyColor });
});

test('todas las geometrías y materiales del daño quedan registrados para liberarse (RNF-04)', () => {
  const { visuals } = build();
  let meshes = 0;
  visuals.group.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    assert.ok(visuals.disposables.includes(object.geometry), 'geometría sin registrar');
    assert.ok(visuals.disposables.includes(object.material), 'material sin registrar');
  });
  assert.ok(meshes > 0);
  assert.equal(new Set(visuals.disposables).size, visuals.disposables.length, 'sin recursos repetidos');
});

test('el coche destruido se ve casi negro, aunque el daño no haya cambiado, y se puede volver a mostrar intacto', () => {
  const { visuals, shown, model } = build();
  const brightness = (hex) => (hex >> 16) + ((hex >> 8) & 255) + (hex & 255);
  visuals.update(STRONG);
  const damaged = shown().color;
  visuals.update(STRONG, true);
  const wrecked = shown().color;
  assert.ok(brightness(wrecked) < brightness(damaged) / 2, `${wrecked.toString(16)} frente a ${damaged.toString(16)}`);
  visuals.update(createDamage(), false);
  assert.equal(shown().color, model.appearance.bodyColor);
});
