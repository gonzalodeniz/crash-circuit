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

  // Circular fuera de la calzada (RF-013): vale igual para los diez coches y para cualquier modelo (RN-07).
  // Reduce la velocidad y no suma progreso. Valores iniciales (propuestas), pendientes de calibrar jugando.
  offRoad: {
    margin: 0, // metros que el centro del coche puede rebasar el borde de la calzada sin penalización
    maxSpeedFactor: 0.4, // fracción de la velocidad máxima (hacia delante y marcha atrás) alcanzable fuera
    accelerationFactor: 0.5, // fracción de la aceleración (hacia delante y marcha atrás) disponible fuera
    deceleration: 25, // m/s²: ritmo mínimo al que pierde velocidad quien va por encima del máximo de fuera
    // Metros de trazado que se reconocen de golpe al volver a la calzada (RN-01): perdona pisar fuera un
    // momento. Con un salto mayor, el progreso no avanza hasta regresar o cruzar el checkpoint pendiente.
    // Debe superar de sobra lo que avanza un coche en un paso (`maxSpeed * maxStep`, 1,5 m).
    maxRejoinAdvance: 10,
  },

  // Golpes contra los límites y obstáculos del escenario (RF-015, RF-033): valen igual para los diez
  // coches. Valores iniciales (propuestas), pendientes de calibrar jugando.
  collision: {
    headOnCos: 0.8, // coseno del ángulo con la perpendicular desde el que el golpe es de frente (unos 37 grados)
    bounce: 0.25, // fracción de la velocidad con la que se sale rebotado tras un golpe de frente
    scrapeSpeedLoss: 0.25, // fracción de velocidad que quita un golpe de refilón, ponderada por su ángulo
    deflectionStep: 0.2, // rad que como mucho se desvía el rumbo en cada contacto de refilón
    // Precisión de la detección: el movimiento de un paso se comprueba en tramos de como mucho estos
    // metros (menos que la anchura de un coche), así nada se atraviesa a ninguna velocidad.
    maxSweepStep: 0.5,
    maxPushIterations: 4, // pasadas para separar un coche que toca varios objetos a la vez
  },

  // Contacto entre coches (RF-033): los diez son sólidos entre sí y reaccionan igual, con cualquier modelo
  // (RN-07). El tamaño con el que chocan es el rectángulo de `race.car`. Valores iniciales (propuestas),
  // pendientes de calibrar jugando.
  carContact: {
    // Rebote: con 0 salen a la misma velocidad y con 1 la intercambian por completo. Es también la fracción
    // de velocidad que conserva un coche encajonado que no puede avanzar.
    restitution: 0.3,
    speedLoss: 0.2, // fracción de velocidad que además pierden los dos, ponderada por la violencia del golpe
    spinFactor: 0.01, // rad que gira un coche por cada m/s de golpe y metro de descentrado
    maxSpin: 0.12, // rad: giro máximo que provoca un contacto
    slideDeceleration: 20, // m/s²: ritmo al que se apaga el deslizamiento lateral de un golpe
    maxSlideSpeed: 12, // m/s: deslizamiento lateral máximo
    maxSweepStep: 0.5, // m: precisión de la detección (menos que medio coche), para que no se atraviesen
    maxPushIterations: 4, // pasadas para separar varios coches amontonados
  },

  // Intensidad de los golpes (RF-034) contra coches, límites y obstáculos: valen igual para los diez coches.
  // La intensidad es la velocidad de impacto: la de acercamiento en la dirección del choque. Valores
  // iniciales (propuestas), pendientes de calibrar jugando.
  impact: {
    // Umbral de colisión (propuesta): desde esta velocidad de impacto el golpe es fuerte y destruye el coche
    // (RF-035, RF-036).
    strongSpeed: 20, // m/s
    minSpeed: 2, // m/s: por debajo es un simple contacto (coches apoyados en el pelotón), sin daño
    // Consecuencias de cada clase de golpe. `damage` es el daño visual que suma (de 0 a 1) sin pasar de
    // `maxDamage`, y `effectDuration`, los segundos que dura la reacción (chispas, humo). La pérdida de
    // velocidad de un golpe leve es la de `collision` y `carContact`; el fuerte destruye el coche, que se
    // queda parado donde ha chocado (véase `destruction`).
    light: { damage: 0.1, maxDamage: 0.3, effectDuration: 0.25 },
    strong: { damage: 0.7, maxDamage: 1, effectDuration: 0.9 },
  },

  // Coche destruido (RF-038, RN-04): vale igual para los diez.
  destruction: {
    lockDuration: 3, // s de tiempo activo de simulación sin poder conducirlo
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
    // se pasa al resumen.
    trackSelection: {
      title: 'Elige tu circuito',
      confirmLabel: 'Siguiente',
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
    // Resumen de la selección (RF-007): tercer paso; al confirmar empieza la carrera. La dificultad se
    // muestra con las etiquetas de `trackSelection.difficultyLabels`.
    summary: {
      title: 'Tu carrera',
      carLabel: 'Coche',
      trackLabel: 'Circuito',
      difficultyLabel: 'Dificultad',
      lapsLabel: 'Vueltas',
      confirmLabel: '¡A correr!',
      backLabel: 'Volver',
    },
    // Pantalla de resultados al terminar la carrera (RF-056).
    // En E3 solo aparecen quienes llegaron antes que el jugador, con su tiempo real; los que siguen en
    // pista y sus estimaciones llegan con E7 (RF-054, RN-05). `{position}`, `{total}` se sustituyen.
    results: {
      title: 'Carrera terminada',
      timeLabel: 'Tu tiempo',
      repeatLabel: 'Repetir',
      menuLabel: 'Menú',
      playerWinsMessage: '¡Has ganado la carrera!', // aviso destacado si gana el jugador (RF-024)
      winnerLabel: 'Ganador',
      positionLabel: 'Tu puesto',
      positionFormat: '{position} de {total}',
      arrivalsTitle: 'Llegaron antes que tú',
    },
    // Señal de salida que sustituye al número al terminar la cuenta atrás.
    hud: {
      goLabel: '¡YA!',
      lapLabel: 'Vuelta', // contador «Vuelta X/Y» (RF-044)
    },
  },

  // Carrera (no son «propuesta» de producto).
  race: {
    // Contenido fijo: 10 participantes (RF-016): el jugador y nueve pilotos IA.
    maxParticipants: 10,
    player: { id: 'player', name: 'Jugador', isPlayer: true },
    // Los nueve pilotos IA, con identidad fija entre carreras (RF-017). Cada uno conduce un modelo del
    // catálogo `cars.models` (RF-018); el reparto es fijo para que sea el mismo en cada carrera y con
    // cualquier coche del jugador. Los nombres son provisionales, a la espera de los definitivos (E8).
    aiDrivers: [
      { id: 'ai-1', name: 'Marcos Vela', carModelId: 'bruma' },
      { id: 'ai-2', name: 'Lucía Ferrer', carModelId: 'trueno' },
      { id: 'ai-3', name: 'Iker Salas', carModelId: 'jade' },
      { id: 'ai-4', name: 'Nuria Costa', carModelId: 'rayo' },
      { id: 'ai-5', name: 'Dani Roca', carModelId: 'trueno' },
      { id: 'ai-6', name: 'Alma Reyes', carModelId: 'bruma' },
      { id: 'ai-7', name: 'Hugo Brandt', carModelId: 'rayo' },
      { id: 'ai-8', name: 'Sofía Nieto', carModelId: 'jade' },
      { id: 'ai-9', name: 'Bruno Lazo', carModelId: 'trueno' },
    ],
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
      // Límite exterior (RF-015): un muro rectangular que rodea el circuito, a estos metros del borde de la
      // calzada en sus puntos extremos.
      limitMargin: 35,
      // Obstáculos (RF-015): cada tipo es un círculo sólido de este radio en metros. Su aspecto está en
      // `render.obstacles`.
      obstacleTypes: { tyres: { radius: 0.9 }, rock: { radius: 1.6 } },
      // Metros libres que, como mínimo, deja cualquier obstáculo hasta el borde de la calzada (las pruebas lo
      // comprueban en los cuatro circuitos).
      minObstacleGap: 4,
    },
    // Qué cuenta como «curva» en los datos básicos de la selección (RF-004): tramo seguido de la línea
    // central que gira hacia el mismo lado con un radio de, como mucho, `1 / minTurnRate` metros y que
    // acumula al menos `minAngle` radianes.
    curveDetection: { minTurnRate: 0.01, minAngle: 0.6 },
    // `difficulty` es el identificador de la etiqueta (`ui.trackSelection.difficultyLabels`).
    // `obstacles` (véase `logic/scenery.js`): `type` (`obstacleTypes`), `at` (fracción de la vuelta desde
    // la meta), `side` (1 a la derecha del sentido de la carrera, -1 a la izquierda), `gap` (metros libres
    // hasta el borde de la calzada) y `count` (elementos seguidos que forman una barrera; 1 por defecto).
    // Se sitúan donde una salida de pista es probable, sobre todo en el exterior de las curvas.
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
        obstacles: [
          { type: 'tyres', at: 0.22, side: -1, gap: 8, count: 10 },
          { type: 'rock', at: 0.4, side: -1, gap: 6 },
          { type: 'rock', at: 0.52, side: 1, gap: 7 },
          { type: 'tyres', at: 0.72, side: -1, gap: 8, count: 10 },
          { type: 'rock', at: 0.94, side: -1, gap: 7 },
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
        obstacles: [
          { type: 'rock', at: 0.14, side: 1, gap: 6 },
          { type: 'tyres', at: 0.23, side: -1, gap: 7, count: 8 },
          { type: 'tyres', at: 0.39, side: -1, gap: 6, count: 8 },
          { type: 'tyres', at: 0.46, side: 1, gap: 6, count: 8 },
          { type: 'rock', at: 0.54, side: -1, gap: 6 },
          { type: 'tyres', at: 0.68, side: -1, gap: 6, count: 8 },
          { type: 'rock', at: 0.82, side: 1, gap: 6 },
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
        obstacles: [
          { type: 'rock', at: 0.08, side: -1, gap: 6 },
          { type: 'tyres', at: 0.17, side: -1, gap: 6, count: 8 },
          { type: 'tyres', at: 0.25, side: -1, gap: 6, count: 10 },
          { type: 'tyres', at: 0.36, side: 1, gap: 5, count: 8 },
          { type: 'tyres', at: 0.43, side: -1, gap: 6, count: 10 },
          { type: 'rock', at: 0.52, side: 1, gap: 5 },
          { type: 'tyres', at: 0.56, side: -1, gap: 5, count: 8 },
          { type: 'tyres', at: 0.63, side: 1, gap: 5, count: 10 },
          { type: 'rock', at: 0.75, side: -1, gap: 5 },
          { type: 'tyres', at: 0.82, side: -1, gap: 5, count: 10 },
          { type: 'rock', at: 0.94, side: 1, gap: 6 },
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
        obstacles: [
          { type: 'rock', at: 0.04, side: 1, gap: 5 },
          { type: 'tyres', at: 0.07, side: -1, gap: 5, count: 6 },
          { type: 'rock', at: 0.105, side: 1, gap: 4.5 },
          { type: 'tyres', at: 0.16, side: -1, gap: 4.5, count: 10 },
          { type: 'tyres', at: 0.26, side: 1, gap: 4.5, count: 10 },
          { type: 'rock', at: 0.31, side: -1, gap: 4.5 },
          { type: 'tyres', at: 0.35, side: -1, gap: 4.5, count: 8 },
          { type: 'rock', at: 0.43, side: 1, gap: 4.5 },
          { type: 'tyres', at: 0.485, side: 1, gap: 4.5, count: 6 },
          { type: 'tyres', at: 0.55, side: -1, gap: 4.5, count: 6 },
          { type: 'rock', at: 0.585, side: 1, gap: 4.5 },
          { type: 'tyres', at: 0.645, side: -1, gap: 4.5, count: 8 },
          { type: 'rock', at: 0.7, side: 1, gap: 4.5 },
          { type: 'tyres', at: 0.745, side: 1, gap: 4.5, count: 6 },
          { type: 'tyres', at: 0.825, side: -1, gap: 4.5, count: 10 },
          { type: 'rock', at: 0.9, side: 1, gap: 4.5 },
          { type: 'rock', at: 0.97, side: -1, gap: 5 },
        ],
      },
    ],
  },

  // Parrilla de salida: posiciones por detrás de la meta, en filas de dos coches (RF-019).
  grid: {
    // Hueco del jugador en la parrilla (0 = pole, 9 = último). Propuesta: sale el último, para tener
    // rivales que adelantar desde el principio. Los pilotos IA ocupan los demás huecos, en el orden de
    // `race.aiDrivers`.
    playerSlotIndex: 9,
    firstSlotDistance: 8, // metros desde la meta hasta la primera fila
    slotSpacing: 9, // metros entre filas
    lateralOffset: 3.5, // metros a cada lado de la línea central
  },

  // Pilotos IA (RF-028, RF-029, RF-031). Conducen con las mismas entradas que el jugador (acelerar,
  // frenar, izquierda, derecha) y el mismo `carPerformance`: aquí solo se decide con qué exigencia
  // conducen, nunca cuánto rinde el coche (RN-07). Todos los valores son propuestas iniciales,
  // pendientes de calibrar jugando (el equilibrio fino llega en E8).
  ai: {
    // Trayectoria predefinida: la línea central de cada circuito con un desplazamiento lateral
    // aleatorio y acotado (RF-029), muestreada en puntos de ruta.
    waypointSpacing: 6, // metros entre puntos de ruta
    variationWavelength: 90, // metros entre dos valores aleatorios del desplazamiento lateral
    edgeMargin: 1.5, // metros que la trayectoria deja libres entre el lado del coche y el borde de la calzada
    curvatureReach: 2, // puntos de ruta a cada lado que se miran para estimar la curva (se toma la más cerrada)
    // Seguimiento de la trayectoria: el punto al que apunta el piloto está a `base + perSpeed * velocidad`
    // metros por delante.
    lookahead: { base: 6, perSpeed: 0.35 },
    steerDeadZone: 0.04, // rad de error de rumbo por debajo de los cuales no gira
    speedTolerance: 1.5, // m/s por encima de la velocidad objetivo antes de frenar
    minTargetSpeed: 9, // m/s: velocidad objetivo mínima (el coche gira bien a partir de `fullSteerSpeed`)
    // Margen de comprobación de las pruebas: metros que el centro de un rival puede rebasar el borde de
    // la calzada sin que se considere una salida de pista (RF-029).
    offRoadTolerance: 1,
    // Un rival que se queda parado contra un obstáculo o un límite da marcha atrás, avanza un trecho en
    // paralelo a la pista para rebasarlo y sigue, con las mismas entradas que el jugador.
    recovery: {
      stuckSpeed: 2, // m/s: por debajo se considera que no avanza
      stuckAfter: 0.8, // s seguidos sin avanzar antes de dar marcha atrás
      reverseDuration: 1.2, // s que mantiene el freno para ir marcha atrás
      detourDuration: 3, // s que después avanza en paralelo a la pista antes de volver a su trayectoria
      detourAngle: 0.7, // rad que se inclina ese avance, a un lado y a otro, si en paralelo no ha salido
      alignedError: 0.3, // rad: si ya está casi paralelo a la pista, retrocede girando a un lado alterno
    },
    // Un nivel por dificultad del circuito (`tracks.circuits[].difficulty`), de menor a mayor exigencia:
    // - cornerGrip: fracción del giro máximo del coche que usa en las curvas (marca la velocidad en curva).
    // - topSpeedFraction: fracción de la velocidad máxima que se permite en las rectas.
    // - brakeFraction: fracción de la frenada máxima que usa al llegar a una curva.
    // - lateralVariation: amplitud máxima del desplazamiento lateral, como fracción del margen libre de la calzada.
    // - paceSpread: cuánto puede reducir cada piloto, al azar, su ritmo de esa carrera (fracción de 0 a 1).
    levels: {
      veryEasy: { cornerGrip: 0.45, topSpeedFraction: 0.55, brakeFraction: 0.5, lateralVariation: 0.8, paceSpread: 0.08 },
      easy: { cornerGrip: 0.55, topSpeedFraction: 0.68, brakeFraction: 0.6, lateralVariation: 0.75, paceSpread: 0.07 },
      medium: { cornerGrip: 0.65, topSpeedFraction: 0.8, brakeFraction: 0.7, lateralVariation: 0.7, paceSpread: 0.06 },
      hard: { cornerGrip: 0.75, topSpeedFraction: 0.92, brakeFraction: 0.8, lateralVariation: 0.6, paceSpread: 0.05 },
    },
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
    // Aspecto de los obstáculos por tipo (su radio es `tracks.common.obstacleTypes`) y del límite exterior.
    obstacles: {
      // Pila de neumáticos: `layers` discos con una junta entre ellos y colores alternos por pila.
      tyres: { colors: [0x1b1b1b, 0xc62828], height: 1.4, layers: 3, layerGapRatio: 0.15, segments: 16 },
      rock: { color: 0x8d8a84, heightRatio: 0.8 }, // alto respecto al radio
    },
    limits: { color: 0xb8b8bd, height: 1.8, thickness: 1 }, // muro exterior (metros)
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
    // Aspecto del daño (RF-034). La carrocería se oscurece hacia `sootColor` según el nivel de daño (hasta la
    // fracción `maxDarkening`). Las marcas `light` aparecen con cualquier golpe y las `strong`, con uno
    // fuerte; en cada una, `at` es [x en anchos, y en alturas de carrocería desde su base, z en largos],
    // `size` son metros [ancho, alto, fondo] y `turn` su giro en rad respecto a la vertical.
    damage: {
      sootColor: 0x151515,
      maxDarkening: 0.65,
      markColor: 0x0d0d0d,
      marks: {
        light: [
          { at: [0.18, 0.55, -0.505], size: [0.55, 0.07, 0.04], turn: 0 },
          { at: [-0.51, 0.65, -0.05], size: [0.04, 0.07, 0.9], turn: 0 },
          { at: [0.51, 0.5, 0.08], size: [0.04, 0.07, 0.9], turn: 0 },
          { at: [-0.2, 1.04, 0.32], size: [0.07, 0.04, 0.8], turn: 0.5 },
        ],
        strong: [
          { at: [-0.22, 1.05, -0.38], size: [0.8, 0.07, 0.8], turn: 0.4 },
          { at: [0.24, 1.05, 0.34], size: [0.75, 0.07, 0.9], turn: -0.6 },
          { at: [-0.52, 0.6, 0.18], size: [0.08, 0.35, 1.1], turn: 0.08 },
          { at: [0.52, 0.5, -0.2], size: [0.08, 0.35, 1.1], turn: -0.08 },
          { at: [0.08, 0.2, -0.54], size: [1.9, 0.2, 0.2], turn: 0.22 }, // parachoques suelto
        ],
      },
      // Chispas de la reacción: cuántas, su tamaño (m) y hasta dónde se alejan del coche (m) según el golpe.
      sparks: {
        color: 0xffd23f,
        rise: 1.4, // m: altura que alcanzan
        light: { count: 6, size: 0.12, spread: 0.7 },
        strong: { count: 20, size: 0.26, spread: 2.6 },
      },
      // Bocanadas de humo de un golpe fuerte: crecen y suben mientras dura la reacción.
      smoke: { color: 0x4a4a4a, opacity: 0.55, count: 4, radius: 0.45, rise: 2.4, growth: 1.6 },
      // Coche destruido: aplastado a esta fracción de su altura y con la carrocería casi negra (fracción de
      // 0 a 1 hacia `sootColor`), para distinguirlo a simple vista de los dañados.
      wreck: { heightScale: 0.5, darkening: 0.95 },
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
