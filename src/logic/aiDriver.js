// Piloto IA (RF-028, RF-029, RF-031). Lógica pura, sin Three.js ni DOM (RNF-05).
//
// Cada piloto sigue una trayectoria predefinida de su circuito: la línea central con un desplazamiento
// lateral aleatorio y acotado, y un perfil de velocidades que respeta las curvas y las frenadas. En cada
// paso produce solo las cuatro entradas de conducción del jugador (acelerar, frenar, izquierda, derecha);
// el coche se mueve con `stepCar` y `carPerformance`, igual que el del jugador (RF-003, RN-07). La
// exigencia (ritmo en curva, velocidad objetivo) sale del nivel del circuito, `CONFIG.ai.levels`.
import { pointAtDistance, rightOf, wrapDistance } from './track.js';

/** Ángulo normalizado a (-PI, PI]. */
function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Nivel de exigencia de un circuito (RF-031): el de su etiqueta de dificultad.
 * @param {object} aiConfig sección `ai` de CONFIG
 * @param {string} difficulty etiqueta de dificultad del circuito (`veryEasy`, `easy`, `medium`, `hard`)
 */
export function aiLevel(aiConfig, difficulty) {
  const level = aiConfig.levels[difficulty];
  if (!level) throw new Error(`Sin nivel de IA para la dificultad: ${difficulty}`);
  return level;
}

/**
 * Velocidad máxima con la que se recorre una curva de radio `radius` usando la fracción `cornerGrip` del
 * giro del coche. Despeja `v` de `v / radius = steerRate * cornerGrip * (1 - highSpeedSteerLoss * v / maxSpeed)`,
 * que es el giro máximo de `stepCar` a velocidad `v`.
 */
function cornerSpeed(radius, cornerGrip, performance) {
  const turnRate = performance.steerRate * cornerGrip;
  return (radius * turnRate) / (1 + (radius * turnRate * performance.highSpeedSteerLoss) / performance.maxSpeed);
}

/**
 * Construye la trayectoria de un piloto: puntos de ruta equiespaciados a lo largo de todo el circuito
 * cerrado, cada uno con su posición y la velocidad objetivo.
 * @param {object} track trazado (`buildTrack`)
 * @param {object} aiConfig sección `ai` de CONFIG
 * @param {object} level nivel de exigencia (`aiLevel`)
 * @param {object} performance sección `carPerformance` de CONFIG
 * @param {{width: number}} car dimensiones del coche (`race.car`)
 * @param {() => number} random fuente de aleatoriedad en [0, 1) (RF-029)
 */
export function createRacingLine(track, aiConfig, level, performance, car, random) {
  const count = Math.max(8, Math.round(track.length / aiConfig.waypointSpacing));
  const spacing = track.length / count;

  // Desplazamiento lateral: valores aleatorios acotados cada `variationWavelength` metros, unidos con una
  // curva suave y cíclica (sin salto al pasar por la meta). Nunca supera el margen libre de la calzada.
  const freeHalfWidth = Math.max(0, track.width / 2 - car.width / 2 - aiConfig.edgeMargin);
  const amplitude = level.lateralVariation * freeHalfWidth;
  const nodeCount = Math.max(3, Math.round(track.length / aiConfig.variationWavelength));
  const nodes = Array.from({ length: nodeCount }, () => (random() * 2 - 1) * amplitude);
  const offsets = [];
  const x = [];
  const z = [];
  for (let i = 0; i < count; i++) {
    const u = (i / count) * nodeCount;
    const node = Math.floor(u);
    const blend = (1 - Math.cos(Math.PI * (u - node))) / 2;
    const offset = nodes[node] * (1 - blend) + nodes[(node + 1) % nodeCount] * blend;
    const center = pointAtDistance(track, i * spacing);
    const right = rightOf(center.heading);
    offsets.push(offset);
    x.push(center.x + right.x * offset);
    z.push(center.z + right.z * offset);
  }

  // Curvatura en cada punto (cambio de rumbo por metro), tomando la más cerrada de los vecinos.
  const turn = [];
  for (let i = 0; i < count; i++) {
    const before = (i - 1 + count) % count;
    const after = (i + 1) % count;
    const headingIn = Math.atan2(x[i] - x[before], z[i] - z[before]);
    const headingOut = Math.atan2(x[after] - x[i], z[after] - z[i]);
    turn.push(Math.abs(wrapAngle(headingOut - headingIn)) / spacing);
  }

  // Velocidad objetivo: la de la curva (con el giro que el nivel se permite) con tope en la recta.
  const topSpeed = performance.maxSpeed * level.topSpeedFraction;
  const speed = [];
  for (let i = 0; i < count; i++) {
    let curvature = 0;
    for (let k = -aiConfig.curvatureReach; k <= aiConfig.curvatureReach; k++) {
      curvature = Math.max(curvature, turn[(i + k + count) % count]);
    }
    const radius = curvature > 1e-6 ? 1 / curvature : Infinity;
    const limit = Number.isFinite(radius) ? cornerSpeed(radius, level.cornerGrip, performance) : topSpeed;
    speed.push(Math.max(aiConfig.minTargetSpeed, Math.min(topSpeed, limit)));
  }
  // Frenada: antes de cada curva la velocidad baja a lo que permite la frenada del nivel. Dos vueltas
  // al circuito bastan para que el límite llegue desde la curva hasta las rectas anteriores.
  const braking = performance.brakeDeceleration * level.brakeFraction;
  for (let i = 2 * count - 1; i >= 0; i--) {
    const index = i % count;
    const next = (index + 1) % count;
    speed[index] = Math.min(speed[index], Math.sqrt(speed[next] * speed[next] + 2 * braking * spacing));
  }

  return { count, spacing, length: track.length, x, z, speed, offsets };
}

/**
 * Crea el piloto IA de un participante: su trayectoria y su ritmo de esta carrera. El ritmo es un
 * factor de 1 - `paceSpread` a 1 que reduce, al azar, la velocidad objetivo: es una decisión de
 * conducción, no una ventaja ni una pérdida del coche (RN-07).
 * @returns {{line: ReturnType<typeof createRacingLine>, pace: number}}
 */
export function createAiDriver(track, aiConfig, level, performance, car, random) {
  const line = createRacingLine(track, aiConfig, level, performance, car, random);
  return { line, pace: 1 - level.paceSpread * random() };
}

// Interpola un valor de la trayectoria entre dos puntos de ruta consecutivos (cíclica).
function sampleLine(line, values, distance) {
  const u = wrapDistance(line, distance) / line.spacing;
  const first = Math.floor(u) % line.count;
  const t = u - Math.floor(u);
  return values[first] + (values[(first + 1) % line.count] - values[first]) * t;
}

/**
 * Entradas de conducción del piloto en este instante: las mismas cuatro que produce el teclado del jugador.
 * @param {ReturnType<typeof createAiDriver>} driver
 * @param {{x: number, z: number, heading: number, speed: number, progress: {lapPosition: number}}} participant
 *   coche y progreso del participante (la posición en el trazado es la que ya calcula `progress.js`)
 * @param {object} aiConfig sección `ai` de CONFIG
 * @returns {{accelerate: boolean, brake: boolean, left: boolean, right: boolean}}
 */
export function aiInput(driver, participant, aiConfig) {
  const { line } = driver;
  const position = wrapDistance(line, participant.progress.lapPosition);

  // Dirección: apunta al punto de la trayectoria que tiene por delante.
  const ahead = position + aiConfig.lookahead.base + aiConfig.lookahead.perSpeed * Math.max(0, participant.speed);
  const targetX = sampleLine(line, line.x, ahead);
  const targetZ = sampleLine(line, line.z, ahead);
  const wanted = Math.atan2(targetX - participant.x, targetZ - participant.z);
  const error = wrapAngle(wanted - participant.heading);

  // Velocidad: acelera hasta la objetivo y frena si se pasa. Nunca frena casi parado (eso daría marcha
  // atrás): la velocidad objetivo mínima lo impide.
  const target = sampleLine(line, line.speed, position) * driver.pace;
  const wantedSpeed = Math.max(aiConfig.minTargetSpeed, target);
  return {
    accelerate: participant.speed < wantedSpeed,
    brake: participant.speed > wantedSpeed + aiConfig.speedTolerance,
    left: error > aiConfig.steerDeadZone,
    right: error < -aiConfig.steerDeadZone,
  };
}
