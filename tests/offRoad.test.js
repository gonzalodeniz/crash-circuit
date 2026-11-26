import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { createCarState, stepCar } from '../src/logic/driving.js';
import { createRace, stepRace } from '../src/logic/race.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createProgress, stepProgress } from '../src/logic/progress.js';
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
  // Por encima de lo que avanza un coche en un paso, o conducir por la calzada dejaría de sumar.
  assert.ok(OFF.maxRejoinAdvance > 2 * P.maxSpeed * P.maxStep);
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
  // Por el exterior de la curva (a la izquierda), donde quedan separados: los coches son sólidos entre sí.
  race.participants.forEach((participant, i) => {
    place(race, participant, poseAt(race.track, -10 - i * 6, -outside), P.maxSpeed);
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
  place(race, rival, poseAt(race.track, 40, -outside), P.maxSpeed);
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

/** Lleva el coche entre dos distancias del recorrido, a `lateral` metros de la línea central. */
function follow(race, participant, first, last, lateral = 0) {
  for (let along = first; along <= last; along += 1) carry(race, participant, poseAt(race.track, along, lateral));
}

/** Metros a la derecha de la línea central por los que va el rival de `duel`: no estorba al jugador. */
const RIVAL_LANE = 4;

/**
 * Jugador y un rival que ya han cruzado la salida: el jugador va por la distancia 5 y el rival está
 * parado en la calzada en `rivalAlong`, a un lado (los coches son sólidos entre sí).
 */
function duel(trackId, rivalAlong) {
  const race = createRace(CONFIG, [CONFIG.race.player, { id: 'r', name: 'Rival' }], trackId);
  const held = { player: NONE, r: NONE };
  while (!stepRace(race, held, DT, CONFIG).started);
  const [player, rival] = race.participants;
  place(race, player, poseAt(race.track, -3));
  place(race, rival, poseAt(race.track, -3, RIVAL_LANE));
  follow(race, player, -2, 5);
  follow(race, rival, -2, rivalAlong(race.track), RIVAL_LANE);
  return { race, player, rival };
}

const aheadOf = (race, first, second) => race.standings.indexOf(first.id) < race.standings.indexOf(second.id);

/** Entradas para conducir hacia un punto con las flechas. */
function toward(car, target) {
  const wanted = Math.atan2(target.x - car.x, target.z - car.z) - car.heading;
  const error = Math.atan2(Math.sin(wanted), Math.cos(wanted));
  return { ...GAS, left: error > 0.03, right: error < -0.03 };
}

// Conducción continua, sin recolocar coches: el jugador ataja campo a través hacia un punto de la
// calzada situado más allá del primer checkpoint, sin cruzarlo.
for (const [trackId, targetAlong] of [['llanura', 297], ['abismo', 340]]) {
  test(`${trackId}: atajar conduciendo por fuera no suma progreso ni adelanta al rival (RN-01)`, () => {
    const race = createRace(CONFIG, [CONFIG.race.player, { id: 'r', name: 'Rival' }], trackId);
    const [player, rival] = race.participants;
    const road = (car) => toward(car, pointAtDistance(race.track, car.progress.lapPosition + 12));
    const drivePair = (mine, theirs) => stepRace(race, { player: mine, r: theirs }, DT, CONFIG);
    while (!drivePair(NONE, NONE).started);
    for (let i = 0; player.progress.progress < 5 && i < 600; i++) drivePair(road(player), road(rival));
    for (let i = 0; rival.progress.progress < 40 && i < 600; i++) drivePair(NONE, road(rival));
    for (let i = 0; rival.speed > 0 && i < 600; i++) drivePair(NONE, BRAKE);
    assert.ok(aheadOf(race, rival, player), 'antes del atajo va delante el rival');

    const target = pointAtDistance(race.track, targetAlong);
    let lastOnRoad = player.progress.progress;
    let wentOff = false;
    for (let i = 0; i < 1500 && Math.hypot(player.x - target.x, player.z - target.z) > 4; i++) {
      drivePair(toward(player, target), NONE);
      wentOff ||= player.offRoad;
      if (!wentOff) lastOnRoad = player.progress.progress;
      assert.ok(aheadOf(race, rival, player), `adelanta con ${player.progress.progress} m`);
    }
    assert.ok(wentOff, 'el atajo va por fuera');
    assert.ok(Math.hypot(player.x - target.x, player.z - target.z) <= 4, 'el jugador llega al otro lado');
    assert.equal(player.progress.checkpointIndex, 0);
    assert.ok(player.progress.progress <= lastOnRoad + OFF.maxRejoinAdvance, `progreso ${player.progress.progress}`);
    assert.ok(player.progress.progress < rival.progress.progress);
  });
}

for (const definition of trackDefinitions(CONFIG)) {
  // El rival está entre el jugador y el checkpoint pendiente: es a quien un atajo podría adelantar.
  const nearFirstCheckpoint = (track) => track.checkpoints[0].distance - 10;
  // Por fuera de la puerta del checkpoint, a un lado de la calzada.
  const around = (track) => track.width / 2 + CONFIG.tracks.common.checkpointMargin + 4;

  test(`${definition.id}: recortar rodeando un checkpoint no suma progreso, vueltas ni posiciones (RN-01)`, () => {
    for (const side of [-1, 1]) {
      const { race, player, rival } = duel(definition.id, nearFirstCheckpoint);
      const { track } = race;
      const gate = track.checkpoints[0].distance;
      const before = player.progress.progress;
      carry(race, player, poseAt(track, 5, side * around(track)));
      follow(race, player, 6, gate + 20, side * around(track));
      assert.equal(player.offRoad, true);
      assert.equal(player.progress.progress, before, 'fuera de la calzada no se suma nada');
      // Vuelve a la calzada más adelante y sigue: tampoco entonces recibe el tramo saltado.
      follow(race, player, gate + 20, gate + 60);
      assert.equal(player.offRoad, false);
      assert.equal(player.progress.progress, before, 'al volver no hay salto');
      assert.ok(aheadOf(race, rival, player), 'no adelanta al rival');
      // Completa el recorrido y cruza la meta: sin el checkpoint no hay vuelta.
      follow(race, player, gate + 60, track.length + 4);
      assert.equal(player.progress.laps, 0);
      assert.equal(player.progress.checkpointIndex, 0);
      assert.equal(player.progress.progress, before);
      assert.ok(aheadOf(race, rival, player));
      // En la pasada siguiente, desde donde dejó el recorrido válido, vuelve a avanzar con normalidad.
      follow(race, player, track.length + 4, track.length + gate + 20);
      assert.equal(player.progress.checkpointIndex, 1);
      assert.ok(Math.abs(player.progress.progress - (gate + 20)) < 2, `progreso ${player.progress.progress}`);
      assert.ok(aheadOf(race, player, rival));
    }
  });

  test(`${definition.id}: tras salirse sin saltarse el checkpoint, al cruzarlo se recupera el progreso (RN-01)`, () => {
    const { race, player } = duel(definition.id, nearFirstCheckpoint);
    const { track } = race;
    const gate = track.checkpoints[0].distance;
    const before = player.progress.progress;
    carry(race, player, poseAt(track, 5, around(track)));
    follow(race, player, 6, gate - 30, around(track));
    follow(race, player, gate - 30, gate - 5);
    assert.equal(player.progress.progress, before, 'sin cruzar el checkpoint no se recupera el tramo');
    follow(race, player, gate - 5, gate + 5);
    assert.equal(player.progress.checkpointIndex, 1);
    assert.ok(Math.abs(player.progress.progress - (gate + 5)) < 2, `progreso ${player.progress.progress}`);
  });

  test(`${definition.id}: pisar fuera un momento no deja el progreso parado`, () => {
    const { race, player } = duel(definition.id, nearFirstCheckpoint);
    const outside = race.track.width / 2 + OFF.margin + 0.5;
    follow(race, player, 6, 10);
    carry(race, player, poseAt(race.track, 11, outside));
    assert.equal(player.offRoad, true);
    const off = player.progress.progress;
    carry(race, player, poseAt(race.track, 14, outside));
    assert.equal(player.progress.progress, off, 'mientras va fuera no avanza');
    carry(race, player, pointAtDistance(race.track, 15));
    assert.ok(Math.abs(player.progress.progress - 15) < 1, `progreso ${player.progress.progress}`);
  });

  test(`${definition.id}: por cualquier parte de la calzada, a velocidad máxima, el progreso sigue al coche`, () => {
    const race = startedRace(definition.id);
    const { track } = race;
    const advance = P.maxSpeed * P.maxStep;
    for (const side of [-1, 0, 1]) {
      const lateral = side * (track.width / 2 + OFF.margin - 0.05);
      let state = createProgress(track, poseAt(track, -3, lateral));
      for (let along = -3 + advance; along < track.length * 2; along += advance) {
        state = stepProgress(state, track, poseAt(track, along, lateral), OFF);
        // En el interior de una curva la proyección sobre la línea central no es exacta: margen amplio.
        assert.ok(Math.abs(state.progress - along) < OFF.maxRejoinAdvance, `lateral ${lateral}, ${along} m: ${state.progress}`);
      }
      assert.equal(state.laps, 1);
    }
  });
}
