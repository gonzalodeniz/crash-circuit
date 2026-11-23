// Catálogo de circuitos (RF-004, RF-005, RF-014). Lógica pura: no importa Three.js ni el DOM (RNF-05).
// Los circuitos solo difieren en el trazado: la dificultad nunca sale del coche (RN-07).
import { buildTrack } from './track.js';

/** Circuitos del catálogo, en el orden en que se muestran, con los valores comunes ya aplicados. */
export function trackDefinitions(config) {
  return config.tracks.circuits.map((circuit) => ({ ...config.tracks.common, ...circuit }));
}

/** Definición del circuito con ese identificador, o `undefined` si no existe. */
export function findTrackDefinition(config, id) {
  return trackDefinitions(config).find((definition) => definition.id === id);
}

/** Definición del circuito con ese identificador; lanza un error si no existe. */
export function requireTrackDefinition(config, id) {
  const definition = findTrackDefinition(config, id);
  if (!definition) throw new Error(`Circuito desconocido: ${id}`);
  return definition;
}

/**
 * Número de curvas del trazado: tramos seguidos de la línea central que giran hacia el mismo lado con
 * una curvatura de al menos `minTurnRate` rad/m y que acumulan al menos `minAngle` rad. Un tramo
 * que gira hacia el lado contrario empieza otra curva (una chicane son dos curvas).
 * @param {ReturnType<typeof buildTrack>} track
 * @param {{minTurnRate: number, minAngle: number}} detection sección `tracks.curveDetection` de CONFIG
 */
export function countCurves(track, detection) {
  const count = track.points.length;
  let curves = 0;
  let turned = 0; // giro acumulado de la curva en curso (con signo)
  const close = () => {
    if (Math.abs(turned) >= detection.minAngle) curves++;
    turned = 0;
  };
  // Se empieza en la meta, que está en una recta; si un trazado cruzara la meta girando, una curva
  // podría contarse en dos mitades (los circuitos del catálogo lo evitan y las pruebas lo vigilan).
  for (let i = 0; i < count; i++) {
    const before = track.headings[(i - 1 + count) % count];
    const turn = Math.atan2(Math.sin(track.headings[i] - before), Math.cos(track.headings[i] - before));
    const next = track.points[(i + 1) % count];
    const rate = Math.abs(turn) / Math.hypot(next.x - track.points[i].x, next.z - track.points[i].z);
    if (rate < detection.minTurnRate) {
      close();
    } else {
      if (turned !== 0 && Math.sign(turn) !== Math.sign(turned)) close();
      turned += turn;
    }
  }
  close();
  return curves;
}

/**
 * Datos básicos de un circuito para mostrarlos en la selección (RF-004): nombre, dificultad, anchura,
 * longitud en metros y número de curvas. Construye el trazado para medirlo.
 */
export function trackSummary(config, id) {
  const definition = requireTrackDefinition(config, id);
  const track = buildTrack(definition);
  return {
    id: definition.id,
    name: definition.name,
    difficulty: definition.difficulty,
    width: definition.width,
    length: track.length,
    curves: countCurves(track, config.tracks.curveDetection),
  };
}

/** Datos básicos de los cuatro circuitos, en el orden del catálogo. */
export function trackSummaries(config) {
  return config.tracks.circuits.map((circuit) => trackSummary(config, circuit.id));
}
