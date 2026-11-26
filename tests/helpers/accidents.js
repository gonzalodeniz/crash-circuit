// Utilidades compartidas de las pruebas de destrucción y reaparición: carreras con los coches colocados a
// mano, accidentes provocados y comprobación del sitio de reaparición. No es una prueba (no termina en
// `.test.js`).
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config/config.js';
import { carsOverlap } from '../../src/logic/carContacts.js';
import { touchesScenery } from '../../src/logic/collisions.js';
import { createWreck } from '../../src/logic/destruction.js';
import { createCarState } from '../../src/logic/driving.js';
import { relocateProgress } from '../../src/logic/progress.js';
import { ParticipantStatus, stepRace } from '../../src/logic/race.js';
import { createRaceFromSetup } from '../../src/logic/raceSetup.js';
import { createSeededRandom } from '../../src/logic/random.js';
import { forwardOf, nearestOnCenterline, pointAtDistance, rightOf, signedDistance } from '../../src/logic/track.js';

export const DT = 1 / 60;
export const LOCK_STEPS = Math.round(CONFIG.destruction.lockDuration / DT);
export const PROTECTION_STEPS = Math.round(CONFIG.respawn.protectionDuration / DT);
export const NONE = Object.freeze({ accelerate: false, brake: false, left: false, right: false });
const CAR = CONFIG.race.car;

export const held = (race) => Object.fromEntries(race.participants.map((p) => [p.id, NONE]));

/** Un paso en el que solo actúa lo indicado en `inputs`. */
export const step = (race, inputs = {}, config = CONFIG, dt = DT) => stepRace(race, { ...held(race), ...inputs }, dt, config);

/** Punto del circuito a `along` metros de la meta y `lateral` a la derecha. */
export function poseAt(track, along, lateral = 0) {
  const center = pointAtDistance(track, along);
  const right = rightOf(center.heading);
  return { x: center.x + right.x * lateral, z: center.z + right.z * lateral, heading: center.heading };
}

/** Progreso de un coche que ha llegado en orden a `along` metros de la meta con `laps` vueltas completas. */
export function progressAt(track, along, laps = 0) {
  const { x, z } = poseAt(track, along);
  return {
    started: true,
    laps,
    checkpointIndex: track.checkpoints.filter((gate) => gate.distance < along).length,
    lapPosition: along,
    lapDistance: along,
    progress: laps * track.length + along,
    x,
    z,
  };
}

export function place(race, participant, along, { lateral = 0, speed = 0, laps = 0 } = {}) {
  const pose = poseAt(race.track, along, lateral);
  Object.assign(participant, createCarState(pose), { speed, surfaceSample: null, offRoad: false });
  participant.progress = relocateProgress(progressAt(race.track, along, laps), race.track, pose);
}

/**
 * Carrera de diez con la señal de salida ya dada y todos aparcados fuera de la pista, para que no
 * estorben. El escenario es el del circuito.
 */
export function openRace(trackId = 'llanura', config = CONFIG, laps = 3) {
  const race = createRaceFromSetup(config, { carModelId: 'rayo', trackId, laps }, createSeededRandom(1));
  while (!stepRace(race, held(race), DT, config).started);
  race.participants.forEach((p, i) => Object.assign(p, { x: 1000 + i * 10, z: -1000, speed: 0 }));
  return race;
}

/** Destruye un coche donde está, como lo deja un golpe fuerte. */
export function wreck(participant, config = CONFIG) {
  Object.assign(participant, createCarState(participant), {
    status: ParticipantStatus.DESTRUIDO,
    wreck: createWreck(config.destruction),
  });
}

/** Avanza la carrera hasta que el coche deja de estar destruido; devuelve los pasos dados. */
export function waitRespawn(race, car, config = CONFIG) {
  let steps = 0;
  while (car.status === ParticipantStatus.DESTRUIDO && steps < 10 * LOCK_STEPS) {
    step(race, {}, config);
    steps++;
  }
  assert.equal(car.status, ParticipantStatus.EN_CARRERA, 'ha reaparecido');
  return steps;
}

/** Coloca una roca justo delante del coche, para que se estrelle contra ella. */
export function rockAhead(race, car) {
  const forward = forwardOf(car.heading);
  const reach = CAR.length / 2 + 1.1;
  race.scenery = {
    bounds: race.scenery.bounds,
    obstacles: [{ type: 'rock', x: car.x + forward.x * reach, z: car.z + forward.z * reach, radius: 1 }],
  };
}

/** Comprueba que el sitio de un coche reaparecido cumple las condiciones de RF-039 y RN-04. */
export function assertSafeSpot(race, car, label = car.id) {
  const nearest = nearestOnCenterline(race.track, car.x, car.z);
  assert.ok(nearest.distance <= (race.track.width - CAR.width) / 2 + 1e-6, `${label}: entero a lo ancho de la calzada`);
  const heading = pointAtDistance(race.track, nearest.along).heading;
  const error = Math.atan2(Math.sin(car.heading - heading), Math.cos(car.heading - heading));
  assert.ok(Math.abs(error) < 0.2, `${label}: mira en el sentido de la carrera (${error.toFixed(2)} rad)`);
  assert.equal(touchesScenery(car, CAR, race.scenery), false, `${label}: no toca el escenario`);
  for (const other of race.participants) {
    if (other !== car) assert.equal(carsOverlap(car, other, CAR), false, `${label}: no solapa con ${other.id}`);
  }
  const advance = signedDistance(race.track, nearest.along - car.progress.lapDistance);
  assert.ok(advance <= 0.01, `${label}: no queda por delante de su distancia válida (${advance.toFixed(2)} m)`);
}
