import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { carsOverlap } from '../src/logic/carContacts.js';
import { createCarState, stepCar } from '../src/logic/driving.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { ImpactSeverity, applyImpact, classifyImpact, createDamage, stepDamage } from '../src/logic/impact.js';
import { createProgress } from '../src/logic/progress.js';
import { ParticipantStatus, stepRace } from '../src/logic/race.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createSeededRandom } from '../src/logic/random.js';

const P = CONFIG.carPerformance;
const CAR = CONFIG.race.car;
const IMPACT = CONFIG.impact;
const STRONG_SPEED = IMPACT.strongSpeed;
const { LIGHT, STRONG } = ImpactSeverity;
const DT = 1 / 60;
const NONE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { ...NONE, accelerate: true };
const OPEN = Object.freeze({ bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 5000 }, obstacles: [] });
// El terreno de las pruebas no está sobre la calzada: se amplía su margen para que la penalización de la
// salida de pista no altere las velocidades medidas.
const ASPHALT = Object.freeze({ ...CONFIG, offRoad: { ...CONFIG.offRoad, margin: 1e6 } });
// Pared al norte (z = 20) y una roca en el origen de otra zona, lejos de todo.
const WALL = Object.freeze({ bounds: { minX: -5000, maxX: 5000, minZ: -5000, maxZ: 20 }, obstacles: [] });
const ROCK = Object.freeze({ bounds: OPEN.bounds, obstacles: [{ type: 'rock', x: 0, z: 20, radius: 1.6 }] });

/** Carrera de diez con la señal de salida ya dada, en terreno abierto y con todos apartados y quietos. */
function openRace(config = ASPHALT, scenery = OPEN) {
  const race = createRaceFromSetup(config, { carModelId: 'rayo', trackId: 'llanura', laps: 3 }, createSeededRandom(1));
  while (!stepRace(race, held(race), DT, config).started);
  race.scenery = scenery;
  race.participants.forEach((p, i) => place(race, p, { x: 1000 + i * 10, z: -1000, heading: 0 }));
  return race;
}

const held = (race) => Object.fromEntries(race.participants.map((p) => [p.id, NONE]));

function place(race, participant, pose, speed = 0) {
  Object.assign(participant, createCarState(pose), {
    speed, surfaceSample: null, progress: createProgress(race.track, pose), status: ParticipantStatus.EN_CARRERA, wreck: null,
  });
}

/** Un paso en el que solo actúa lo indicado en `inputs`. */
const step = (race, inputs = {}, config = ASPHALT, dt = DT) => stepRace(race, { ...held(race), ...inputs }, dt, config);

/**
 * `striker` embiste por detrás a `struck`, parado, con una velocidad de impacto de `speed` m/s (sin tocar
 * los controles, la inercia le quita un poco antes de medirla). Devuelve la carrera tras un paso.
 */
function crash(striker, struck, speed, race = openRace(), config = ASPHALT) {
  const a = race.participants[striker];
  const b = race.participants[struck];
  place(race, a, { x: 0, z: 0, heading: 0 }, speed + P.coastDeceleration * DT);
  place(race, b, { x: 0, z: CAR.length + 0.02, heading: 0 });
  step(race, {}, config);
  return { race, a, b };
}

/** Un coche (por defecto el jugador) se estrella de frente contra el escenario a `speed` m/s. */
function hitScenery(scenery, speed, index = null) {
  const race = openRace(ASPHALT, scenery);
  const car = index === null ? race.player : race.participants[index];
  const front = scenery.obstacles[0] ? scenery.obstacles[0].z - scenery.obstacles[0].radius : scenery.bounds.maxZ;
  place(race, car, { x: 0, z: front - CAR.length / 2 - 0.1, heading: 0 }, speed + P.coastDeceleration * DT);
  step(race);
  return { race, car };
}

const playerIndex = CONFIG.grid.playerSlotIndex;
const rivals = [...Array(CONFIG.race.maxParticipants).keys()].filter((i) => i !== playerIndex);

test('los parámetros de los golpes están en la configuración, congelados y son coherentes (RF-034)', () => {
  assert.ok(Object.isFrozen(IMPACT) && Object.isFrozen(IMPACT.light) && Object.isFrozen(IMPACT.strong));
  assert.ok(IMPACT.minSpeed > 0 && IMPACT.minSpeed < IMPACT.strongSpeed && IMPACT.strongSpeed < P.maxSpeed);
  // Las rozaduras nunca llegan a verse como un accidente grave, y el daño está acotado.
  assert.ok(IMPACT.light.maxDamage < IMPACT.strong.damage);
  assert.ok(IMPACT.strong.maxDamage <= 1);
  assert.ok(IMPACT.light.effectDuration > 0 && IMPACT.light.effectDuration < IMPACT.strong.effectDuration);
  for (const model of CONFIG.cars.models) assert.equal(model.impact, undefined);
});

test('por debajo del umbral el golpe es leve; desde el umbral, fuerte; un simple contacto no es golpe', () => {
  assert.equal(classifyImpact(0, IMPACT), null);
  assert.equal(classifyImpact(IMPACT.minSpeed - 0.01, IMPACT), null);
  assert.equal(classifyImpact(undefined, IMPACT), null);
  assert.equal(classifyImpact(IMPACT.minSpeed, IMPACT), LIGHT);
  assert.equal(classifyImpact(STRONG_SPEED - 0.01, IMPACT), LIGHT);
  assert.equal(classifyImpact(STRONG_SPEED, IMPACT), STRONG);
  assert.equal(classifyImpact(P.maxSpeed * 2, IMPACT), STRONG);
});

test('un golpe leve no toca el movimiento de la respuesta física; uno fuerte detiene el coche', () => {
  const motion = { speed: -10, slideX: 4, slideZ: -2, impactSpeed: 3 };
  assert.deepEqual(applyImpact(motion, STRONG_SPEED - 1, IMPACT), { ...motion, impactSpeed: STRONG_SPEED - 1 });
  assert.deepEqual(applyImpact(motion, STRONG_SPEED, IMPACT), { speed: 0, slideX: 0, slideZ: 0, impactSpeed: STRONG_SPEED });
  // Se anota la mayor velocidad de impacto, no la última.
  assert.equal(applyImpact(motion, 1, IMPACT).impactSpeed, 3);
});

test('el umbral se lee de la configuración: el mismo choque es leve o fuerte según su valor', () => {
  const speed = STRONG_SPEED - 4;
  const light = crash(0, 1, speed);
  assert.equal(light.a.damage.worst, LIGHT);
  const config = { ...ASPHALT, impact: { ...IMPACT, strongSpeed: speed - 1 } };
  const strong = crash(0, 1, speed, openRace(config), config);
  assert.equal(strong.a.damage.worst, STRONG);
  assert.equal(strong.b.damage.worst, STRONG);
  assert.ok(light.b.speed > 0);
  assert.equal(strong.b.speed, 0);
});

for (const [name, scenery] of [['el límite', WALL], ['un obstáculo', ROCK]]) {
  test(`contra ${name}: bajo el umbral es leve y sobre él fuerte, con mucha más pérdida de velocidad`, () => {
    const light = hitScenery(scenery, STRONG_SPEED - 1);
    const strong = hitScenery(scenery, STRONG_SPEED + 1);
    assert.equal(light.car.damage.worst, LIGHT);
    assert.equal(strong.car.damage.worst, STRONG);
    // Fracción de la velocidad que cada uno conserva.
    const kept = (result, speed) => Math.abs(result.car.speed) / speed;
    assert.ok(kept(strong, STRONG_SPEED + 1) < kept(light, STRONG_SPEED - 1) / 2);
    assert.ok(kept(strong, STRONG_SPEED + 1) < 0.1, 'casi toda perdida');
    assert.ok(strong.car.damage.level > light.car.damage.level);
  });

  test(`contra ${name} de refilón a mucha velocidad es una rozadura leve; la intensidad es la del choque`, () => {
    const race = openRace(ASPHALT, scenery);
    const front = scenery === WALL ? 20 : 18.4;
    // Casi paralelo a la pared (o pasando rozando la roca de lado).
    const pose = scenery === WALL
      ? { x: 0, z: front - CAR.width / 2 - 0.2, heading: Math.PI / 2 - 0.15 }
      : { x: 1.6 + CAR.width / 2 - 0.1, z: 20 - CAR.length / 2 - 1.2, heading: 0 };
    place(race, race.player, pose, 40);
    let slowest = 40;
    for (let i = 0; i < 40; i++) {
      step(race, { player: GAS });
      slowest = Math.min(slowest, race.player.speed);
    }
    assert.equal(race.player.damage.worst, LIGHT);
    assert.ok(race.player.damage.level > 0 && race.player.damage.level <= IMPACT.light.maxDamage);
    assert.ok(slowest > 40 * 0.6, `pérdida moderada: ${slowest}`);
  });
}

test('un toque suave entre dos coches: reacción leve, ninguno se destruye y ambos siguen corriendo (CA-03)', () => {
  const { race, a, b } = crash(playerIndex, rivals[0], 6);
  for (const car of [a, b]) {
    assert.equal(car.damage.worst, LIGHT);
    assert.equal(car.damage.effect, LIGHT);
    assert.equal(car.status, ParticipantStatus.EN_CARRERA);
  }
  assert.equal(race.participants.length, 10);
  const from = [a.z, b.z];
  for (let i = 0; i < 180; i++) step(race, { [a.id]: GAS, [b.id]: GAS });
  assert.ok(a.z > from[0] + 20 && b.z > from[1] + 20, `${a.z}, ${b.z}`);
});

test('en un golpe fuerte entre coches los dos pierden la velocidad y quedan dañados', () => {
  const light = crash(0, 1, STRONG_SPEED - 1);
  const strong = crash(0, 1, STRONG_SPEED + 1);
  assert.equal(strong.a.damage.worst, STRONG);
  assert.equal(strong.b.damage.worst, STRONG);
  assert.ok(strong.a.speed < light.a.speed / 2, `${strong.a.speed} frente a ${light.a.speed}`);
  assert.ok(strong.b.speed < light.b.speed / 2, `${strong.b.speed} frente a ${light.b.speed}`);
  assert.ok(strong.a.speed < STRONG_SPEED * 0.15 && strong.b.speed < STRONG_SPEED * 0.15);
  assert.equal(carsOverlap(strong.a, strong.b, CAR), false);
});

test('dos coches de frente: cuenta la velocidad a la que se acercan, no la de cada uno', () => {
  const race = openRace();
  const [a, b] = race.participants;
  const each = STRONG_SPEED * 0.6; // por separado sería leve; juntos, fuerte
  place(race, a, { x: 0, z: 0, heading: 0 }, each);
  place(race, b, { x: 0, z: CAR.length + 0.1, heading: Math.PI }, each);
  step(race);
  assert.equal(a.damage.worst, STRONG);
  assert.equal(b.damage.worst, STRONG);

  // Alcance entre dos coches muy rápidos que apenas se llevan velocidad: leve.
  place(race, a, { x: 0, z: 0, heading: 0 }, 40);
  place(race, b, { x: 0, z: CAR.length + 0.02, heading: 0 }, 35);
  a.damage = createDamage();
  b.damage = createDamage();
  step(race);
  assert.equal(a.damage.worst, LIGHT);
  assert.equal(b.damage.worst, LIGHT);
});

test('misma clasificación y consecuencias para los diez, entre rivales y con cualquier modelo (RF-032, RN-07)', () => {
  for (const speed of [STRONG_SPEED - 2, STRONG_SPEED + 2]) {
    const outcome = ({ a, b }) => [a, b].map((p) => ({
      worst: p.damage.worst, level: p.damage.level, speed: p.speed.toFixed(6),
    }));
    // Un choque rival–rival como referencia, frente a todas las demás parejas.
    const expected = outcome(crash(rivals[0], rivals[1], speed));
    const models = new Set();
    for (let i = 0; i < CONFIG.race.maxParticipants; i++) {
      const j = (i + 1) % CONFIG.race.maxParticipants;
      const result = crash(i, j, speed);
      assert.deepEqual(outcome(result), expected, `${result.a.id} contra ${result.b.id}`);
      models.add(result.a.carModelId).add(result.b.carModelId);
    }
    assert.equal(models.size, CONFIG.cars.models.length);

    const against = hitScenery(ROCK, speed, playerIndex).car;
    for (const index of rivals) {
      const { car } = hitScenery(ROCK, speed, index);
      assert.deepEqual([car.speed, car.damage], [against.speed, against.damage], car.id);
    }
  }
});

test('los golpes leves repetidos no destruyen ni eliminan a nadie, que sigue conduciendo (RF-034)', () => {
  const race = openRace(ASPHALT, WALL);
  for (let hit = 0; hit < 8; hit++) {
    place(race, race.player, { x: 0, z: 20 - CAR.length / 2 - 0.1, heading: 0 }, STRONG_SPEED - 1);
    // Sin `place` reponiendo el estado entre medias: el golpe anterior no lo ha dejado fuera de juego.
    step(race, { player: GAS });
    assert.equal(race.player.status, ParticipantStatus.EN_CARRERA, `golpe ${hit}`);
    assert.equal(race.player.wreck, null);
  }
  assert.equal(race.participants.length, 10);
  assert.equal(race.player.damage.worst, LIGHT);
  place(race, race.player, { x: 0, z: -100, heading: 0 });
  for (let i = 0; i < 120; i++) step(race, { player: GAS });
  assert.ok(race.player.speed > P.maxSpeed * 0.5);
});

test('el daño no se acumula sin límite: las rozaduras tienen tope propio y los golpes fuertes llegan como mucho al máximo', () => {
  let damage = createDamage();
  for (let i = 0; i < 500; i++) damage = stepDamage(damage, 5, DT, IMPACT);
  assert.equal(damage.level, IMPACT.light.maxDamage);
  assert.equal(damage.worst, LIGHT);
  for (let i = 0; i < 50; i++) damage = stepDamage(damage, P.maxSpeed, DT, IMPACT);
  assert.equal(damage.level, IMPACT.strong.maxDamage);
  assert.equal(damage.worst, STRONG);
  // Un toque posterior no rebaja ni sube nada.
  damage = stepDamage(damage, 5, DT, IMPACT);
  assert.equal(damage.level, IMPACT.strong.maxDamage);
  assert.equal(damage.worst, STRONG);
});

test('la reacción dura su tiempo de simulación y las marcas se quedan', () => {
  assert.equal(stepDamage(createDamage(), 0, DT, IMPACT).effect, null);
  const clean = createDamage();
  assert.equal(stepDamage(clean, 0, DT, IMPACT), clean, 'sin golpes no cambia nada');

  let damage = stepDamage(clean, P.maxSpeed, DT, IMPACT);
  assert.equal(damage.effect, STRONG);
  // Un roce mientras tanto no corta la reacción del golpe fuerte.
  damage = stepDamage(damage, 5, DT, IMPACT);
  assert.equal(damage.effect, STRONG);
  assert.ok(Math.abs(damage.effectTime - (IMPACT.strong.effectDuration - DT)) < 1e-9);
  let time = DT;
  while (damage.effect !== null) {
    damage = stepDamage(damage, 0, DT, IMPACT);
    time += DT;
  }
  assert.ok(Math.abs(time - IMPACT.strong.effectDuration) <= DT + 1e-9, `${time}`);
  assert.equal(damage.worst, STRONG);
  assert.ok(damage.level > 0);

  // Un roce continuo da ráfagas sucesivas en vez de una reacción congelada al principio.
  let scraping = createDamage();
  const times = [];
  for (let i = 0; i < 60; i++) {
    scraping = stepDamage(scraping, 5, DT, IMPACT);
    assert.equal(scraping.effect, LIGHT);
    times.push(scraping.effectTime);
  }
  assert.ok(Math.min(...times) < IMPACT.light.effectDuration / 4);
  assert.ok(times.filter((value) => value === IMPACT.light.effectDuration).length > 1);
});

test('el daño no cambia el rendimiento: un coche dañado se conduce igual que uno sano', () => {
  const race = openRace();
  const [damaged, clean] = race.participants;
  place(race, damaged, { x: 0, z: 0, heading: 0 });
  place(race, clean, { x: 50, z: 0, heading: 0 });
  damaged.damage = stepDamage(createDamage(), P.maxSpeed, DT, IMPACT);
  let expected = { ...createCarState({ x: 0, z: 0, heading: 0 }) };
  for (let i = 0; i < 180; i++) {
    const input = { ...GAS, left: i > 60 && i < 100, brake: i > 150 };
    step(race, { [damaged.id]: input, [clean.id]: input });
    expected = stepCar(expected, input, DT, P, damaged.offRoad ? CONFIG.offRoad : null);
    assert.equal(damaged.speed, clean.speed);
  }
  assert.equal(damaged.damage.worst, STRONG);
  assert.equal(damaged.x, expected.x);
  assert.equal(damaged.z, expected.z);
});

test('al repetir la carrera o empezar otra, los coches salen sin daños', () => {
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(1) });
  const dirty = () => {
    for (const p of session.race.participants) p.damage = stepDamage(p.damage, P.maxSpeed, DT, IMPACT);
  };
  const assertClean = () => {
    assert.equal(session.race.participants.length, 10);
    for (const p of session.race.participants) {
      assert.deepEqual(p.damage, createDamage());
      assert.equal(p.impactSpeed, 0);
      assert.equal(p.wreck, null);
    }
  };
  const start = () => {
    machine.openSelection();
    session.confirmSelection();
    session.confirmSelection();
    session.confirmSelection();
  };
  start();
  assertClean();
  dirty();
  // Repetir desde los resultados.
  while (machine.state !== GameState.EN_CARRERA) session.step(P.maxStep, {});
  machine.finishRace();
  machine.repeatRace();
  assertClean();
  dirty();
  // Volver al menú y empezar otra.
  while (machine.state !== GameState.EN_CARRERA) session.step(P.maxStep, {});
  machine.finishRace();
  machine.backToMenu();
  start();
  assertClean();
});

test('la clasificación de un choque no depende de los fotogramas por segundo', () => {
  for (const [speed, expected] of [[STRONG_SPEED - 2, LIGHT], [STRONG_SPEED + 2, STRONG]]) {
    for (const dt of [1 / 144, 1 / 60, P.maxStep]) {
      const race = openRace(ASPHALT, WALL);
      // La inercia de la aproximación se compensa para llegar al muro a la velocidad indicada.
      const gap = 0.5;
      const start = Math.sqrt(speed * speed + 2 * P.coastDeceleration * gap);
      place(race, race.player, { x: 0, z: 20 - CAR.length / 2 - gap, heading: 0 }, start);
      for (let time = 0; time < 0.1 && race.player.damage.worst === null; time += dt) step(race, {}, ASPHALT, dt);
      assert.equal(race.player.damage.worst, expected, `${speed} m/s con paso ${dt.toFixed(4)}`);
    }
  }
});
