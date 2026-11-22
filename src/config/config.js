// Módulo ÚNICO de configuración del juego.
// Todos los valores marcados como «propuesta» en la sección 4 de
// docs/product/02_REQUISITOS_FUNCIONALES.md viven aquí y nunca fijos en el resto del código.
// Para añadir un parámetro: agrégalo a este objeto (se congela en profundidad al cargarse)
// y léelo desde el resto de módulos importando `CONFIG`.

function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

export const CONFIG = deepFreeze({
  // Controles (propuesta: convención por validar con prueba de juego).
  controls: {
    steerLeft: 'ArrowLeft',
    steerRight: 'ArrowRight',
    accelerate: 'ArrowUp',
    brakeReverse: 'ArrowDown',
    // Propuesta: pausa con Esc o P.
    pause: ['Escape', 'KeyP'],
  },

  // Puntuación (RN-06). Propuestas iniciales, pendientes de calibrar.
  scoring: {
    // Puntos por llegada: índice 0 = 1.º puesto ... índice 9 = 10.º.
    positionPoints: [100, 80, 65, 55, 45, 35, 25, 15, 10, 5],
    overtakeBonus: 5,
    fastLapBonus: 10,
    accidentPenalty: 10,
  },

  // Rendimiento: objetivo, no garantía (RNF-03).
  performance: {
    targetFps: 60,
  },

  // Parámetros de la escena de arranque (no son «propuesta» de producto).
  render: {
    backgroundColor: 0x87ceeb,
    camera: { fov: 60, near: 0.1, far: 1000, position: [0, 8, 14], lookAt: [0, 0, 0] },
    ground: { size: 40, color: 0x3a7d44 },
    light: {
      sunColor: 0xffffff,
      sunIntensity: 2.5,
      sunPosition: [10, 20, 10],
      ambientColor: 0xffffff,
      ambientIntensity: 0.6,
    },
    maxPixelRatio: 2,
  },
});
