import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { createCarState, stepCar } from '../src/logic/driving.js';
import { createRace, stepRace } from '../src/logic/race.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createProgress } from '../src/logic/progress.js';
import { createSeededRandom } from '../src/logic/random.js';
import { isOnRoad, pointAtDistance, rightOf } from '../src/logic/track.js';
import { trackDefinitions } from '../src/logic/trackCatalog.js';

const P = CONFIG.carPerformance;
const OFF = CONFIG.offRoad;
const DT = 1 / 60;
const NONE = { accelerate: false, brake: false, left: false, right: false };
const GAS = { ...NONE, accelerate: true };
const BRAKE = { ...NONE, brake: true };
const OFF_MAX = P.maxSpeed * OFF.maxSpeedFactor;
const EPSILON = 1e-9;

const start = () => createCarState({ x: 0, z: 0, heading: 0 });

function drive(state, input, seconds, surface = null) {
  let s = state;
  for (let i = 0; i < Math.round(seconds / DT); i++) s = stepCar(s, input, DT, P, surface);
  return s;
}

/** Pose a `lateral` metros a la derecha (negativo: izquierda) de la línea central, en la distancia `along`. */
function poseAt(track, along, lateral = 0) {
  const center = pointAtDistance(track, along);
  const right = rightOf(center.heading);
  return { x: center.x + right.x * lateral, z: center.z + right.z * lateral, heading: center.heading };
}

/** Coloca un participante en una pose, con su progreso partiendo de ella. */
function place(race, participant, pose, speed = 0) {
  Object.assign(participant, pose, { speed, progress: createProgress(race.track, pose) });
}

/** Carrera con la señal de salida ya dada. */
function startedRace(trackId, { config = CONFIG, rivals = false } = {}) {
  const race = rivals
    ? createRaceFromSetup(config, { carModelId: 'rayo', trackId, laps: 1 }, createSeededRandom(1))
    : createRace(config, [config.race.player], trackId);
  const held = Object.fromEntries(race.participants.map((p) => [p.id, NONE]));
  while (!stepRace(race, held, DT, config).started);
  return race;
}

/** Todos quietos salvo los indicados en `inputs`. */
function step(race, inputs, config = CONFIG) {
  const held = Object.fromEntries(race.participants.map((p) => [p.id, NONE]));
  return stepRace(race, { ...held, ...inputs }, DT, config);
}

test('los parámetros de la penalización están en la configuración, congelados y la reducen (RF-013)', () => {
  assert.ok(Object.isFrozen(OFF));
  assert.ok(OFF.margin >= 0);
  assert.ok(OFF.maxSpeedFactor > 0 && OFF.maxSpeedFactor < 1);
  assert.ok(OFF.accelerationFactor > 0 && OFF.accelerationFactor < 1);
  assert.ok(OFF.deceleration > 0);
});

test('con la misma entrada, fuera de la calzada se acelera menos y la velocidad máxima es menor (RF-013)', () => {
  assert.ok(drive(start(), GAS, 0.5, OFF).speed < drive(start(), GAS, 0.5).speed);
  assert.ok(Math.abs(drive(start(), GAS, 30, OFF).speed - OFF_MAX) < EPSILON);
  assert.equal(drive(start(), GAS, 30).speed, P.maxSpeed);
});

test('al salir a toda velocidad se pierde velocidad poco a poco hasta el máximo de fuera, sin saltos', () => {
  let s = { ...start(), speed: P.maxSpeed };
  for (let i = 0; i < 60 * 5; i++) {
    const next = stepCar(s, GAS, DT, P, OFF);
    assert.ok(next.speed <= s.speed, 'no gana velocidad por encima del máximo de fuera');
    assert.ok(s.speed - next.speed <= OFF.deceleration * DT + EPSILON, 'sin salto brusco');
    s = next;
  }
  assert.ok(Math.abs(s.speed - OFF_MAX) < EPSILON);
});

test('fuera de la calzada, soltar el acelerador no frena menos y el freno sigue mandando', () => {
  const fast = { ...start(), speed: P.maxSpeed };
  assert.ok(stepCar(fast, NONE, DT, P, OFF).speed < stepCar(fast, NONE, DT, P).speed);
  assert.equal(stepCar(fast, BRAKE, DT, P, OFF).speed, stepCar(fast, BRAKE, DT, P).speed);
  // Por debajo del máximo de fuera, la inercia es la de siempre.
  const slow = { ...start(), speed: OFF_MAX / 2 };
  assert.equal(stepCar(slow, NONE, DT, P, OFF).speed, stepCar(slow, NONE, DT, P).speed);
});

test('la marcha atrás también se reduce fuera de la calzada', () => {
  const reverse = drive(start(), BRAKE, 30, OFF).speed;
  assert.ok(Math.abs(reverse + P.maxReverseSpeed * OFF.maxSpeedFactor) < EPSILON);
  assert.ok(drive(start(), BRAKE, 0.2, OFF).speed > drive(start(), BRAKE, 0.2).speed);
});

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: la carrera sabe en puntos conocidos si el coche está dentro o fuera de la calzada (RF-013)`, () => {
    const race = startedRace(definition.id);
    const halfWidth = race.track.width / 2 + OFF.margin;
    const finishAhead = pointAtDistance(race.track, 0);
    assert.ok(isOnRoad(race.track, finishAhead.x, finishAhead.z));
    // En la recta de meta y la parrilla, a ambos lados y justo a cada lado del borde.
    for (const along of [-20, 0, 10]) {
      for (const side of [-1, 1]) {
        for (const [lateral, expected] of [[0, false], [halfWidth - 0.5, false], [halfWidth + 0.5, true], [halfWidth + 40, true]]) {
          place(race, race.player, poseAt(race.track, along, side * lateral));
          step(race, {});
          assert.equal(race.player.offRoad, expected, `distancia ${along}, lateral ${side * lateral}`);
        }
      }
    }
    // Sobre la línea central de todo el circuito, siempre dentro, aunque la posición anterior quede lejos.
    for (let along = 0; along < race.track.length; along += 25) {
      Object.assign(race.player, poseAt(race.track, along));
      step(race, {});
      assert.equal(race.player.offRoad, false, `centro a ${along.toFixed(0)} m`);
    }
  });

  test(`${definition.id}: un coche fuera de la calzada alcanza menos velocidad que uno dentro y se recupera al volver (RF-013)`, () => {
    const race = startedRace(definition.id);
    const outside = race.track.width / 2 + OFF.margin + 30;
    // Un solo paso por posición para no depender del dibujo del circuito: se recoloca cada vez.
    const speedAfter = (lateral, speed) => {
      place(race, race.player, poseAt(race.track, -20, lateral), speed);
      step(race, { player: GAS });
      return race.player.speed;
    };
    let inside = 0;
    let away = 0;
    for (let i = 0; i < 60 * 4; i++) {
      inside = speedAfter(0, inside);
      away = speedAfter(outside, away);
    }
    assert.equal(inside, P.maxSpeed);
    assert.ok(Math.abs(away - OFF_MAX) < EPSILON, `fuera: ${away}`);
    // De vuelta al asfalto: la aceleración normal, sin saltos.
    const back = speedAfter(0, away);
    assert.ok(Math.abs(back - away - P.acceleration * DT) < EPSILON, `al volver: ${back}`);
    assert.equal(race.player.offRoad, false);
  });
}

test('un rival IA y cualquier modelo de coche sufren la misma penalización que el jugador (RF-032, RN-07)', () => {
  const race = startedRace('llanura', { rivals: true });
  const outside = race.track.width / 2 + OFF.margin + 30;
  race.participants.forEach((participant, i) => {
    place(race, participant, poseAt(race.track, -10 - i * 6, outside), P.maxSpeed);
  });
  const inputs = Object.fromEntries(race.participants.map((p) => [p.id, GAS]));
  step(race, inputs);
  const models = new Set(race.participants.map((p) => p.carModelId));
  assert.equal(models.size, CONFIG.cars.models.length);
  for (const participant of race.participants) {
    assert.equal(participant.offRoad, true, participant.name);
    assert.ok(Math.abs(participant.speed - (P.maxSpeed - OFF.deceleration * DT)) < EPSILON, participant.name);
  }
  // También con las entradas de su propio piloto IA.
  const rival = race.participants.find((p) => !p.isPlayer);
  place(race, rival, poseAt(race.track, 40, outside), P.maxSpeed);
  stepRace(race, { player: NONE }, DT, CONFIG);
  assert.equal(rival.offRoad, true);
  assert.ok(rival.speed < P.maxSpeed);
});

test('el margen de la configuración decide dónde empieza la penalización', () => {
  const config = { ...CONFIG, offRoad: { ...OFF, margin: 3 } };
  const race = startedRace('abismo', { config });
  const edge = race.track.width / 2;
  for (const [lateral, expected] of [[edge + 2.5, false], [edge + 3.5, true]]) {
    place(race, race.player, poseAt(race.track, 0, lateral));
    step(race, {}, config);
    assert.equal(race.player.offRoad, expected, `lateral ${lateral}`);
  }
});

/** Lleva el coche en línea recta hasta `to` en tramos de 1 m como máximo. @returns {boolean} si pisa fuera */
function carry(race, participant, to) {
  const from = { x: participant.x, z: participant.z };
  const heading = Math.atan2(to.x - from.x, to.z - from.z);
  const pieces = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z)));
  let wentOff = false;
  for (let i = 1; i <= pieces; i++) {
    Object.assign(participant, {
      x: from.x + ((to.x - from.x) * i) / pieces,
      z: from.z + ((to.z - from.z) * i) / pieces,
      heading,
      speed: 0,
    });
    step(race, {});
    wentOff ||= participant.offRoad;
  }
  return wentOff;
}

/** Lleva el coche por la línea central entre dos distancias del recorrido. */
function follow(race, participant, first, last) {
  for (let along = first; along <= last; along += 1) carry(race, participant, pointAtDistance(race.track, along));
}

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: recortar por fuera sin cruzar los checkpoints no suma vueltas, progreso ni posiciones (RN-01)`, () => {
    const race = startedRace(definition.id, { rivals: true });
    const { track, player } = race;
    const rival = race.participants.find((p) => !p.isPlayer);
    const middle = track.length * 0.5;
    // El rival recorre media vuelta por la calzada.
    place(race, rival, poseAt(track, -3));
    follow(race, rival, -2, middle);
    // El jugador cruza la salida y ataja por fuera hasta los tres cuartos de la vuelta.
    place(race, player, poseAt(track, -3));
    follow(race, player, -2, 5);
    assert.equal(player.progress.started, true);
    assert.equal(carry(race, player, pointAtDistance(track, track.length * 0.75)), true, 'el atajo va por fuera');
    // Termina el recorrido por la calzada y cruza la meta.
    follow(race, player, track.length * 0.75, track.length + 10);
    assert.equal(player.progress.laps, 0);
    assert.equal(player.finished, false);
    assert.ok(player.progress.progress <= track.checkpoints[1].distance, `progreso ${player.progress.progress}`);
    assert.ok(race.standings.indexOf(rival.id) < race.standings.indexOf(player.id), 'no adelanta al rival');
  });
}
