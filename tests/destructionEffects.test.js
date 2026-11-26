// Efecto de destrucción (RF-037, RNF-04, RNF-05), sin WebGL: se ejecuta el `SceneRenderer` real con un
// renderizador falso sobre una carrera de la lógica y se mira qué instancias quedan para dibujar. Cómo se
// ve se comprueba jugando.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Color, Matrix4, Vector3 } from 'three';
import { CONFIG } from '../src/config/config.js';
import { createCarState } from '../src/logic/driving.js';
import { createProgress } from '../src/logic/progress.js';
import { ParticipantStatus, stepRace } from '../src/logic/race.js';
import { createSeededRandom } from '../src/logic/random.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { pointAtDistance } from '../src/logic/track.js';
import { effectShare } from '../src/render/destructionEffects.js';
import { SceneRenderer } from '../src/render/sceneRenderer.js';

const DT = 1 / 60;
const EFFECT = CONFIG.render.destructionEffect;
const KINDS = ['fragments', 'sparks', 'smoke'];
const NONE = { accelerate: false, brake: false, left: false, right: false };
const playerIndex = CONFIG.grid.playerSlotIndex;

function createHarness(renderConfig = CONFIG.render) {
  let scene = null;
  const renderer = { setPixelRatio() {}, setSize() {}, render(rendered) { scene = rendered; }, dispose() {} };
  const viewport = { width: () => 800, height: () => 600, pixelRatio: () => 1, onResize: () => () => {} };
  const sceneRenderer = new SceneRenderer(renderer, viewport, renderConfig, CONFIG.cars.models);
  sceneRenderer.render(); // da acceso a la escena
  return { sceneRenderer, scene };
}

const withEffect = (changes) => ({ ...CONFIG.render, destructionEffect: { ...EFFECT, ...changes } });

const held = (race) => Object.fromEntries(race.participants.map((p) => [p.id, NONE]));
const step = (race, dt = DT) => stepRace(race, held(race), dt, CONFIG);

/** Carrera de diez con la salida ya dada y todos quietos; el jugador, con el modelo indicado. */
function startedRace(carModelId = CONFIG.cars.defaultModelId, trackId = 'llanura') {
  const race = createRaceFromSetup(CONFIG, { carModelId, trackId, laps: 3 }, createSeededRandom(1));
  while (!step(race).started);
  return race;
}

/** Estrella de frente al participante contra una roca: la destrucción la decide la lógica. */
function crash(race, participant) {
  const pose = { x: 1000 + race.participants.indexOf(participant) * 20, z: -1000, heading: 0 };
  Object.assign(participant, createCarState(pose), {
    speed: CONFIG.impact.strongSpeed + 5,
    surfaceSample: null,
    progress: createProgress(race.track, pointAtDistance(race.track, -20)),
  });
  race.scenery = {
    bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000 },
    obstacles: [{ type: 'rock', x: pose.x, z: pose.z + CONFIG.race.car.length / 2 + 1.05, radius: 1 }],
  };
  step(race);
  assert.equal(participant.status, ParticipantStatus.DESTRUIDO, participant.id);
}

/** Lo que hace `main.js` en cada fotograma. */
function frame(sceneRenderer, race) {
  for (const participant of race.participants) sceneRenderer.updateCar(participant);
  sceneRenderer.render();
}

const effectsGroup = (scene) => scene.getObjectByName('destruction');
const mesh = (scene, name) => effectsGroup(scene).getObjectByName(name);
const counts = (scene) => Object.fromEntries(KINDS.map((name) => [name, mesh(scene, name).count]));
const NOTHING = { fragments: 0, sparks: 0, smoke: 0 };
const FULL = { fragments: EFFECT.fragments.perWreck, sparks: EFFECT.sparks.perWreck, smoke: EFFECT.smoke.perWreck };

/** Posiciones de las instancias que se dibujan. */
function positions(scene, name) {
  const target = mesh(scene, name);
  const matrix = new Matrix4();
  return Array.from({ length: target.count }, (_, i) => {
    target.getMatrixAt(i, matrix);
    return new Vector3().setFromMatrixPosition(matrix);
  });
}

const farthest = (list, car) => Math.max(...list.map((p) => Math.hypot(p.x - car.x, p.z - car.z)));

function setup(carModelId) {
  const { sceneRenderer, scene } = createHarness();
  const race = startedRace(carModelId);
  sceneRenderer.buildRace(race);
  return { sceneRenderer, scene, race };
}

test('sin coches destruidos no se dibuja ningún efecto', () => {
  const { sceneRenderer, scene, race } = setup();
  frame(sceneRenderer, race);
  assert.deepEqual(counts(scene), NOTHING);
});

for (const [who, index] of [['el jugador', playerIndex], ['un rival', playerIndex === 0 ? 1 : 0]]) {
  test(`al destruirse ${who} salen piezas, chispas y humo que se separan del coche (RF-037)`, () => {
    const { sceneRenderer, scene, race } = setup();
    const car = race.participants[index];
    crash(race, car);
    frame(sceneRenderer, race);
    assert.deepEqual(counts(scene), FULL);
    const initial = farthest(positions(scene, 'fragments'), car);
    assert.ok(initial < CONFIG.race.car.length, 'las piezas parten del coche');

    for (let i = 0; i < 30; i++) step(race);
    frame(sceneRenderer, race);
    assert.ok(farthest(positions(scene, 'fragments'), car) > initial + 2, 'las piezas salen despedidas');
    assert.ok(farthest(positions(scene, 'sparks'), car) > initial + 2);
    assert.ok(Math.max(...positions(scene, 'smoke').map((p) => p.y)) > 2, 'el humo sube');
  });
}

test('las piezas llevan los colores del modelo del coche destruido, en los cuatro modelos', () => {
  for (const model of CONFIG.cars.models) {
    const { sceneRenderer, scene, race } = setup(model.id);
    crash(race, race.player);
    frame(sceneRenderer, race);
    const color = new Color();
    const shown = new Set(
      Array.from({ length: mesh(scene, 'fragments').count }, (_, i) => {
        mesh(scene, 'fragments').getColorAt(i, color);
        return color.getHex();
      }),
    );
    const { bodyColor, cabinColor, accentColor } = model.appearance;
    for (const expected of [bodyColor, cabinColor, accentColor, CONFIG.render.car.wheelColor]) {
      assert.ok(shown.has(new Color(expected).getHex()), `${model.id}: falta ${expected.toString(16)}`);
    }
  }
});

test('el efecto dura mientras el coche está destruido y desaparece al reaparecer, sin restos ni daños', () => {
  const { sceneRenderer, scene, race } = setup();
  crash(race, race.player);
  let frames = 0;
  while (race.player.status === ParticipantStatus.DESTRUIDO) {
    frame(sceneRenderer, race);
    assert.equal(counts(scene).fragments, FULL.fragments, `paso ${frames}`);
    assert.equal(counts(scene).smoke, FULL.smoke, `paso ${frames}`);
    step(race);
    frames++;
    assert.ok(frames < 1000);
  }
  assert.ok(frames * DT >= CONFIG.destruction.lockDuration - DT);
  frame(sceneRenderer, race);
  assert.deepEqual(counts(scene), NOTHING);
  assert.equal(race.player.damage.worst, null);
  const damage = [];
  scene.traverse((object) => {
    if (object.name === 'damage') damage.push(object.children.some((child) => child.visible));
  });
  assert.equal(damage[playerIndex], false, 'el coche nuevo sale sin marcas, chispas ni humo');
});

test('las chispas se apagan pronto y las piezas se quedan en el suelo', () => {
  const { sceneRenderer, scene, race } = setup();
  crash(race, race.player);
  const elapse = (seconds) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) step(race);
    frame(sceneRenderer, race);
  };
  elapse(2.5);
  assert.equal(counts(scene).sparks, 0);
  const landed = positions(scene, 'fragments');
  for (const { y } of landed) assert.ok(y > 0 && y < 0.3, `altura ${y}`);
  elapse(0.2);
  assert.deepEqual(positions(scene, 'fragments'), landed, 'ya no se mueven');
});

test('si la simulación no avanza (pausa), el efecto se queda quieto', () => {
  const { sceneRenderer, scene, race } = setup();
  crash(race, race.player);
  for (let i = 0; i < 10; i++) step(race);
  frame(sceneRenderer, race);
  const before = KINDS.map((name) => positions(scene, name));
  for (let i = 0; i < 60; i++) {
    step(race, 0);
    frame(sceneRenderer, race);
  }
  assert.deepEqual(KINDS.map((name) => positions(scene, name)), before);
});

test('la duración del efecto sale de la configuración y nunca pasa de la reaparición', () => {
  const { sceneRenderer, scene } = createHarness(withEffect({ duration: 0.5 }));
  const race = startedRace();
  sceneRenderer.buildRace(race);
  crash(race, race.player);
  frame(sceneRenderer, race);
  assert.equal(counts(scene).fragments, FULL.fragments);
  for (let i = 0; i < Math.round(0.6 / DT); i++) step(race);
  assert.equal(race.player.status, ParticipantStatus.DESTRUIDO);
  frame(sceneRenderer, race);
  assert.deepEqual(counts(scene), NOTHING);
});

test('cada destrucción respeta su máximo y todas juntas, el máximo total, repartido por igual', () => {
  const limits = {
    fragments: { ...EFFECT.fragments, perWreck: 6, maxTotal: 20 },
    sparks: { ...EFFECT.sparks, perWreck: 5, maxTotal: 12 },
    smoke: { ...EFFECT.smoke, perWreck: 3, maxTotal: 10 },
  };
  const { sceneRenderer, scene } = createHarness(withEffect(limits));
  const race = startedRace();
  sceneRenderer.buildRace(race);
  let wrecks = 0;
  for (const participant of race.participants) {
    // Los diez a la vez, como los deja un golpe fuerte.
    Object.assign(participant, {
      status: ParticipantStatus.DESTRUIDO,
      wreck: { duration: 3, timeLeft: 3, readyToRespawn: false },
    });
    wrecks++;
    frame(sceneRenderer, race);
    for (const name of KINDS) {
      assert.equal(mesh(scene, name).count, wrecks * effectShare(limits[name], wrecks), `${name} con ${wrecks}`);
      assert.ok(mesh(scene, name).count <= limits[name].maxTotal);
      assert.ok(effectShare(limits[name], wrecks) >= 1, 'todas las destrucciones tienen efecto');
    }
  }
});

test('con la configuración del juego, los diez destruidos a la vez tienen efecto sin pasar de los máximos', () => {
  for (const name of KINDS) {
    const limits = EFFECT[name];
    assert.ok(limits.perWreck > 0 && limits.maxTotal >= limits.perWreck, name);
    for (let wrecks = 1; wrecks <= CONFIG.race.maxParticipants; wrecks++) {
      const share = effectShare(limits, wrecks);
      assert.ok(share >= 1 && share <= limits.perWreck && share * wrecks <= limits.maxTotal, name);
    }
    assert.equal(effectShare(limits, 0), 0);
  }
});

test('destruir coches no crea objetos, geometrías ni materiales nuevos: la reserva es de la carrera', () => {
  const { sceneRenderer, scene, race } = setup();
  const snapshot = () => effectsGroup(scene).children.map((child) => [child.uuid, child.geometry.uuid, child.material.uuid]);
  frame(sceneRenderer, race);
  const before = snapshot();
  assert.equal(before.length, KINDS.length, 'una llamada de dibujo por clase');
  for (const participant of race.participants.slice(0, 4)) crash(race, participant);
  frame(sceneRenderer, race);
  assert.equal(mesh(scene, 'smoke').count, 4 * effectShare(EFFECT.smoke, 4));
  assert.deepEqual(snapshot(), before);
});

test('repetir, cambiar de circuito y salir de la carrera liberan el efecto y no dejan restos (RNF-04)', () => {
  const { sceneRenderer, scene } = createHarness();
  // Cuenta las llamadas a `dispose()` de cada malla, geometría y material del efecto en curso.
  const watch = () => {
    const calls = new Map();
    for (const child of effectsGroup(scene).children) {
      for (const resource of [child, child.geometry, child.material]) {
        calls.set(resource, 0);
        const original = resource.dispose.bind(resource);
        resource.dispose = () => {
          calls.set(resource, calls.get(resource) + 1);
          original();
        };
      }
    }
    return calls;
  };
  let previous = null;
  // La misma carrera repetida y después otros circuitos, siempre con un efecto en marcha.
  for (const trackId of ['llanura', 'llanura', ...CONFIG.tracks.circuits.map((circuit) => circuit.id)]) {
    const race = startedRace(CONFIG.cars.defaultModelId, trackId);
    sceneRenderer.buildRace(race);
    if (previous) assert.deepEqual([...previous.values()], Array(9).fill(1), `antes de ${trackId}`);
    frame(sceneRenderer, race);
    assert.deepEqual(counts(scene), NOTHING, 'la carrera nueva sale sin restos');
    assert.equal(scene.children.filter((child) => child.isGroup).length, 1);
    previous = watch();
    assert.equal(previous.size, 9);
    crash(race, race.player);
    frame(sceneRenderer, race);
    assert.equal(counts(scene).fragments, FULL.fragments);
  }
  sceneRenderer.disposeRace();
  assert.deepEqual([...previous.values()], Array(9).fill(1));
  assert.equal(effectsGroup(scene), undefined);
  sceneRenderer.render(); // sin carrera no hay efectos que dibujar
});

test('el efecto es solo visual: la carrera avanza igual con él que sin dibujarla (RNF-05)', () => {
  const outcome = (draw) => {
    const { sceneRenderer, scene } = createHarness();
    const race = startedRace();
    sceneRenderer.buildRace(race);
    crash(race, race.player);
    for (let i = 0; i < 240; i++) {
      stepRace(race, {}, DT, CONFIG);
      if (draw) frame(sceneRenderer, race);
    }
    if (draw) assert.ok(effectsGroup(scene));
    return [
      race.standings,
      race.participants.map((p) => [p.x, p.z, p.speed, p.status, p.progress.progress, p.wreck]),
    ];
  };
  assert.deepEqual(outcome(true), outcome(false));
});
