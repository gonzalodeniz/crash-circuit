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

  // Rendimiento del coche, compartido por todos los modelos y pilotos (RF-003, RN-07):
  // la dificultad nunca sale de aquí. Valores iniciales de la conducción arcade (RF-011),
  // pendientes de calibrar jugando. Unidades: metros, segundos y radianes.
  carPerformance: {
    maxSpeed: 45, // m/s hacia delante
    maxReverseSpeed: 12, // m/s marcha atrás
    acceleration: 20, // m/s² con la flecha arriba
    reverseAcceleration: 10, // m/s² en marcha atrás
    brakeDeceleration: 40, // m/s² al frenar (mayor que la inercia, para detener antes)
    coastDeceleration: 8, // m/s² sin pedal (inercia)
    steerRate: 1.9, // rad/s de giro con la dirección a fondo
    steerResponse: 6, // variación máxima de la dirección por segundo (de -1 a 1): suaviza el volante
    fullSteerSpeed: 8, // m/s a partir de los cuales el coche gira con toda su capacidad
    highSpeedSteerLoss: 0.35, // fracción de giro que se pierde a velocidad máxima (de 0 a 1)
    stopSpeedEpsilon: 0.05, // m/s por debajo de los cuales se considera que el coche está parado
    maxStep: 1 / 30, // s: paso de tiempo máximo por actualización, para evitar saltos
  },

  // Textos de la interfaz (no son «propuesta» de producto; nombres finales pendientes de calibrar).
  ui: {
    menu: {
      title: 'Crash Circuit',
      startLabel: 'Empezar',
    },
  },

  // Carrera (no son «propuesta» de producto).
  race: {
    // Contenido fijo: 10 participantes (RF-016). En E1 solo compite el jugador.
    maxParticipants: 10,
    player: { id: 'player', name: 'Jugador', isPlayer: true },
    // Dimensiones del coche en metros (el rendimiento es idéntico para todos los modelos, RN-07).
    car: { length: 4.4, width: 2 },
  },

  // Circuito de E1: nombre provisional y trazado simple a la espera de nombres y assets definitivos.
  // Los circuitos definitivos llegan en E2. Coordenadas [x, z] en metros; la meta es el primer punto
  // y el sentido de la carrera es el orden de los puntos.
  track: {
    name: 'Circuito provisional',
    width: 16,
    samplesPerSegment: 16,
    controlPoints: [
      [0, -100], [60, -100], [130, -80], [170, -20], [150, 50], [90, 80], [40, 50],
      [0, 70], [-60, 100], [-130, 70], [-150, 0], [-120, -60], [-60, -100],
    ],
  },

  // Parrilla de salida: posiciones por detrás de la meta, en filas de dos coches (RF-019).
  grid: {
    firstSlotDistance: 8, // metros desde la meta hasta la primera fila
    slotSpacing: 9, // metros entre filas
    lateralOffset: 3.5, // metros a cada lado de la línea central
  },

  // Parámetros de la escena de arranque y de la carrera (no son «propuesta» de producto).
  render: {
    backgroundColor: 0x87ceeb,
    camera: { fov: 60, near: 0.1, far: 1000, position: [0, 8, 14], lookAt: [0, 0, 0] },
    // Cámara de seguimiento (RF-009): detrás y por encima del coche, mirando hacia delante.
    chaseCamera: { distance: 9, height: 4, lookAhead: 6, lookHeight: 1 },
    ground: { size: 1200, color: 0x3a7d44 },
    road: {
      color: 0x3a3a3f,
      borderColor: 0xf2f2f2,
      borderExtra: 1, // metros de borde blanco a cada lado de la calzada
      finishLine: { depth: 2, checkerColumns: 16, checkerRows: 2 }, // metros de fondo y casillas
    },
    car: { bodyColor: 0xd62828, cabinColor: 0x222831, wheelColor: 0x111111, height: 1.1, wheelRadius: 0.4 },
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
