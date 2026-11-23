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

  // Catálogo de modelos de coche (RF-002). Los cuatro comparten el rendimiento de `carPerformance`
  // y las dimensiones de `race.car`: solo cambia el aspecto (RF-003, RN-07). Los nombres son
  // provisionales y el aspecto se genera con formas simples, a la espera de assets definitivos.
  // `appearance`: colores (hex) y proporciones de la carrocería y la cabina respecto a
  // `render.car.height` y a las dimensiones del coche; `stripe` y `spoiler` activan los adornos.
  cars: {
    defaultModelId: 'rayo', // modelo preseleccionado al abrir la selección
    models: [
      {
        id: 'rayo',
        name: 'Rayo',
        appearance: {
          bodyColor: 0xd62828, cabinColor: 0x222831, accentColor: 0xf2f2f2,
          bodyHeightRatio: 0.5, cabinWidthRatio: 0.8, cabinHeightRatio: 0.45,
          cabinLengthRatio: 0.45, cabinOffsetRatio: 0.08, stripe: false, spoiler: false,
        },
      },
      {
        id: 'bruma',
        name: 'Bruma',
        appearance: {
          bodyColor: 0x1d6fd8, cabinColor: 0x0b1b33, accentColor: 0xf2f2f2,
          bodyHeightRatio: 0.38, cabinWidthRatio: 0.7, cabinHeightRatio: 0.38,
          cabinLengthRatio: 0.55, cabinOffsetRatio: 0.02, stripe: true, spoiler: false,
        },
      },
      {
        id: 'trueno',
        name: 'Trueno',
        appearance: {
          bodyColor: 0xf6c90e, cabinColor: 0x3b2a14, accentColor: 0x222831,
          bodyHeightRatio: 0.62, cabinWidthRatio: 0.9, cabinHeightRatio: 0.55,
          cabinLengthRatio: 0.32, cabinOffsetRatio: 0.16, stripe: false, spoiler: true,
        },
      },
      {
        id: 'jade',
        name: 'Jade',
        appearance: {
          bodyColor: 0x2bb673, cabinColor: 0x10281c, accentColor: 0xff7f11,
          bodyHeightRatio: 0.44, cabinWidthRatio: 0.6, cabinHeightRatio: 0.36,
          cabinLengthRatio: 0.28, cabinOffsetRatio: -0.1, stripe: true, spoiler: true,
        },
      },
    ],
  },

  // Textos de la interfaz (no son «propuesta» de producto; nombres finales pendientes de calibrar).
  ui: {
    menu: {
      title: 'Crash Circuit',
      startLabel: 'Empezar',
    },
    // Pantalla de selección de coche (RF-002): primer paso, al que sigue el del circuito.
    selection: {
      title: 'Elige tu coche',
      confirmLabel: 'Siguiente',
      backLabel: 'Volver',
      groupLabel: 'Modelos de coche',
    },
    // Pantalla de selección de circuito y vueltas (RF-004, RF-005, RF-006): segundo paso; al confirmar
    // empieza la carrera.
    trackSelection: {
      title: 'Elige tu circuito',
      confirmLabel: 'Confirmar',
      backLabel: 'Volver',
      groupLabel: 'Circuitos',
      difficultyLabel: 'Dificultad',
      lengthLabel: 'Longitud',
      lengthUnit: 'm',
      curvesLabel: 'Curvas',
      lapsTitle: 'Vueltas',
      lapsGroupLabel: 'Número de vueltas',
      difficultyLabels: { veryEasy: 'Muy fácil', easy: 'Fácil', medium: 'Medio', hard: 'Difícil' },
    },
    // Pantalla de resultados al terminar la carrera (RF-056).
    results: {
      title: 'Carrera terminada',
      timeLabel: 'Tu tiempo',
      repeatLabel: 'Repetir',
      menuLabel: 'Menú',
    },
    // Señal de salida que sustituye al número al terminar la cuenta atrás.
    hud: {
      goLabel: '¡YA!',
      lapLabel: 'Vuelta', // contador «Vuelta X/Y» (RF-044)
    },
  },

  // Carrera (no son «propuesta» de producto).
  race: {
    // Contenido fijo: 10 participantes (RF-016). En E1 solo compite el jugador.
    maxParticipants: 10,
    player: { id: 'player', name: 'Jugador', isPlayer: true },
    // Dimensiones del coche en metros (el rendimiento es idéntico para todos los modelos, RN-07).
    car: { length: 4.4, width: 2 },
    // Vueltas de la carrera (RF-006): exactamente estas cuatro opciones, contenido fijo. La elegida
    // se aplica como `totalLaps`. La preseleccionada es la de E1, para no alargar el camino a la carrera.
    lapOptions: [1, 3, 5, 10],
    defaultLaps: 1,
    // Cuenta atrás de salida «3, 2, 1» (RF-020). Duraciones iniciales, pendientes de calibrar jugando.
    countdown: {
      steps: 3, // números de la cuenta (3, 2, 1)
      stepDuration: 1, // s que dura cada número
      goDisplayDuration: 1, // s que se muestra la señal de salida tras la cuenta
    },
  },

  // Catálogo de circuitos (RF-004, RF-005, RF-014): exactamente cuatro, uno por dificultad. La
  // dificultad sale del trazado (longitud, número de curvas y anchura) y nunca de las estadísticas del
  // coche (RN-07). Los nombres son provisionales, a la espera de los definitivos (E8).
  // Coordenadas [x, z] en metros; la meta es el primer punto y el sentido de la carrera es el orden
  // de los puntos. Cada trazado debe tener una recta antes de la meta para alojar la parrilla.
  tracks: {
    defaultId: 'ribera', // circuito preseleccionado al abrir la selección (el de E1)
    // Valores comunes a todos los circuitos: se combinan con cada entrada de `circuits`.
    common: {
      samplesPerSegment: 16,
      // Los checkpoints invisibles intermedios (RF-022) se reparten a igual distancia a lo largo de
      // la vuelta; la meta es el punto de inicio. Cada uno es una puerta que cruza toda la calzada.
      checkpointMargin: 6, // metros que la puerta sobresale a cada lado de la calzada
    },
    // Qué cuenta como «curva» en los datos básicos de la selección (RF-004): tramo seguido de la línea
    // central que gira hacia el mismo lado con un radio de, como mucho, `1 / minTurnRate` metros y que
    // acumula al menos `minAngle` radianes.
    curveDetection: { minTurnRate: 0.01, minAngle: 0.6 },
    // `difficulty` es el identificador de la etiqueta (`ui.trackSelection.difficultyLabels`).
    circuits: [
      {
        id: 'llanura',
        name: 'Llanura',
        difficulty: 'veryEasy',
        width: 20,
        checkpointCount: 6,
        controlPoints: [
          [0, -70], [60, -70], [110, -50], [130, 0], [110, 50], [60, 70],
          [0, 70], [-60, 70], [-110, 50], [-130, 0], [-110, -50], [-60, -70],
        ],
      },
      {
        // Circuito de E1, conservado.
        id: 'ribera',
        name: 'Ribera',
        difficulty: 'easy',
        width: 16,
        checkpointCount: 8,
        controlPoints: [
          [0, -100], [60, -100], [130, -80], [170, -20], [150, 50], [90, 80], [40, 50],
          [0, 70], [-60, 100], [-130, 70], [-150, 0], [-120, -60], [-60, -100],
        ],
      },
      {
        id: 'sierra',
        name: 'Sierra',
        difficulty: 'medium',
        width: 14,
        checkpointCount: 10,
        controlPoints: [
          [0, -120], [80, -120], [160, -110], [210, -70], [220, -10], [190, 40], [130, 60],
          [90, 100], [100, 150], [60, 190], [-10, 190], [-60, 150], [-50, 100], [-90, 60],
          [-150, 70], [-200, 30], [-210, -30], [-180, -80], [-120, -100], [-60, -120],
        ],
      },
      {
        id: 'abismo',
        name: 'Abismo',
        difficulty: 'hard',
        width: 12,
        checkpointCount: 14,
        controlPoints: [
          [0, -150], [90, -150], [140, -180], [190, -130], [250, -110], [270, -50], [230, 0],
          [160, 10], [120, 50], [150, 100], [230, 120], [270, 170], [240, 230], [170, 250],
          [100, 230], [60, 180], [0, 200], [-60, 250], [-110, 215], [-170, 250], [-230, 215],
          [-220, 150], [-180, 110], [-120, 70], [-170, 30], [-240, 20], [-280, -30], [-260, -90],
          [-200, -130], [-120, -150], [-60, -150],
        ],
      },
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
    // Alturas (metros sobre el plano y = 0) de las capas del suelo, de menor a mayor. La
    // separación entre ellas evita que parpadeen al solaparse (z-fighting).
    layers: { ground: -0.1, border: 0, road: 0.05, finishLine: 0.1 },
    road: {
      color: 0x3a3a3f,
      borderColor: 0xf2f2f2,
      borderExtra: 1, // metros de borde blanco a cada lado de la calzada
      finishLine: {
        depth: 2, // metros de fondo
        checkerColumns: 16, // casillas a lo ancho
        checkerRows: 2, // casillas a lo largo
        lightShade: 255, // tono de las casillas claras (0-255)
        darkShade: 20, // tono de las casillas oscuras (0-255)
      },
    },
    car: {
      wheelColor: 0x111111,
      height: 1.1, // metros: altura total de referencia (carrocería + cabina)
      wheelRadius: 0.4, // metros
      wheelWidth: 0.4, // metros: grosor de cada rueda
      wheelSegments: 16, // lados del cilindro de cada rueda
      wheelInset: 0.9, // metros: separación de cada eje respecto a la punta del coche
      // Franja decorativa sobre la carrocería (`appearance.stripe`).
      stripe: { widthRatio: 0.2, thickness: 0.03 }, // proporción del ancho del coche; metros
      // Alerón trasero (`appearance.spoiler`): ala sobre un soporte central.
      spoiler: { widthRatio: 0.95, depth: 0.7, thickness: 0.1, lift: 0.45, postWidth: 0.15 }, // metros salvo la proporción
    },
    // Vista previa del coche en la selección (RF-002): plataforma giratoria y cámara fija.
    carPreview: {
      cameraPosition: [0, 2.6, 8],
      cameraTarget: [0, 0.6, 0],
      spinSpeed: 0.8, // rad/s
      platformRadius: 3.4, // metros
      platformHeight: 0.1, // metros
      platformSegments: 48, // lados del cilindro de la plataforma
      platformColor: 0x55555c,
    },
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
