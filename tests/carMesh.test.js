import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { createCarMesh } from '../src/render/carMesh.js';

// Three.js construye geometrías y materiales sin WebGL, así que el aspecto se prueba en Node.
function build(model) {
  return createCarMesh(CONFIG.race.car, CONFIG.render.car, model.appearance);
}

function describeMesh({ group }) {
  return group.children.map((child) => ({
    color: child.material.color.getHex(),
    size: child.geometry.type === 'BoxGeometry'
      ? [child.geometry.parameters.width, child.geometry.parameters.height, child.geometry.parameters.depth]
      : [child.geometry.type],
    position: child.position.toArray(),
  }));
}

test('cada modelo produce una malla distinta con su color de carrocería (RF-002)', () => {
  const looks = CONFIG.cars.models.map((model) => JSON.stringify(describeMesh(build(model))));
  assert.equal(new Set(looks).size, CONFIG.cars.models.length);
  for (const model of CONFIG.cars.models) {
    const { group } = build(model);
    assert.equal(group.children[0].material.color.getHex(), model.appearance.bodyColor);
  }
});

test('los adornos dependen del modelo: franja y alerón añaden piezas', () => {
  const counts = Object.fromEntries(
    CONFIG.cars.models.map((model) => [model.id, build(model).group.children.length]),
  );
  for (const model of CONFIG.cars.models) {
    const { stripe, spoiler } = model.appearance;
    // carrocería + cabina + 4 ruedas, más la franja (1) y el alerón (soporte y ala: 2).
    assert.equal(counts[model.id], 6 + (stripe ? 1 : 0) + (spoiler ? 2 : 0), model.id);
  }
});

test('la carrocería mide lo mismo en todos los modelos: las dimensiones de colisión no cambian', () => {
  for (const model of CONFIG.cars.models) {
    const { width, depth } = build(model).group.children[0].geometry.parameters;
    assert.equal(width, CONFIG.race.car.width);
    assert.equal(depth, CONFIG.race.car.length);
  }
});

test('liberar los recursos del coche libera todas sus geometrías y materiales (RNF-04)', () => {
  for (const model of CONFIG.cars.models) {
    const mesh = build(model);
    const disposed = new Set();
    for (const resource of mesh.disposables) {
      const original = resource.dispose.bind(resource);
      resource.dispose = () => {
        disposed.add(resource);
        original();
      };
    }
    // Todo lo que cuelga de la malla está registrado para liberarse.
    mesh.group.traverse((object) => {
      if (!object.isMesh) return;
      assert.ok(mesh.disposables.includes(object.geometry), `${model.id}: geometría sin registrar`);
      assert.ok(mesh.disposables.includes(object.material), `${model.id}: material sin registrar`);
    });
    for (const resource of mesh.disposables) resource.dispose();
    assert.equal(disposed.size, mesh.disposables.length);
    assert.equal(new Set(mesh.disposables).size, mesh.disposables.length, 'sin recursos repetidos');
  }
});
