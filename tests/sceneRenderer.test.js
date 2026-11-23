import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Texture } from 'three';
import { CONFIG } from '../src/config/config.js';
import { createSeededRandom } from '../src/logic/random.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { SceneRenderer } from '../src/render/sceneRenderer.js';

// RNF-04: `SceneRenderer` recibe el renderizador y la ventana por parámetro, así que aquí se usan unos
// falsos y se comprueba, ejecutando el código, que cada recurso de Three.js se libera con `dispose()`.

function createHarness() {
  let scene = null;
  const log = { renderDisposed: 0, listeners: new Set() };
  const renderer = {
    setPixelRatio() {},
    setSize() {},
    render(renderedScene) { scene = renderedScene; },
    dispose() { log.renderDisposed++; },
  };
  const viewport = {
    width: () => 800,
    height: () => 600,
    pixelRatio: () => 1,
    onResize: (listener) => {
      log.listeners.add(listener);
      return () => log.listeners.delete(listener);
    },
  };
  const sceneRenderer = new SceneRenderer(renderer, viewport, CONFIG.render, CONFIG.cars.models);
  sceneRenderer.render(); // da acceso a la escena que se ha creado
  return { sceneRenderer, scene, log };
}

// Todo recurso con `dispose()` que cuelga de un grupo: geometrías, materiales y las texturas de estos.
function resourcesOf(group) {
  const resources = new Set();
  group.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) resources.add(value);
    }
  });
  return resources;
}

// Cuenta las llamadas a `dispose()` de cada recurso.
function trackDisposals(resources, calls = new Map()) {
  for (const resource of resources) {
    calls.set(resource, 0);
    const original = resource.dispose.bind(resource);
    resource.dispose = () => {
      calls.set(resource, calls.get(resource) + 1);
      original();
    };
  }
  return calls;
}

const allDisposed = (calls) => [...calls.values()].every((count) => count > 0);
const noneDisposed = (calls) => [...calls.values()].every((count) => count === 0);
const raceGroups = (scene) => scene.children.filter((child) => child.isGroup);

function newRace(trackId) {
  return createRaceFromSetup(
    CONFIG,
    { carModelId: CONFIG.cars.defaultModelId, trackId, laps: 1 },
    createSeededRandom(1),
  );
}

test('reconstruir y liberar la carrera llama a dispose() en todos los recursos de la anterior (RNF-04)', () => {
  const { sceneRenderer, scene } = createHarness();
  const race = newRace(CONFIG.tracks.defaultId);
  assert.equal(race.participants.length, 10);

  sceneRenderer.buildRace(race);
  const [firstGroup] = raceGroups(scene);
  const first = trackDisposals(resourcesOf(firstGroup));
  assert.ok(first.size > 10, 'la carrera tiene geometrías, materiales y texturas');
  assert.ok([...first.keys()].some((resource) => resource instanceof Texture), 'incluye la textura de la meta');
  // Suelo, borde, calzada y meta, más los diez coches (cada uno es un grupo de piezas).
  assert.equal(firstGroup.children.length, 4 + 10);
  assert.ok(noneDisposed(first), 'nada se libera mientras la carrera está en escena');

  sceneRenderer.buildRace(race);
  assert.ok(allDisposed(first), 'toda la carrera anterior se ha liberado');
  assert.ok([...first.values()].every((count) => count === 1), 'cada recurso se libera una sola vez');
  const groups = raceGroups(scene);
  assert.equal(groups.length, 1);
  assert.notEqual(groups[0], firstGroup);
  assert.equal(scene.children.includes(firstGroup), false, 'el grupo anterior ya no está en la escena');

  const second = trackDisposals(resourcesOf(groups[0]));
  assert.ok(noneDisposed(second), 'los recursos de la carrera nueva siguen vivos');
  for (const resource of second.keys()) assert.equal(first.has(resource), false, 'no se reutilizan recursos liberados');

  sceneRenderer.disposeRace();
  assert.ok(allDisposed(second));
  assert.equal(raceGroups(scene).length, 0, 'la escena ya no contiene el grupo de la carrera');
  sceneRenderer.disposeRace(); // liberar dos veces no falla
});

test('cada circuito del catálogo libera sus recursos al cambiar de circuito (RNF-04)', () => {
  const { sceneRenderer, scene } = createHarness();
  let previous = null;
  for (const { id } of CONFIG.tracks.circuits) {
    sceneRenderer.buildRace(newRace(id));
    if (previous) assert.ok(allDisposed(previous), `circuito anterior a ${id}`);
    assert.equal(raceGroups(scene).length, 1);
    previous = trackDisposals(resourcesOf(raceGroups(scene)[0]));
  }
});

test('disposePreview() libera todos los recursos de la vista previa, también tras cambiar de modelo (RNF-04)', () => {
  const { sceneRenderer, scene } = createHarness();
  const calls = new Map(); // llamadas a dispose() de todos los recursos que ha tenido la vista previa
  const track = (resources) => trackDisposals([...resources].filter((resource) => !calls.has(resource)), calls);
  const models = [...CONFIG.cars.models.map((model) => model.id), CONFIG.cars.models[0].id];
  let previous = new Set();
  let previewGroup = null;

  for (const modelId of models) {
    sceneRenderer.showCarPreview(CONFIG.race.car, modelId);
    [previewGroup] = raceGroups(scene);
    assert.equal(raceGroups(scene).length, 1, 'solo hay una vista previa en la escena');
    const current = resourcesOf(previewGroup);
    track(current);
    for (const resource of previous) {
      // Lo que ya no está en la vista previa (el coche anterior) se ha liberado; el resto (plataforma y suelo), no.
      assert.equal(calls.get(resource) > 0, !current.has(resource));
    }
    previous = current;
  }
  assert.ok(calls.size > resourcesOf(previewGroup).size, 'se han liberado los coches de los modelos anteriores');

  sceneRenderer.disposePreview();
  assert.ok(allDisposed(calls), 'toda la vista previa se ha liberado');
  assert.equal(raceGroups(scene).length, 0, 'la escena ya no contiene la vista previa');
  sceneRenderer.disposePreview(); // liberar dos veces no falla
});

test('dispose() libera la carrera, la vista previa y el renderizador, y deja de escuchar el cambio de tamaño (RNF-04)', () => {
  const { sceneRenderer, scene, log } = createHarness();
  assert.equal(log.listeners.size, 1);
  sceneRenderer.buildRace(newRace(CONFIG.tracks.defaultId));
  sceneRenderer.showCarPreview(CONFIG.race.car, CONFIG.cars.defaultModelId);
  const calls = trackDisposals(resourcesOf(scene));

  sceneRenderer.dispose();
  assert.equal(log.renderDisposed, 1);
  assert.equal(log.listeners.size, 0);
  assert.equal(raceGroups(scene).length, 0);
  // Las luces no tienen recursos propios; los grupos de carrera y vista previa se liberan sin dejar nada.
  assert.ok(allDisposed(calls));
});
