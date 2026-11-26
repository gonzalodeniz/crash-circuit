// Contacto entre coches (RF-033, y RF-032 parcial). Lógica pura, sin Three.js ni DOM (RNF-05). Vale
// igual para los diez participantes: no mira quién conduce ni qué modelo es (RN-07).
//
// Cada coche es su rectángulo real (`length` × `width`, orientado según su rumbo). Para que dos coches no
// se atraviesen a ninguna velocidad, el paso se recorre en tramos cortos y en cada uno se miran las
// parejas cercanas. Al tocarse:
// - se separan: retrocede quien iba hacia el otro (a medias, según su velocidad, si iban los dos), así
//   que el contacto nunca adelanta de golpe a un coche ni le regala recorrido (RN-01);
// - intercambian velocidad como dos masas iguales: quien golpea la pierde y el golpeado la gana;
// - lo que empuja de costado queda como deslizamiento (`slideX`, `slideZ`) que se apaga solo, y un golpe
//   descentrado cambia el rumbo;
// - si se acercaban deprisa, el golpe es fuerte para los dos, que además pierden casi toda su velocidad
//   (`impact.js`).
// El resto del paso continúa con las velocidades nuevas.
import { resolveSceneryCollision } from './collisions.js';
import { applyImpact } from './impact.js';
import { forwardOf } from './track.js';

/** Holgura (m) con la que quedan separados dos coches, para que no sigan contando como contacto. */
const SKIN = 1e-6;

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

/** Semiextensión del coche (con avance `forward`) proyectada sobre el eje unitario (`x`, `z`). */
function halfExtent(forward, car, x, z) {
  const along = Math.abs(forward.x * x + forward.z * z);
  const across = Math.abs(forward.z * x - forward.x * z);
  return (along * car.length + across * car.width) / 2;
}

/**
 * Contacto entre dos coches (ejes separadores de sus dos rectángulos).
 * @returns {{x: number, z: number, depth: number}|null} dirección unitaria (de `b` hacia `a`) y metros que
 *   habría que separarlos, o `null` si no se tocan
 */
function contactBetween(a, b, car) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const diagonal = car.length * car.length + car.width * car.width;
  if (dx * dx + dz * dz >= diagonal) return null;
  const forwardA = forwardOf(a.heading);
  const forwardB = forwardOf(b.heading);
  let best = null;
  for (const forward of [forwardA, forwardB]) {
    for (const [x, z] of [[forward.x, forward.z], [forward.z, -forward.x]]) {
      const distance = dx * x + dz * z;
      const depth = halfExtent(forwardA, car, x, z) + halfExtent(forwardB, car, x, z) - Math.abs(distance);
      if (depth <= 0) return null;
      if (!best || depth < best.depth) {
        const sign = distance < 0 ? -1 : 1;
        best = { x: x * sign, z: z * sign, depth };
      }
    }
  }
  return best;
}

/** Indica si los rectángulos de dos coches se solapan. */
export function carsOverlap(a, b, car) {
  return contactBetween(a, b, car) !== null;
}

function corners(pose, car) {
  const forward = forwardOf(pose.heading);
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([u, w]) => ({
    x: pose.x + (forward.x * u * car.length - forward.z * w * car.width) / 2,
    z: pose.z + (forward.z * u * car.length + forward.x * w * car.width) / 2,
  }));
}

function contains(pose, car, point) {
  const forward = forwardOf(pose.heading);
  const dx = point.x - pose.x;
  const dz = point.z - pose.z;
  return Math.abs(dx * forward.x + dz * forward.z) <= car.length / 2
    && Math.abs(dz * forward.x - dx * forward.z) <= car.width / 2;
}

/** Punto aproximado del contacto: la media de las esquinas de cada coche metidas dentro del otro. */
function contactPoint(a, b, car) {
  const inside = [
    ...corners(a, car).filter((corner) => contains(b, car, corner)),
    ...corners(b, car).filter((corner) => contains(a, car, corner)),
  ];
  const points = inside.length > 0 ? inside : [a, b];
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

/** Velocidad real del coche en el plano: la de su marcha más el deslizamiento. */
function velocityOf(state) {
  const forward = forwardOf(state.heading);
  return {
    x: forward.x * state.speed + (state.slideX ?? 0),
    z: forward.z * state.speed + (state.slideZ ?? 0),
  };
}

/**
 * Aplica a un coche el cambio de velocidad `delta` en el punto `point`: la parte en la dirección del
 * coche cambia su velocidad, la lateral queda como deslizamiento y, si el golpe es descentrado, gira.
 * `keep` es la fracción de velocidad que conserva tras el golpe.
 */
function push(state, delta, point, keep, performance, params) {
  const forward = forwardOf(state.heading);
  const along = delta.x * forward.x + delta.z * forward.z;
  const slideX = (state.slideX ?? 0) + delta.x - forward.x * along;
  const slideZ = (state.slideZ ?? 0) + delta.z - forward.z * along;
  const slide = Math.hypot(slideX, slideZ);
  const limit = slide > params.maxSlideSpeed ? params.maxSlideSpeed / slide : 1;
  // Par del golpe respecto al centro; positivo aumenta el rumbo (gira a la izquierda).
  const torque = delta.x * (point.z - state.z) - delta.z * (point.x - state.x);
  state.speed = clamp((state.speed + along) * keep, performance.maxSpeed);
  state.slideX = slideX * limit;
  state.slideZ = slideZ * limit;
  state.heading += clamp(torque * params.spinFactor, params.maxSpin);
}

/**
 * Separa y hace reaccionar a dos coches que se solapan; modifica sus estados.
 * @returns {boolean} verdadero si se tocaban
 */
function collide(a, b, car, performance, params, impact) {
  const contact = contactBetween(a, b, car);
  if (!contact) return false;
  const velocityA = velocityOf(a);
  const velocityB = velocityOf(b);
  // Lo que cada uno avanza hacia el otro, y la velocidad a la que se acercan.
  const intoA = Math.max(0, -(velocityA.x * contact.x + velocityA.z * contact.z));
  const intoB = Math.max(0, velocityB.x * contact.x + velocityB.z * contact.z);
  const closing = (velocityB.x - velocityA.x) * contact.x + (velocityB.z - velocityA.z) * contact.z;
  const point = contactPoint(a, b, car);

  const shareA = intoA + intoB > 0 ? intoA / (intoA + intoB) : 0.5;
  const depth = contact.depth + SKIN;
  a.x += contact.x * depth * shareA;
  a.z += contact.z * depth * shareA;
  b.x -= contact.x * depth * (1 - shareA);
  b.z -= contact.z * depth * (1 - shareA);

  if (closing > 0) {
    const impulse = ((1 + params.restitution) * closing) / 2;
    const keep = 1 - params.speedLoss * Math.min(1, closing / performance.maxSpeed);
    push(a, { x: contact.x * impulse, z: contact.z * impulse }, point, keep, performance, params);
    push(b, { x: -contact.x * impulse, z: -contact.z * impulse }, point, keep, performance, params);
    // La velocidad de acercamiento es la intensidad del golpe, la misma para los dos.
    Object.assign(a, applyImpact(a, closing, impact));
    Object.assign(b, applyImpact(b, closing, impact));
  }
  return true;
}

/**
 * Mueve un coche con el deslizamiento que le haya dejado un contacto, que se va apagando.
 * @returns {object} el mismo estado si no desliza; si no, una copia desplazada
 */
export function applySlide(state, dt, params) {
  const slide = Math.hypot(state.slideX ?? 0, state.slideZ ?? 0);
  if (slide === 0) return state;
  const remaining = Math.max(0, slide - params.slideDeceleration * dt) / slide;
  return {
    ...state,
    x: state.x + state.slideX * dt,
    z: state.z + state.slideZ * dt,
    slideX: state.slideX * remaining,
    slideZ: state.slideZ * remaining,
  };
}

/**
 * Aplica los contactos entre coches a los movimientos de un paso. Garantiza que, si ningún coche
 * solapaba con otro al empezar el paso, ninguno solapa al terminar.
 * @param {Array<{previous: object, next: object}>} moves por cada coche, su estado antes del paso y el que
 *   resulta de conducir y de chocar con el escenario (ninguno se modifica)
 * @param {{car: {length: number, width: number}, scenery: object}} world dimensiones del coche y escenario
 * @param {number} dt segundos del paso
 * @param {{carContact: object, carPerformance: object, collision: object, impact: object}} config secciones de CONFIG
 * @returns {object[]} estado final de cada coche, en el mismo orden (`next` si no ha tocado a nadie)
 */
export function resolveCarContacts(moves, { car, scenery }, dt, config) {
  const { carContact: params, carPerformance: performance, collision, impact } = config;
  const radius = Math.hypot(car.length, car.width) / 2;
  // Lo más que se puede mover un coche en este paso, aunque un golpe le cambie la velocidad.
  const reach = moves.reduce((most, { previous, next }) => {
    const travel = Math.hypot(next.x - previous.x, next.z - previous.z) + Math.abs(next.heading - previous.heading) * radius;
    return Math.max(most, travel);
  }, (performance.maxSpeed + params.maxSlideSpeed) * dt);

  const pairs = [];
  for (let i = 0; i < moves.length; i++) {
    for (let j = i + 1; j < moves.length; j++) {
      const dx = moves[i].previous.x - moves[j].previous.x;
      const dz = moves[i].previous.z - moves[j].previous.z;
      if (dx * dx + dz * dz <= (2 * (radius + reach)) ** 2) pairs.push([i, j]);
    }
  }
  const results = moves.map(({ next }) => next);
  if (pairs.length === 0) return results;

  const near = [...new Set(pairs.flat())];
  const pieces = Math.max(1, Math.ceil((2 * reach) / params.maxSweepStep));
  const pieceTime = dt / pieces;
  const states = [];
  const deltas = [];
  for (const i of near) {
    const { previous, next } = moves[i];
    states[i] = { ...next, x: previous.x, z: previous.z, heading: previous.heading };
    deltas[i] = {
      x: (next.x - previous.x) / pieces,
      z: (next.z - previous.z) / pieces,
      heading: (next.heading - previous.heading) / pieces,
    };
  }

  const touched = new Set();
  for (let piece = 0; piece < pieces; piece++) {
    for (const i of near) {
      states[i].x += deltas[i].x;
      states[i].z += deltas[i].z;
      states[i].heading += deltas[i].heading;
    }
    // Separar a una pareja puede meter a uno en un tercero: se repite hasta que nadie se toca.
    const hit = new Set();
    let again = true;
    for (let pass = 0; pass < params.maxPushIterations && again; pass++) {
      again = false;
      for (const [i, j] of pairs) {
        if (!collide(states[i], states[j], car, performance, params, impact)) continue;
        hit.add(i).add(j);
        again = true;
      }
    }
    // Quien ha chocado recorre lo que queda del paso con su velocidad nueva, sin dejar de girar.
    for (const i of hit) {
      const velocity = velocityOf(states[i]);
      deltas[i] = { x: velocity.x * pieceTime, z: velocity.z * pieceTime, heading: deltas[i].heading };
      touched.add(i);
    }
  }

  // Un golpe puede mandar un coche contra el muro o un obstáculo: tampoco se atraviesan.
  for (const i of touched) {
    results[i] = resolveSceneryCollision(moves[i].previous, states[i], car, scenery, collision, impact);
  }

  // Último recurso, para un coche encajonado: quien aún solape vuelve a donde empezó el paso, donde no
  // tocaba a nadie, y casi parado. Cada coche vuelve como mucho una vez, así que siempre termina.
  const reverted = new Set();
  const revert = (i) => {
    if (reverted.has(i)) return false;
    const { x, z, heading } = moves[i].previous;
    results[i] = { ...results[i], x, z, heading, speed: results[i].speed * params.restitution, slideX: 0, slideZ: 0 };
    reverted.add(i);
    return true;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        if (!carsOverlap(results[i], results[j], car)) continue;
        const first = revert(i);
        const second = revert(j);
        changed ||= first || second;
      }
    }
  }
  return results;
}
