import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { aiInput, aiLevel, createRacingLine } from '../src/logic/aiDriver.js';
import { createCarState, stepCar } from '../src/logic/driving.js';
import { createProgress, stepProgress } from '../src/logic/progress.js';
import { createRace, stepRace } from '../src/logic/race.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { RaceSession } from '../src/logic/raceSession.js';
import { GameState, GameStateMachine } from '../src/logic/gameState.js';
import { createSeededRandom } from '../src/logic/random.js';
import { createGridEntries } from '../src/logic/startingGrid.js';
import { buildTrack, nearestOnCenterline } from '../src/logic/track.js';
import { requireTrackDefinition, trackDefinitions } from '../src/logic/trackCatalog.js';


const DT = 1 / 60;
const ORDERED_DIFFICULTIES = ['veryEasy', 'easy', 'medium', 'hard'];
const MAX_STEPS = 60 * 600;
// Con la configuración real: un rival que se destruye reaparece y sigue.
const DRIVING = CONFIG;

function setupFor(trackId, laps = 1) {
  return { carModelId: 'rayo', trackId, laps };
}

/** Carrera completa con semilla, con el jugador quieto, hasta que los nueve rivales terminan. */
function runRivals(trackId, seed, { laps = 1, config = DRIVING, onStep } = {}) {
  const race = createRaceFromSetup(config, setupFor(trackId, laps), createSeededRandom(seed));
  const rivals = race.participants.filter((p) => !p.isPlayer);
  let steps = 0;
  while (rivals.some((p) => !p.finished) && steps++ < MAX_STEPS) {
    stepRace(race, {}, DT, config);
    onStep?.(race, rivals);
  }
  return { race, rivals, steps };
}

/** Deja en la carrera a un solo rival y al jugador, apartado en un rincón: nadie le estorba. */
function leaveAlone(race, rivalId) {
  const rival = race.participants.find((p) => p.id === rivalId);
  const { player } = race;
  Object.assign(player, { x: race.scenery.bounds.minX + 5, z: race.scenery.bounds.minZ + 5 });
  race.participants.splice(0, race.participants.length, player, rival);
  return rival;
}

/**
 * Como `runRivals`, pero cada rival corre solo (con su mismo piloto de esa semilla), para medir cómo
 * conduce sin los contactos entre coches.
 */
function runSolo(trackId, seed, { config = DRIVING, onStep } = {}) {
  return config.race.aiDrivers.map(({ id }) => {
    const race = createRaceFromSetup(config, setupFor(trackId), createSeededRandom(seed));
    const rival = leaveAlone(race, id);
    let steps = 0;
    while (!rival.finished && steps++ < MAX_STEPS) {
      stepRace(race, {}, DT, config);
      onStep?.(race, [rival]);
    }
    return rival;
  });
}

/** Distancia (m) a la que el centro de un coche queda fuera de la calzada (negativa: dentro). */
function overRoad(race, participant) {
  return nearestOnCenterline(race.track, participant.x, participant.z).distance - race.track.width / 2;
}

/** Copia de la configuración de conducción en la que el circuito indicado tiene otra dificultad (para comparar niveles en el mismo trazado). */
function withDifficulty(trackId, difficulty) {
  return {
    ...DRIVING,
    tracks: {
      ...CONFIG.tracks,
      circuits: CONFIG.tracks.circuits.map((circuit) => (circuit.id === trackId ? { ...circuit, difficulty } : circuit)),
    },
  };
}

test('cada circuito del catálogo tiene un nivel de IA y hay exactamente cuatro, ordenados de menor a mayor exigencia (RF-031)', () => {
  assert.deepEqual(Object.keys(CONFIG.ai.levels), ORDERED_DIFFICULTIES);
  assert.deepEqual(trackDefinitions(CONFIG).map((definition) => definition.difficulty), ORDERED_DIFFICULTIES);
  for (const definition of trackDefinitions(CONFIG)) assert.ok(aiLevel(CONFIG.ai, definition.difficulty));
  assert.throws(() => aiLevel(CONFIG.ai, 'imposible'), /Sin nivel de IA/);
  for (const parameter of ['cornerGrip', 'topSpeedFraction', 'brakeFraction']) {
    const values = ORDERED_DIFFICULTIES.map((difficulty) => CONFIG.ai.levels[difficulty][parameter]);
    values.slice(1).forEach((value, i) => assert.ok(value > values[i], `${parameter} crece con la dificultad: ${values}`));
    assert.ok(values.every((value) => value > 0 && value <= 1), `${parameter} es una fracción`);
  }
});

test('ningún parámetro de la IA es una estadística del coche (RN-07)', () => {
  const performanceKeys = new Set(Object.keys(CONFIG.carPerformance));
  const aiKeys = [...Object.keys(CONFIG.ai), ...Object.values(CONFIG.ai.levels).flatMap((level) => Object.keys(level))];
  for (const key of aiKeys) assert.ok(!performanceKeys.has(key), `${key} no puede ser un parámetro de rendimiento`);
  // Todos los niveles tienen los mismos parámetros y ninguna dependencia del modelo de coche.
  const names = Object.keys(CONFIG.ai.levels.veryEasy).sort();
  for (const level of Object.values(CONFIG.ai.levels)) assert.deepEqual(Object.keys(level).sort(), names);
  assert.equal(JSON.stringify(CONFIG.ai).includes('carModel'), false);
});

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: los nueve rivales completan una vuelta válida sin intervención (RF-028, RN-01)`, () => {
    const { race, rivals } = runRivals(definition.id, 11);
    assert.equal(rivals.length, 9);
    for (const rival of rivals) {
      assert.ok(rival.finished, `${rival.name} no termina`);
      assert.equal(rival.progress.laps, 1, rival.name);
      assert.ok(rival.finishTime > 0, rival.name);
    }
    // El jugador no ha recibido órdenes: no completa ninguna vuelta, aunque los rivales lo empujen.
    assert.equal(race.player.progress.laps, 0);
  });

  test(`${definition.id}: en una muestra de carreras ningún rival sale de la calzada más que el margen configurado (RF-029)`, () => {
    for (const seed of [1, 2, 3]) {
      let worst = -Infinity;
      let reversed = false;
      const rivals = runSolo(definition.id, seed, {
        onStep: (race, drivers) => {
          for (const rival of drivers) {
            if (rival.finished) continue;
            worst = Math.max(worst, overRoad(race, rival));
            if (rival.speed < 0) reversed = true;
          }
        },
      });
      assert.ok(rivals.every((p) => p.finished), `semilla ${seed}: todos terminan`);
      assert.ok(worst <= CONFIG.ai.offRoadTolerance, `${definition.id}, semilla ${seed}: sale ${worst.toFixed(2)} m`);
      assert.equal(reversed, false, 'los rivales nunca dan marcha atrás');
    }
  });
}

test('con la misma semilla la carrera de los rivales se repite y con semillas distintas las trayectorias difieren dentro de los límites (RF-029)', () => {
  const snapshot = (seed) => {
    const race = createRaceFromSetup(CONFIG, setupFor('sierra'), createSeededRandom(seed));
    for (let i = 0; i < 60 * 20; i++) stepRace(race, {}, DT, CONFIG);
    return race;
  };
  const a = snapshot(5);
  const b = snapshot(5);
  const c = snapshot(6);
  const poses = (race) => race.participants.map((p) => [p.x, p.z, p.heading, p.speed]);
  assert.deepEqual(poses(a), poses(b), 'misma semilla, misma carrera');
  assert.notDeepEqual(poses(a), poses(c), 'otra semilla, otra carrera');

  // Las trayectorias difieren, pero nunca más que la variación lateral del nivel y siempre dentro de la calzada.
  const track = buildTrack(requireTrackDefinition(CONFIG, 'sierra'));
  const level = aiLevel(CONFIG.ai, 'medium');
  const linesA = Object.values(a.drivers).map((driver) => driver.line);
  const linesC = Object.values(c.drivers).map((driver) => driver.line);
  const freeHalfWidth = track.width / 2 - CONFIG.race.car.width / 2 - CONFIG.ai.edgeMargin;
  let different = false;
  linesA.forEach((line, k) => {
    line.offsets.forEach((offset, i) => {
      assert.ok(Math.abs(offset) <= level.lateralVariation * freeHalfWidth + 1e-9, 'variación acotada');
      if (Math.abs(offset - linesC[k].offsets[i]) > 1e-6) different = true;
    });
  });
  assert.ok(different, 'las trayectorias de dos semillas no son iguales');
  // Los rivales de una misma carrera tampoco siguen la misma línea ni llevan el mismo ritmo.
  assert.notDeepEqual(linesA[0].offsets, linesA[1].offsets);
  assert.equal(new Set(Object.values(a.drivers).map((driver) => driver.pace)).size, 9);
});

test('la trayectoria es cerrada y suave: no salta al pasar por la meta (RF-028)', () => {
  for (const definition of trackDefinitions(CONFIG)) {
    const track = buildTrack(definition);
    const level = aiLevel(CONFIG.ai, definition.difficulty);
    const line = createRacingLine(track, CONFIG.ai, level, CONFIG.carPerformance, CONFIG.race.car, createSeededRandom(3));
    assert.equal(line.x.length, line.count);
    for (let i = 0; i < line.count; i++) {
      const next = (i + 1) % line.count;
      const gap = Math.hypot(line.x[next] - line.x[i], line.z[next] - line.z[i]);
      assert.ok(gap < line.spacing * 1.5 && gap > line.spacing * 0.5, `${definition.id}: salto de ${gap} en ${i}`);
      assert.ok(line.speed[i] >= CONFIG.ai.minTargetSpeed);
      assert.ok(line.speed[i] <= CONFIG.carPerformance.maxSpeed * level.topSpeedFraction + 1e-9);
    }
  }
});

test('el perfil de velocidades frena antes de las curvas con la frenada que permite el nivel', () => {
  for (const definition of trackDefinitions(CONFIG)) {
    const track = buildTrack(definition);
    const level = aiLevel(CONFIG.ai, definition.difficulty);
    const line = createRacingLine(track, CONFIG.ai, level, CONFIG.carPerformance, CONFIG.race.car, createSeededRandom(4));
    const braking = CONFIG.carPerformance.brakeDeceleration * level.brakeFraction;
    for (let i = 0; i < line.count; i++) {
      const next = (i + 1) % line.count;
      const allowed = Math.sqrt(line.speed[next] ** 2 + 2 * braking * line.spacing);
      assert.ok(line.speed[i] <= allowed + 1e-9, `${definition.id}: frenada imposible en ${i}`);
    }
  }
});

test('en el mismo trazado, cada nivel es más rápido que el anterior (RF-031)', () => {
  const meanTimes = ORDERED_DIFFICULTIES.map((difficulty) => {
    const rivals = runSolo('ribera', 21, { config: withDifficulty('ribera', difficulty) });
    assert.ok(rivals.every((p) => p.finished), difficulty);
    return rivals.reduce((sum, p) => sum + p.finishTime, 0) / rivals.length;
  });
  meanTimes.slice(1).forEach((time, i) => assert.ok(time < meanTimes[i], `tiempos medios por nivel: ${meanTimes}`));
});

test('los circuitos más difíciles son más exigentes: los rivales pasan a más velocidad media (RF-031)', () => {
  const speeds = trackDefinitions(CONFIG).map((definition) => {
    const rivals = runSolo(definition.id, 31);
    const meanTime = rivals.reduce((sum, p) => sum + p.finishTime, 0) / rivals.length;
    return buildTrack(definition).length / meanTime;
  });
  speeds.slice(1).forEach((speed, i) => assert.ok(speed > speeds[i], `velocidades medias por circuito: ${speeds}`));
});

test('los rivales conducen con las mismas entradas, el mismo modelo de conducción y el mismo rendimiento que el jugador (RF-003, RN-07)', () => {
  const race = createRaceFromSetup(CONFIG, setupFor('abismo'), createSeededRandom(9));
  const rival = leaveAlone(race, 'ai-5');
  // Hasta la señal de salida: sin movimiento.
  let result;
  do result = stepRace(race, {}, DT, CONFIG);
  while (!result.started);
  // Un coche «sombra» recibe las entradas que da la IA y solo `stepCar` con `carPerformance`.
  let shadow = createCarState(rival);
  shadow = { ...shadow, speed: rival.speed, steer: rival.steer, brakeHeld: rival.brakeHeld, reverseAllowed: rival.reverseAllowed };
  const performance = new Set();
  for (let i = 0; i < 60 * 40; i++) {
    const input = aiInput(race.drivers[rival.id], rival, CONFIG.ai);
    assert.deepEqual(Object.keys(input).sort(), ['accelerate', 'brake', 'left', 'right']);
    assert.ok(Object.values(input).every((value) => typeof value === 'boolean'));
    shadow = stepCar(shadow, input, DT, CONFIG.carPerformance);
    stepRace(race, {}, DT, CONFIG);
    assert.deepEqual(
      [rival.x, rival.z, rival.heading, rival.speed],
      [shadow.x, shadow.z, shadow.heading, shadow.speed],
      `paso ${i}: el rival no se mueve de otra forma`,
    );
    assert.ok(rival.speed <= CONFIG.carPerformance.maxSpeed);
    performance.add(Math.round(rival.speed));
  }
  assert.ok(Math.max(...performance) > 15, 'el rival ha cogido velocidad');
  // Lo que se pasa a `stepCar` es `config.carPerformance`, común a los diez (no hay rendimiento por piloto).
  assert.equal(Object.keys(race.drivers['ai-5']).sort().join(), 'line,pace');
});

test('el progreso de un rival se calcula con la misma lógica de checkpoints y meta que el del jugador (RN-01)', () => {
  for (const trackId of ['llanura', 'abismo']) {
    const race = createRaceFromSetup(CONFIG, setupFor(trackId, 3), createSeededRandom(12));
    const rival = race.participants.find((p) => p.id === 'ai-2');
    let shadow = createProgress(race.track, rival);
    let steps = 0;
    while (!rival.finished && steps++ < MAX_STEPS) {
      const before = { x: rival.x, z: rival.z };
      stepRace(race, {}, DT, CONFIG);
      if (rival.x !== before.x || rival.z !== before.z) shadow = rival.finished ? shadow : stepProgress(shadow, race.track, rival, CONFIG.offRoad);
      if (!rival.finished) assert.deepEqual(rival.progress, shadow, `${trackId}: progreso distinto en el paso ${steps}`);
    }
    assert.ok(rival.finished, trackId);
    assert.equal(rival.progress.laps, 3, `${trackId}: tres vueltas válidas`);
  }
});

test('un rival recolocado en la meta sin haber pasado por los checkpoints no suma vuelta (RN-01)', () => {
  const race = createRaceFromSetup(CONFIG, setupFor('ribera', 3), createSeededRandom(2));
  const rival = race.participants.find((p) => p.id === 'ai-1');
  let result;
  do result = stepRace(race, {}, DT, CONFIG);
  while (!result.started);
  // Se le «teletransporta» detrás de la meta, como lo haría una recolocación: debe seguir sin vueltas.
  const start = race.track.finish;
  Object.assign(rival, { x: start.x, z: start.z, heading: start.heading });
  for (let i = 0; i < 60 * 20; i++) stepRace(race, {}, DT, CONFIG);
  assert.equal(rival.progress.laps, 0, 'la meta sin checkpoints previos no suma vuelta');
});

test('las entradas explícitas mandan sobre la IA y el jugador no tiene piloto IA', () => {
  const race = createRaceFromSetup(CONFIG, setupFor('llanura'), createSeededRandom(1));
  assert.equal(race.drivers.player, undefined);
  assert.equal(Object.keys(race.drivers).length, 9);
  let result;
  do result = stepRace(race, {}, DT, CONFIG);
  while (!result.started);
  const idle = { accelerate: false, brake: false, left: false, right: false };
  const held = Object.fromEntries(race.participants.map((p) => [p.id, idle]));
  for (let i = 0; i < 60; i++) stepRace(race, held, DT, CONFIG);
  const start = race.participants[0];
  assert.ok(start.speed < 1, 'con entrada nula el rival no acelera');
  // Una carrera solo con el jugador no crea pilotos IA y no necesita azar.
  const solo = createRace(CONFIG);
  assert.deepEqual(solo.drivers, {});
});

test('la sesión acepta una fuente de azar: la misma semilla repite los rivales y repetir la carrera los cambia (RF-029)', () => {
  const play = (seed) => {
    const machine = new GameStateMachine();
    const session = new RaceSession(machine, CONFIG, { random: createSeededRandom(seed) });
    machine.openSelection();
    session.confirmSelection();
    session.confirmSelection();
    session.confirmSelection();
    return { machine, session, first: session.race };
  };
  const a = play(40);
  const b = play(40);
  const c = play(41);
  const offsets = (race) => race.drivers['ai-1'].line.offsets;
  assert.deepEqual(offsets(a.first), offsets(b.first));
  assert.notDeepEqual(offsets(a.first), offsets(c.first));
  while (a.machine.state !== GameState.EN_CARRERA) a.session.step(DT, {});
  a.machine.finishRace();
  a.machine.repeatRace();
  assert.notEqual(a.session.race, a.first);
  assert.notDeepEqual(offsets(a.session.race), offsets(a.first), 'repetir da una carrera algo distinta');
  // Sin fuente inyectada, la sesión usa Math.random y también crea los diez con sus pilotos.
  const machine = new GameStateMachine();
  const session = new RaceSession(machine, CONFIG);
  machine.openSelection();
  session.confirmSelection();
  session.confirmSelection();
  session.confirmSelection();
  assert.equal(Object.keys(session.race.drivers).length, 9);
});

test('la parrilla de diez usa un piloto por rival aunque cambie el hueco del jugador', () => {
  const config = { ...CONFIG, grid: { ...CONFIG.grid, playerSlotIndex: 0 } };
  const race = createRace(config, createGridEntries(config, 'rayo'), 'llanura', 1, createSeededRandom(1));
  assert.deepEqual(Object.keys(race.drivers).sort(), CONFIG.race.aiDrivers.map((driver) => driver.id).sort());
});
