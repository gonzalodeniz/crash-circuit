// Colisiones de un coche con los límites y obstáculos del escenario (RF-015, RF-033). Lógica pura, sin
// Three.js ni DOM (RNF-05). Vale igual para los diez participantes: no mira quién conduce ni qué modelo
// es (RF-032, RN-07).
//
// El coche es su rectángulo real (`length` × `width`, orientado según su rumbo); los obstáculos, círculos,
// y el límite exterior, un rectángulo del que no puede salir. Para que no se atraviese nada a ninguna
// velocidad, el movimiento de cada paso se recorre en tramos de como mucho `maxSweepStep` metros y se
// detiene en el primero que toca algo: allí se separa el coche del objeto y se responde al golpe.

/** Holgura (m) con la que queda separado un coche, para que no siga contando como contacto. */
const SKIN = 1e-6;

/** Vector que saca el coche del límite exterior, o `null` si está dentro. */
function boundsPush(x, z, sin, cos, car, bounds) {
  const extentX = (Math.abs(sin) * car.length + Math.abs(cos) * car.width) / 2;
  const extentZ = (Math.abs(cos) * car.length + Math.abs(sin) * car.width) / 2;
  const pushX = Math.max(0, bounds.minX - (x - extentX)) - Math.max(0, x + extentX - bounds.maxX);
  const pushZ = Math.max(0, bounds.minZ - (z - extentZ)) - Math.max(0, z + extentZ - bounds.maxZ);
  if (pushX === 0 && pushZ === 0) return null;
  return { x: pushX + Math.sign(pushX) * SKIN, z: pushZ + Math.sign(pushZ) * SKIN };
}

/** Vector que separa el coche de un obstáculo circular, o `null` si no se tocan. */
function obstaclePush(x, z, sin, cos, car, obstacle) {
  const halfLength = car.length / 2;
  const halfWidth = car.width / 2;
  // Centro del obstáculo en los ejes del coche: `u` hacia delante (sin, cos) y `w` hacia la derecha (-cos, sin).
  const dx = obstacle.x - x;
  const dz = obstacle.z - z;
  const u = dx * sin + dz * cos;
  const w = -dx * cos + dz * sin;
  const gapU = u - Math.max(-halfLength, Math.min(halfLength, u));
  const gapW = w - Math.max(-halfWidth, Math.min(halfWidth, w));
  const distance = Math.hypot(gapU, gapW);
  if (distance >= obstacle.radius) return null;

  let pushU;
  let pushW;
  if (distance > 0) {
    const depth = obstacle.radius - distance + SKIN;
    pushU = (-gapU / distance) * depth;
    pushW = (-gapW / distance) * depth;
  } else {
    // El centro del obstáculo está dentro del coche: se sale por el lado más corto.
    const exitU = halfLength - Math.abs(u) + obstacle.radius + SKIN;
    const exitW = halfWidth - Math.abs(w) + obstacle.radius + SKIN;
    pushU = exitU <= exitW ? -(Math.sign(u) || 1) * exitU : 0;
    pushW = exitU <= exitW ? 0 : -(Math.sign(w) || 1) * exitW;
  }
  return { x: pushU * sin - pushW * cos, z: pushU * cos + pushW * sin };
}

/**
 * Separa un coche colocado en `pose` de todo lo que toca.
 * @returns {{x: number, z: number, pushX: number, pushZ: number, touched: boolean, free: boolean}} posición
 *   separada, desplazamiento aplicado, si tocaba algo y si ha quedado libre (falso si está encajonado)
 */
function separate(pose, car, bounds, obstacles, iterations) {
  const sin = Math.sin(pose.heading);
  const cos = Math.cos(pose.heading);
  let { x, z } = pose;
  let touched = false;
  const apply = (push) => {
    if (!push) return false;
    x += push.x;
    z += push.z;
    touched = true;
    return true;
  };
  let free = false;
  // Separar de un objeto puede meterlo en otro: se repite hasta que una pasada no encuentra contactos.
  for (let i = 0; i <= iterations && !free; i++) {
    free = !apply(boundsPush(x, z, sin, cos, car, bounds));
    for (const obstacle of obstacles) {
      if (apply(obstaclePush(x, z, sin, cos, car, obstacle))) free = false;
    }
  }
  return { x, z, pushX: x - pose.x, pushZ: z - pose.z, touched, free };
}

/** Indica si el coche, en `pose`, toca el límite exterior o algún obstáculo. */
export function touchesScenery(pose, car, scenery) {
  return separate(pose, car, scenery.bounds, scenery.obstacles, 0).touched;
}

/**
 * Velocidad y rumbo tras un golpe cuya superficie empuja el coche hacia (`pushX`, `pushZ`). De frente
 * (ángulo cerrado con la perpendicular) el coche rebota y sale en sentido contrario; de refilón pierde
 * velocidad según el ángulo y su rumbo se desvía para deslizarse a lo largo del objeto.
 */
function respond(pose, speed, pushX, pushZ, params) {
  const length = Math.hypot(pushX, pushZ);
  const direction = Math.sign(speed);
  if (length === 0 || direction === 0) return { heading: pose.heading, speed };
  const normalX = pushX / length;
  const normalZ = pushZ / length;
  const travelX = Math.sin(pose.heading) * direction;
  const travelZ = Math.cos(pose.heading) * direction;
  const into = -(travelX * normalX + travelZ * normalZ); // 1: de frente; 0: paralelo
  if (into <= 0) return { heading: pose.heading, speed };
  if (into >= params.headOnCos) return { heading: pose.heading, speed: -speed * params.bounce };

  // Rumbo que dejaría la marcha paralela a la superficie; se gira hacia él como mucho `deflectionStep`.
  const alongX = (travelX + normalX * into) * direction;
  const alongZ = (travelZ + normalZ * into) * direction;
  const wanted = Math.atan2(alongX, alongZ) - pose.heading;
  const turn = Math.atan2(Math.sin(wanted), Math.cos(wanted));
  return {
    heading: pose.heading + Math.max(-params.deflectionStep, Math.min(params.deflectionStep, turn)),
    speed: speed * (1 - params.scrapeSpeedLoss * into),
  };
}

/**
 * Aplica las colisiones con el escenario al movimiento de un coche en un paso.
 * @param {{x: number, z: number, heading: number}} previous pose antes de moverse (libre de contactos)
 * @param {{x: number, z: number, heading: number, speed: number}} next estado que propone `stepCar`
 * @param {{length: number, width: number}} car dimensiones del coche (`race.car`)
 * @param {{bounds: object, obstacles: ReadonlyArray<object>}} scenery escenario (`buildScenery`)
 * @param {object} params sección `collision` de CONFIG
 * @returns {object} `next` si no toca nada; si choca, una copia con la posición, el rumbo y la velocidad
 *   que resultan del golpe
 */
export function resolveSceneryCollision(previous, next, car, scenery, params) {
  const radius = Math.hypot(car.length, car.width) / 2;
  const dx = next.x - previous.x;
  const dz = next.z - previous.z;
  const turn = next.heading - previous.heading;
  const travel = Math.hypot(dx, dz) + Math.abs(turn) * radius;
  if (travel === 0) return next; // un coche que no se ha movido no puede haber chocado

  // Descarte rápido: solo cuentan los objetos al alcance del coche en este paso.
  const reach = travel + radius + car.length;
  const { bounds } = scenery;
  const obstacles = scenery.obstacles.filter((obstacle) => {
    // Distancias al cuadrado: es lo que se ejecuta por cada obstáculo, coche y paso.
    const offsetX = obstacle.x - previous.x;
    const offsetZ = obstacle.z - previous.z;
    return offsetX * offsetX + offsetZ * offsetZ <= (reach + obstacle.radius) ** 2;
  });
  const nearBounds = previous.x - bounds.minX < reach || bounds.maxX - previous.x < reach
    || previous.z - bounds.minZ < reach || bounds.maxZ - previous.z < reach;
  if (obstacles.length === 0 && !nearBounds) return next;

  const pieces = Math.max(1, Math.ceil(travel / params.maxSweepStep));
  const poseAt = (i) => ({
    x: previous.x + (dx * i) / pieces,
    z: previous.z + (dz * i) / pieces,
    heading: previous.heading + (turn * i) / pieces,
  });
  const solve = (pose) => separate(pose, car, bounds, obstacles, params.maxPushIterations);

  for (let i = 1; i <= pieces; i++) {
    const pose = poseAt(i);
    const contact = solve(pose);
    if (!contact.touched) continue;
    const result = respond(pose, next.speed, contact.pushX, contact.pushZ, params);
    // El desvío del rumbo puede volver a meter una esquina: se separa de nuevo.
    const settled = solve({ x: contact.x, z: contact.z, heading: result.heading });
    if (settled.free) return { ...next, x: settled.x, z: settled.z, heading: result.heading, speed: result.speed };
    // Encajonado: se queda donde estaba antes de tocar.
    const last = poseAt(i - 1);
    const safe = solve(last);
    return { ...next, x: safe.x, z: safe.z, heading: last.heading, speed: result.speed };
  }
  return next;
}
