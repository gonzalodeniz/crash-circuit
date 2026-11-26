// Los diez participantes se destruyen y vuelven con las mismas reglas, también con varios accidentes a la vez
// (RF-032, RF-041, RF-027, RN-02, RN-04, CA-04, CA-05).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config/config.js';
import { carsOverlap } from '../src/logic/carContacts.js';
import { ParticipantStatus, stepRace } from '../src/logic/race.js';
import { createRaceFromSetup } from '../src/logic/raceSetup.js';
import { createSeededRandom } from '../src/logic/random.js';
import { findRespawnSpot } from '../src/logic/respawn.js';
import { rankParticipants } from '../src/logic/standings.js';
import { trackDefinitions } from '../src/logic/trackCatalog.js';
import { nearestOnCenterline } from '../src/logic/track.js';
import {
  DT,
  LOCK_STEPS,
  NONE,
  PROTECTION_STEPS,
  assertSafeSpot,
  held,
  openRace,
  place,
  poseAt,
  rockAhead,
  step,
  waitRespawn,
  wreck,
} from './helpers/accidents.js';
import { autopilot } from './helpers/autopilot.js';
import { playerPilot } from './helpers/playerPilot.js';

const P = CONFIG.carPerformance;
const CAR = CONFIG.race.car;
const RESPAWN = CONFIG.respawn;
const { DESTRUIDO, EN_CARRERA } = ParticipantStatus;
const playerIndex = CONFIG.grid.playerSlotIndex;
const rivalIndex = playerIndex === 0 ? 1 : 0;

/** Distancia (m) de un coche al centro de la calzada. */
const fromCenter = (race, car) => nearestOnCenterline(race.track, car.x, car.z).distance;

/** Lo que mide el centro de un coche pegado al borde de la calzada. */
const atEdge = (race) => (race.track.width - CAR.width) / 2;

function assertNoOverlapBetween(cars, label) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      assert.equal(carsOverlap(cars[i], cars[j], CAR), false, `${label}: ${cars[i].id} y ${cars[j].id}`);
    }
  }
}

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: un rival estrellado vuelve a los 3 s activos, conduce solo y termina la carrera (CA-05, RF-028, RF-032)`, () => {
    const race = openRace(definition.id);
    const rival = race.participants[rivalIndex];
    // Sale a la pista por su cuenta; los demás siguen aparcados.
    place(race, rival, 30, { speed: P.maxSpeed });
    const ids = race.participants.map((p) => p.id);
    const inputs = held(race);
    delete inputs[rival.id];
    const drive = () => stepRace(race, inputs, DT, CONFIG);
    const { scenery } = race;
    rockAhead(race, rival);
    drive();
    assert.equal(rival.status, DESTRUIDO, 'el golpe fuerte lo destruye');
    race.scenery = scenery;

    let steps = 0;
    while (rival.status === DESTRUIDO && steps <= 2 * LOCK_STEPS) {
      drive();
      steps++;
    }
    assert.equal(steps, LOCK_STEPS, 'vuelve a los 3 s, ni antes ni después');
    assert.equal(rival.status, EN_CARRERA);
    assert.equal(rival.progress.laps, 0, 'reaparecer no suma vueltas');
    assertSafeSpot(race, rival);

    let limit = 60 * 600;
    while (!rival.finished && limit-- > 0) drive();
    assert.ok(rival.finished, `termina: ${rival.progress.laps} vueltas`);
    assert.equal(rival.progress.laps, race.totalLaps);
    assert.deepEqual(race.participants.map((p) => p.id), ids, 'ni se duplica ni desaparece');
    assert.equal(race.standings[0], rival.id);
  });
}

test('los diez, jugador y rivales, siguen los mismos criterios de destrucción, bloqueo y protección (RF-041)', () => {
  for (let index = 0; index < CONFIG.race.maxParticipants; index++) {
    const race = openRace();
    const car = race.participants[index];
    place(race, car, 30, { speed: P.maxSpeed });
    rockAhead(race, car);
    step(race);
    assert.equal(car.status, DESTRUIDO, car.id);
    assert.equal(waitRespawn(race, car), LOCK_STEPS, `${car.id}: bloqueo`);
    assertSafeSpot(race, car);
    let steps = 0;
    while (car.protection !== null && steps <= 2 * PROTECTION_STEPS) {
      step(race);
      steps++;
    }
    assert.equal(steps, PROTECTION_STEPS, `${car.id}: protección`);
  }
});

test('un choque de frente destruye a los dos y reaparecen en el mismo instante sin solaparse (CA-04, CA-05)', () => {
  const race = openRace();
  const [first, second] = [race.participants[playerIndex], race.participants[rivalIndex]];
  place(race, first, 40, { speed: P.maxSpeed });
  place(race, second, 40 + CAR.length + 0.2, { speed: P.maxSpeed });
  second.heading += Math.PI;
  step(race);
  assert.deepEqual([first.status, second.status], [DESTRUIDO, DESTRUIDO]);
  for (let i = 0; i < LOCK_STEPS - 1; i++) step(race);
  assert.deepEqual([first.status, second.status], [DESTRUIDO, DESTRUIDO]);
  step(race);
  assert.deepEqual([first.status, second.status], [EN_CARRERA, EN_CARRERA]);
  assertSafeSpot(race, first);
  assertSafeSpot(race, second);
});

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: los diez destruidos a la vez en el mismo punto reaparecen juntos y sin solaparse (RF-041, RN-04)`, () => {
    const race = openRace(definition.id);
    const along = race.track.length / 2;
    for (const car of race.participants) {
      place(race, car, along);
      wreck(car);
    }
    for (let i = 0; i < LOCK_STEPS; i++) step(race);
    for (const car of race.participants) {
      assert.equal(car.status, EN_CARRERA, car.id);
      assertSafeSpot(race, car);
      assert.equal(car.progress.laps, 0);
    }
    assert.equal(new Set(race.participants.map((p) => p.id)).size, 10);
    assertNoOverlapBetween(race.participants, definition.id);
  });

  test(`${definition.id}: el sitio elegido queda fuera del paso de un coche lanzado, también en las curvas (RF-042)`, () => {
    const race = openRace(definition.id);
    const car = race.participants[playerIndex];
    const speed = P.maxSpeed;
    for (let along = 50; along < race.track.length; along += 17) {
      place(race, car, along);
      const coming = { ...poseAt(race.track, along - 30, 1), speed };
      const spot = findRespawnSpot(race, car.progress, [coming], RESPAWN);
      assert.ok(spot, `sin sitio en ${along}`);
      for (let t = 0; t <= RESPAWN.approachTime; t += DT) {
        const later = poseAt(race.track, along - 30 + speed * t, 1);
        assert.equal(carsOverlap(spot, later, CAR), false, `${along} m: pasaría por encima a los ${t.toFixed(2)} s`);
      }
    }
  });
}

/**
 * Un coche destruido en una recta y otro que llega por detrás a toda velocidad justo cuando le toca volver.
 * Devuelve cómo ha quedado cada uno un segundo y medio después.
 */
function respawnBeforeChaser(config) {
  const race = openRace('llanura', config);
  const car = race.participants[playerIndex];
  const chaser = race.participants[rivalIndex];
  const along = race.track.length - 10;
  place(race, car, along);
  wreck(car, config);
  for (let i = 0; i < LOCK_STEPS - 1; i++) step(race, {}, config);
  place(race, chaser, along - 35, { speed: P.maxSpeed });
  const drive = () => step(race, { [chaser.id]: autopilot(race, chaser, { topSpeed: P.maxSpeed }) }, config);
  drive();
  assert.equal(car.status, EN_CARRERA, 'vuelve a su hora');
  const spot = { x: car.x, z: car.z };
  const aside = fromCenter(race, car);
  for (let i = 0; i < 90; i++) drive();
  return { car, chaser, aside, moved: Math.hypot(car.x - spot.x, car.z - spot.z) };
}

test('no reaparece delante de un coche que llega lanzado: ni se tocan ni se destruye quien venía (RF-042)', () => {
  const safe = respawnBeforeChaser(CONFIG);
  assert.ok(safe.aside > CAR.width, `se aparta de su trayectoria: ${safe.aside}`);
  assert.equal(safe.moved, 0, 'nadie lo golpea');
  assert.equal(safe.chaser.status, EN_CARRERA);

  // Sin mirar lo que viene (`approachTime` a cero), el mismo accidente encadena otro.
  const blind = respawnBeforeChaser({ ...CONFIG, respawn: { ...RESPAWN, approachTime: 0 } });
  assert.ok(blind.aside < 1e-6, 'en el centro');
  assert.equal(blind.chaser.status, DESTRUIDO);
});

test('un coche que se aleja o que está demasiado lejos para llegar no cambia el sitio preferido (RF-039)', () => {
  const race = openRace();
  const car = race.participants[playerIndex];
  place(race, car, 150);
  const preferred = findRespawnSpot(race, car.progress, [], RESPAWN);
  const leaving = { ...poseAt(race.track, 158), speed: P.maxSpeed };
  const far = { ...poseAt(race.track, 150 - P.maxSpeed * RESPAWN.approachTime - 2 * CAR.length), speed: P.maxSpeed };
  assert.deepEqual(findRespawnSpot(race, car.progress, [leaving, far], RESPAWN), preferred);
});

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: quien ya ha terminado reaparece pegado a un borde, conserva su tiempo y los demás pasan sin tocarlo (RF-027, RF-040)`, () => {
    const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId: definition.id, laps: 1 }, createSeededRandom(5));
    const pilot = playerPilot(race, 5, DT);
    const drive = () => stepRace(race, { player: race.clock.raceTime > 0 ? pilot() : NONE }, DT, CONFIG);
    let limit = 60 * 600;
    while (race.winner === null && limit-- > 0) drive();
    const winner = race.participants.find((p) => p.id === race.winner.id);
    const { finishTime } = winner;
    const laps = winner.progress.laps;
    wreck(winner);
    while (winner.status === DESTRUIDO && limit-- > 0) drive();

    assert.equal(winner.status, EN_CARRERA);
    assert.ok(Math.abs(fromCenter(race, winner) - atEdge(race)) < 0.2, `al borde: ${fromCenter(race, winner)}`);
    assertSafeSpot(race, winner);
    const spot = { x: winner.x, z: winner.z };
    while (race.participants.some((p) => !p.finished) && limit-- > 0) drive();
    assert.ok(race.participants.every((p) => p.finished), 'todos terminan');
    assert.deepEqual({ x: winner.x, z: winner.z }, spot, 'nadie lo ha movido');
    assert.deepEqual([winner.finished, winner.finishTime, winner.progress.laps], [true, finishTime, laps]);
    assert.equal(race.winner.id, winner.id);
    assert.equal(race.standings[0], winner.id);
  });
}

test('con los dos bordes ocupados, quien ha terminado se va más atrás, nunca al centro', () => {
  const race = openRace('llanura', CONFIG, 1);
  const car = race.participants[rivalIndex];
  place(race, car, 100, { laps: 1 });
  Object.assign(car, { finished: true, finishTime: 20 });
  const [left, right] = race.participants.filter((p) => p !== car);
  place(race, left, 100, { lateral: -atEdge(race) });
  place(race, right, 100, { lateral: atEdge(race) });
  wreck(car);
  waitRespawn(race, car);
  assert.ok(Math.abs(fromCenter(race, car) - atEdge(race)) < 0.2);
  assert.ok(car.progress.lapPosition < 100 - CAR.length, `más atrás: ${car.progress.lapPosition}`);
});

// Carreras completas de diez, con la configuración real, en las que además de los accidentes propios se
// fuerzan golpes fuertes: dos o tres coches a la vez cada pocos segundos y cada uno una vez más al terminar.
const FORCED_EVERY = 5 * 60; // pasos entre dos tandas de accidentes
const FORCED_UNTIL = 60 * 60; // pasos a partir de los cuales ya no se fuerzan más tandas
const RECOVERY_STEPS = 10 * 60; // plazo para que un coche reaparecido vuelva a avanzar
const RECOVERY_DISTANCE = 20; // m de progreso que se le piden en ese plazo

function forcedRace(definition, seed) {
  const label = `${definition.id}, semilla ${seed}`;
  const race = createRaceFromSetup(CONFIG, { carModelId: 'rayo', trackId: definition.id, laps: 3 }, createSeededRandom(seed));
  const pilot = playerPilot(race, seed, DT);
  const pick = createSeededRandom(seed + 100);
  const ids = race.participants.map((p) => p.id);
  const watch = new Map(race.participants.map((p) => [p.id, { locked: 0, recovering: null, finishTime: null, laps: 0 }]));
  const hitAfterFinish = new Set();
  let steps = 0;
  let simultaneous = 0;
  let respawns = 0;

  // Hasta que los diez han terminado, se han destruido después y han vuelto.
  while ((hitAfterFinish.size < 10 || race.participants.some((p) => p.status === DESTRUIDO)) && steps < 60 * 600) {
    steps++;
    if (steps % FORCED_EVERY === 0 && steps <= FORCED_UNTIL) {
      const racing = race.participants.filter((p) => p.status === EN_CARRERA && !p.finished);
      for (let i = 0, count = 2 + Math.floor(pick() * 2); i < count && racing.length > 0; i++) {
        wreck(racing.splice(Math.floor(pick() * racing.length), 1)[0]);
      }
    }
    for (const car of race.participants) {
      if (car.finished && car.status === EN_CARRERA && !hitAfterFinish.has(car.id)) {
        hitAfterFinish.add(car.id);
        wreck(car);
      }
    }
    const before = race.participants.map((p) => p.status);
    stepRace(race, { player: race.clock.raceTime > 0 ? pilot() : NONE }, DT, CONFIG);

    let together = 0;
    race.participants.forEach((car, i) => {
      const seen = watch.get(car.id);
      const who = `${label}, paso ${steps}, ${car.id}`;
      assert.ok(car.progress.laps >= seen.laps && car.progress.laps <= 3, `${who}: vueltas`);
      if (before[i] === DESTRUIDO) {
        seen.locked++;
        assert.equal(car.progress.laps, seen.laps, `${who}: ni destruido ni al reaparecer suma vueltas`);
        if (car.status === EN_CARRERA) {
          assert.equal(seen.locked, LOCK_STEPS, `${who}: reaparece a los 3 s`);
          together++;
          respawns++;
          seen.locked = 0;
          seen.recovering = car.finished ? null : { step: steps, progress: car.progress.progress };
          for (const other of race.participants) {
            if (other !== car && other.status === EN_CARRERA) {
              assert.equal(carsOverlap(car, other, CAR), false, `${who}: solapa con ${other.id}`);
            }
          }
        }
      } else if (car.status === DESTRUIDO) {
        seen.locked = 0;
        seen.recovering = null;
      }
      seen.laps = car.progress.laps;
      if (seen.recovering && (car.finished || car.progress.progress > seen.recovering.progress + RECOVERY_DISTANCE)) {
        seen.recovering = null;
      }
      assert.ok(!seen.recovering || steps - seen.recovering.step < RECOVERY_STEPS, `${who}: no vuelve a avanzar`);
      if (seen.finishTime !== null) assert.equal(car.finishTime, seen.finishTime, `${who}: conserva su tiempo`);
      seen.finishTime = car.finishTime;
    });
    simultaneous = Math.max(simultaneous, together);

    assert.deepEqual(race.participants.map((p) => p.id), ids, `${label}: siempre los mismos diez`);
    assert.equal(new Set(race.standings).size, 10, `${label}: diez entradas únicas`);
    if (steps % 10 === 0) {
      assert.deepEqual(race.standings, rankParticipants(race.participants).map((p) => p.id), label);
      assertNoOverlapBetween(race.participants.filter((p) => p.status === EN_CARRERA), `${label}, paso ${steps}`);
    }
  }

  assert.ok(race.participants.every((p) => p.finished && p.progress.laps === 3), `${label}: todos terminan`);
  assert.equal(hitAfterFinish.size, 10, `${label}: todos se han destruido también después de terminar`);
  assert.ok(respawns > 20 && simultaneous >= 2, `${label}: ${respawns} reapariciones, ${simultaneous} a la vez`);
  const times = race.standings.map((id) => race.participants.find((p) => p.id === id).finishTime);
  assert.deepEqual(times, [...times].sort((a, b) => a - b), `${label}: clasificación por llegada real`);
  assert.equal(race.winner.id, race.standings[0], label);
}

for (const definition of trackDefinitions(CONFIG)) {
  test(`${definition.id}: carreras completas con varios accidentes a la vez terminan con diez coches y sin vueltas de más (CA-05, RN-02, RN-04)`, () => {
    for (const seed of [3, 4]) forcedRace(definition, seed);
  });
}
