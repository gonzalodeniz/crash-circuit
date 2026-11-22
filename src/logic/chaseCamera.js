// Cámara de seguimiento (RF-009): calcula su posición y punto de mira a partir de la pose del coche.
// Lógica pura: no usa Three.js, así que se puede probar sin navegador.
import { forwardOf } from './track.js';

/**
 * @param {{x: number, z: number, heading: number}} pose pose del coche
 * @param {object} followConfig sección `render.chaseCamera` de CONFIG
 * @returns {{position: number[], target: number[]}} coordenadas [x, y, z]
 */
export function computeChaseCamera(pose, followConfig) {
  const forward = forwardOf(pose.heading);
  return {
    position: [
      pose.x - forward.x * followConfig.distance,
      followConfig.height,
      pose.z - forward.z * followConfig.distance,
    ],
    target: [
      pose.x + forward.x * followConfig.lookAhead,
      followConfig.lookHeight,
      pose.z + forward.z * followConfig.lookAhead,
    ],
  };
}
