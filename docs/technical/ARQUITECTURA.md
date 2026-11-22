# ARQUITECTURA.md

Decisiones técnicas de Crash Circuit. Lo actualiza `developer-teams` en la misma PR que cambie alguna de ellas.

## Stack

| Herramienta | Versión | Motivo |
|---|---|---|
| HTML5, CSS3, JavaScript (módulos ES) | — | Lo exige RNF-02. Sin TypeScript ni frameworks, para mantener el mínimo de dependencias. |
| Three.js (`three`) | ^0.170 | Escena 3D (RNF-02). Se instala como dependencia local de npm: el juego no carga nada de servidores remotos (RNF-06). |
| Vite (`vite`, solo desarrollo) | ^6 | Servidor local de ficheros estáticos con recarga y empaquetado a `dist/` (ficheros estáticos puros). Resuelve `import ... from 'three'` sin configuración. Es la única herramienta de desarrollo. |
| `node:test` + `node:assert` (integrados en Node) | Node >= 20 (probado con 22) | Pruebas automáticas de la lógica sin navegador y sin dependencias adicionales. |

## Estructura de carpetas

```
package.json        Dependencias y scripts npm (exigido por npm)
vite.config.js      Configuración de Vite (raíz del servidor = src/)
src/                Código del juego
  index.html        Página de arranque con el <canvas>
  styles.css        Estilos (lienzo a pantalla completa)
  main.js           Punto de entrada: conecta lógica y renderizado
  config/           Módulo único de configuración
  logic/            Lógica del juego y de la competición (sin Three.js ni DOM)
  render/           Renderizado con Three.js
  ui/               Interfaz DOM y entrada de teclado (menús y, más adelante, HUD)
tests/              Pruebas automáticas (*.test.js), ejecutables sin navegador
dist/               Resultado de `npm run build` (no se versiona)
```

En la raíz solo van `package.json`, `package-lock.json` y `vite.config.js`, que las herramientas exigen.

## Módulos y responsabilidades

- `src/config/config.js`: único origen de los valores configurables.
- `src/logic/gameState.js`: estados del juego (`MENU`, `SELECCION`, `PARRILLA`, `CUENTA_ATRAS`, `EN_CARRERA`, `PAUSA`, `RESULTADOS`) y transiciones permitidas. Las transiciones actuales son una primera propuesta basada en RF-008 y RF-026 y las issues siguientes pueden ampliarlas. En E1 `MENU` pasa directo a `PARRILLA` (`startRace()`), porque aún no hay selección; la transición `MENU -> SELECCION` queda definida para E2. `onChange(listener)` avisa de cada cambio de estado, para que `main.js` cree y libere la escena de la carrera.
- `src/ui/mainMenu.js`: menú principal en DOM (RF-001). Solo dibuja y avisa mediante una función de retorno; no importa la lógica ni Three.js. Sus textos salen de `CONFIG.ui.menu`.
- `src/logic/track.js`: el trazado como dato puro. `buildTrack()` muestrea una curva cerrada (Catmull-Rom) a partir de los puntos de control de `CONFIG.track` y devuelve la línea central (polígono cerrado: el último punto enlaza con el primero), la anchura, la longitud, la meta (punto 0, con el rumbo del sentido de la carrera) y las distancias acumuladas. Ofrece `pointAtDistance`, `nearestOnCenterline`, `isOnRoad` y `gridSlot` (posición de parrilla por detrás de la meta). Convención: plano XZ y `heading` tal que el avance es `(sin h, cos h)`, igual que `rotation.y` de Three.js.
- `src/logic/race.js`: `createRace(CONFIG, entries)` crea el trazado, el reloj de carrera y la lista de participantes (solo el jugador en E1, hasta 10 desde E3), cada uno con su pose en la parrilla y `status` (`PARRILLA` hasta la salida). `stepRace(race, inputs, dt, CONFIG)` avanza la simulación en el sitio: limita `dt` a `maxStep`, avanza el reloj y, en el paso de la señal de salida, pasa a todos los participantes a `EN_CARRERA` a la vez (devuelve `{started: true}` solo entonces). Solo mueve los coches de participantes en `EN_CARRERA`, así que durante la cuenta atrás las entradas no producen movimiento.
- `src/logic/raceClock.js`: cuenta atrás y cronómetro (RF-020, RF-021, RF-045). `createRaceClock()` empieza en fase `COUNTDOWN`; `stepRaceClock(clock, dt, countdown)` devuelve el reloj nuevo sin mutar el anterior y pasa a `RUNNING` cuando se agota la cuenta (el sobrante del paso cuenta ya como tiempo de carrera; antes de la salida `raceTime` vale cero). `countdownSignal` devuelve 3, 2, 1, `GO_SIGNAL` o `null`, y `formatRaceTime` da `mm:ss.cc`. Solo avanza con el tiempo simulado, sin relojes del navegador: la pausa (E7) la congelará dejando de llamarla. Duraciones en `CONFIG.race.countdown`.
- `src/ui/raceHud.js`: HUD en DOM con la señal de la cuenta atrás y el cronómetro; solo pinta los textos que recibe.
- `src/logic/chaseCamera.js`: `computeChaseCamera()` calcula posición y punto de mira de la cámara trasera; el renderizado solo los aplica.
- `src/render/sceneRenderer.js`: crea el `WebGLRenderer`, la escena, las luces y la cámara y adapta el lienzo a la ventana. `buildRace(race)` dibuja suelo, calzada con borde, línea de meta a cuadros y un coche por participante; `disposeRace()` libera geometrías, materiales y texturas de la carrera y la quita de la escena; `dispose()` libera además el contexto WebGL (RNF-04). Los coches usan geometrías simples (assets definitivos pendientes).
- `src/logic/driving.js`: modelo de conducción arcade (RF-010, RF-011). `stepCar(state, input, dt, params)` devuelve el nuevo estado (`x`, `z`, `heading`, `speed`, `steer` y los indicadores de la marcha atrás) sin mutar el anterior; limita `dt` a `maxStep`. Acelerar, frenar e inercia (desaceleración sin pedal) cambian la velocidad con límites; el freno nunca pasa a marcha atrás en el mismo pulso: solo se activa si el freno se pulsa con el coche parado. La dirección se suaviza y el giro depende de la velocidad (parado no gira; en marcha atrás se invierte). `inputFromKeys` traduce teclas a entradas con `CONFIG.controls`. Los parámetros salen de `CONFIG.carPerformance`, compartido por todos los modelos y pilotos.
- `src/ui/keyboardInput.js`: guarda las teclas de conducción pulsadas y llama a `preventDefault` solo mientras está activa (durante la carrera), para que las flechas no desplacen la página (RF-010). Se vacía al perder el foco.
- `src/main.js`: único punto donde se juntan lógica y renderizado; contiene el bucle `requestAnimationFrame`, que calcula el paso de tiempo, avanza la carrera con `stepRace`, actualiza el HUD y orienta la cámara con su pose. Escucha `GameStateMachine.onChange`: al entrar en `PARRILLA` crea la carrera y su escena y pasa a `CUENTA_ATRAS`; cuando `stepRace` da la señal de salida pasa a `EN_CARRERA`; al volver a `MENU` o `SELECCION` la libera.

Regla de dependencias (RNF-05): `logic/` (todos sus ficheros) no importa `three`, el DOM ni `render/`. `render/` y `ui/` pueden leer datos de `logic/`, pero no deciden nada de la competición; `main.js` es quien traduce las acciones de la interfaz en transiciones de la máquina de estados. Las pruebas comprueban que `logic/gameState.js`, `track.js`, `race.js`, `raceClock.js`, `chaseCamera.js` y `driving.js` no mencionan Three.js ni el DOM.

## Configuración

Todo valor configurable, y en especial los «propuesta» de la sección 4 de `02_REQUISITOS_FUNCIONALES.md`, está en `src/config/config.js`, que exporta el objeto `CONFIG`, congelado en profundidad (`Object.freeze` recursivo). Para añadir un parámetro: se añade a ese objeto, agrupado por tema, con un comentario que indique si es «propuesta»; los demás módulos lo leen importando `CONFIG`. Nunca se escribe un valor «propuesta» en otro fichero. Los módulos de `render/` reciben la sección que necesitan por parámetro, de modo que se pueden probar con valores propios.

## Pruebas

- Comando: `npm test` (`node --test "tests/**/*.test.js"`). No usa navegador.
- Se prueba automáticamente toda la lógica de `src/logic/` y `src/config/`: estados, progreso, vueltas, clasificación, puntuación, temporizadores y estimaciones, a medida que existan.
- El renderizado (`src/render/`), la sensación de conducción y el HUD se comprueban jugando (ver «Verificación manual» del perfil).
- Una prueba comprueba que la lógica no importa Three.js ni el DOM.

## Decisiones descartadas

- **Sin empaquetador, con import map y `http-server`/`serve`:** también es estático, pero obliga a servir `node_modules/` y no produce una carpeta de distribución. Vite cubre ambos usos con una sola dependencia.
- **Servidor propio en Node sin dependencias:** menos dependencias, pero habría que mantener código ajeno al juego, que además no encaja en `src/` ni en la raíz.
- **Three.js desde CDN:** incumple el espíritu de RNF-06 (sin servicio remoto).
- **Jest o Vitest:** el ejecutor integrado de Node es suficiente y no añade dependencias.
- **TypeScript:** añade una fase de compilación sin que los requisitos lo pidan.
