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
vite.config.js      Configuración de Vite (raíz del servidor = src/) y plugin de la CSP del build
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
- `src/logic/gameState.js`: estados del juego (`MENU`, `SELECCION`, `PARRILLA`, `CUENTA_ATRAS`, `EN_CARRERA`, `PAUSA`, `RESULTADOS`) y transiciones permitidas. Las transiciones actuales son una primera propuesta basada en RF-008 y RF-026 y las issues siguientes pueden ampliarlas. En E1 `MENU` pasa directo a `PARRILLA` (`startRace()`), porque aún no hay selección; la transición `MENU -> SELECCION` queda definida para E2. `finishRace()` (`EN_CARRERA -> RESULTADOS`), `repeatRace()` (`RESULTADOS -> PARRILLA`) y `backToMenu()` (`RESULTADOS -> MENU`) cubren el final de la carrera. `onChange(listener)` avisa de cada cambio de estado, para que `RaceSession` cree y descarte la carrera y `main.js` cree y libere la escena.
- `src/ui/mainMenu.js`: menú principal en DOM (RF-001). Solo dibuja y avisa mediante una función de retorno; no importa la lógica ni Three.js. Sus textos salen de `CONFIG.ui.menu`.
- `src/logic/track.js`: el trazado como dato puro. `buildTrack()` muestrea una curva cerrada (Catmull-Rom) a partir de los puntos de control de `CONFIG.track` y devuelve la línea central (polígono cerrado: el último punto enlaza con el primero), la anchura, la longitud, la meta (punto 0, con el rumbo del sentido de la carrera) y las distancias acumuladas. Define también los checkpoints invisibles (`track.checkpoints`, `CONFIG.track.checkpointCount` puertas a igual distancia, con su posición, rumbo y semianchura) y la puerta de la meta (`track.finish`); `crossesGateForward(gate, from, to)` indica si un desplazamiento cruza una puerta hacia delante. Ofrece `wrapDistance(track, d)` (normaliza una distancia a `[0, length)`) y `signedDistance(track, d)` (la equivalente en `(-length/2, length/2]`, negativa si queda detrás de la meta), que son la única definición de esas operaciones y las reutiliza `progress.js`; además `pointAtDistance`, `nearestOnCenterline`, `isOnRoad` y `gridSlot` (posición de parrilla por detrás de la meta). Convención: plano XZ y `heading` tal que el avance es `(sin h, cos h)`, igual que `rotation.y` de Three.js.
- `src/logic/progress.js`: progreso de un participante (RF-022, RF-023, RN-01). `createProgress(track, pose)` y `stepProgress(state, track, pose)` (devuelve estado nuevo) llevan `laps`, `checkpointIndex`, `lapDistance` y `progress` (vueltas × longitud + distancia válida, en metros, comparable entre participantes y nunca decreciente). Una vuelta solo se suma al cruzar la meta hacia delante con todos los checkpoints cruzados en orden; los cruces hacia atrás o fuera de orden se ignoran. La distancia válida no pasa del siguiente checkpoint pendiente, así que recortar o retroceder no da progreso. Antes de cruzar la meta por primera vez (parrilla) el progreso es negativo. `lapCounterText` da el texto «Vuelta X/Y» del HUD, que no pasa del total.
- `src/logic/race.js`: `createRace(CONFIG, entries)` crea el trazado, `totalLaps` (de `CONFIG.race.laps`), el reloj de carrera y la lista de participantes (solo el jugador en E1, hasta 10 desde E3), cada uno con su pose en la parrilla, su `progress` y `status`, un valor de `ParticipantStatus` (enumeración propia de `race.js`, separada de `GameState`: `PARRILLA` hasta la salida y `EN_CARRERA` después; `DESTRUIDO` se añadirá en E5). `stepRace(race, inputs, dt, CONFIG)` avanza la simulación en el sitio: limita `dt` a `maxStep`, avanza el reloj y, en el paso de la señal de salida, pasa a todos los participantes a `EN_CARRERA` a la vez (devuelve `{started: true}` solo entonces). Tras mover cada coche actualiza su `progress` con el desplazamiento real. Al llegar `progress.laps` a `totalLaps` el participante termina (RF-025): `finished = true`, `finishTime` = cronómetro de ese paso, y devuelve su id en `{finished: [...]}`. Desde ese momento ni sus entradas ni su progreso actúan (las vueltas no pasan del total; el coche rueda por inercia), mientras el reloj de la carrera sigue. `raceTimeOf(race, participant)` da su tiempo final o, si no ha terminado, el cronómetro. Solo mueve los coches de participantes en `ParticipantStatus.EN_CARRERA`, así que durante la cuenta atrás las entradas no producen movimiento.
- `src/logic/raceClock.js`: cuenta atrás y cronómetro (RF-020, RF-021, RF-045). `createRaceClock()` empieza en fase `COUNTDOWN`; `stepRaceClock(clock, dt, countdown)` devuelve el reloj nuevo sin mutar el anterior y pasa a `RUNNING` cuando se agota la cuenta (el sobrante del paso cuenta ya como tiempo de carrera; antes de la salida `raceTime` vale cero). `countdownSignal` devuelve 3, 2, 1, `GO_SIGNAL` o `null`, y `formatRaceTime` da `mm:ss.cc`. Solo avanza con el tiempo simulado, sin relojes del navegador: la pausa (E7) la congelará dejando de llamarla. Duraciones en `CONFIG.race.countdown`.
- `src/ui/resultsScreen.js`: pantalla de resultados en DOM (RF-056 parcial): título, tiempo final recibido ya formateado y dos botones («Repetir» y «Menú»), activables con ratón y teclado. Solo avisa mediante funciones de retorno; textos en `CONFIG.ui.results`.
- `src/ui/raceHud.js`: HUD en DOM con la señal de la cuenta atrás, el cronómetro y el contador de vueltas; solo pinta los textos que recibe.
- `src/logic/chaseCamera.js`: `computeChaseCamera()` calcula posición y punto de mira de la cámara trasera; el renderizado solo los aplica.
- `src/render/sceneRenderer.js`: crea el `WebGLRenderer`, la escena, las luces y la cámara y adapta el lienzo a la ventana. `buildRace(race)` dibuja suelo, calzada con borde, línea de meta a cuadros y un coche por participante; `disposeRace()` libera geometrías, materiales y texturas de la carrera y la quita de la escena; `dispose()` libera además el contexto WebGL (RNF-04). Los coches usan geometrías simples (assets definitivos pendientes).
- `src/logic/driving.js`: modelo de conducción arcade (RF-010, RF-011). `stepCar(state, input, dt, params)` devuelve el nuevo estado (`x`, `z`, `heading`, `speed`, `steer` y los indicadores de la marcha atrás) sin mutar el anterior; limita `dt` a `maxStep`. Acelerar, frenar e inercia (desaceleración sin pedal) cambian la velocidad con límites; el freno nunca pasa a marcha atrás en el mismo pulso: solo se activa si el freno se pulsa con el coche parado. La dirección se suaviza y el giro depende de la velocidad (parado no gira; en marcha atrás se invierte). `inputFromKeys` traduce teclas a entradas con `CONFIG.controls`. Los parámetros salen de `CONFIG.carPerformance`, compartido por todos los modelos y pilotos.
- `src/ui/keyboardInput.js`: guarda las teclas de conducción pulsadas y llama a `preventDefault` solo mientras está activa (durante la carrera), para que las flechas no desplacen la página (RF-010). Se vacía al perder el foco.
- `src/logic/raceSession.js`: `RaceSession(stateMachine, CONFIG)` orquesta el flujo de la partida sin DOM ni Three.js (RNF-05). Escucha `GameStateMachine.onChange`: crea la carrera al entrar en `PARRILLA` (también al repetir, RF-057) y la descarta al entrar en `MENU` o `SELECCION`. `step(dt, inputs)` pasa de `PARRILLA` a `CUENTA_ATRAS` (`beginCountdown`), avanza la carrera con `stepRace`, pasa a `EN_CARRERA` con la señal de salida (`startGo`) y abre `RESULTADOS` (`finishRace`) una sola vez cuando termina el jugador. No avanza nada sin carrera ni fuera de `CUENTA_ATRAS`, `EN_CARRERA` y `RESULTADOS` (en `RESULTADOS` el coche sigue rodando por inercia; `PAUSA` congelará la simulación en E7). Devuelve `{started, finished, playerFinished}`. Se crea antes que otros oyentes de la máquina de estados, porque se avisan en orden de registro y los demás leen `session.race`.
- `src/main.js`: único punto donde se juntan lógica y renderizado. No decide estados ni cuándo se crea o descarta la carrera: eso es de `RaceSession`. Contiene el bucle `requestAnimationFrame`, que calcula el paso de tiempo, traduce las teclas a entradas, llama a `session.step`, actualiza el HUD y orienta la cámara con la pose del jugador. Escucha `GameStateMachine.onChange` solo para la interfaz: al entrar en `PARRILLA` muestra el HUD, activa las flechas y construye la escena con `session.race` (que libera antes la anterior); en `RESULTADOS` desactiva las flechas, oculta el HUD y muestra la pantalla de resultados; en `MENU` o `SELECCION` libera la escena y, en `MENU`, muestra el menú. Las acciones de la interfaz («Empezar», «Repetir», «Menú») se traducen en métodos de la máquina de estados.

Regla de dependencias (RNF-05): `logic/` (todos sus ficheros) no importa `three`, el DOM ni `render/`. `render/` y `ui/` pueden leer datos de `logic/`, pero no deciden nada de la competición; `main.js` traduce las acciones de la interfaz en llamadas a la máquina de estados, y `logic/raceSession.js` decide el resto del flujo de la partida. `tests/logicIsolation.test.js` lo comprueba para todos los `*.js` de `src/logic/` (los lee de la carpeta, así que un fichero nuevo queda cubierto sin tocar la prueba): falla ante cualquier import de `three` (con o sin `from`, también `three/addons/...`), de `../render/` o de `../ui/`, ante `document`, `window`, `requestAnimationFrame`, `Date.now`, `performance.now`, `setTimeout` y `setInterval`.

## Seguridad: Content Security Policy

`vite.config.js` define `CONTENT_SECURITY_POLICY` y un plugin en línea (`apply: 'build'`) que, al ejecutar `npm run build`, inserta en el `<head>` de `dist/index.html` una etiqueta `<meta http-equiv="Content-Security-Policy">`. La política (`default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`) solo admite recursos del propio origen y hace que el navegador bloquee cualquier conexión de red, lo que refuerza RF-060, RNF-06 y RNF-07 (sin backend ni telemetría). Se aplica solo al build porque `npm run dev` necesita un WebSocket para la recarga en caliente y scripts en línea que la política bloquearía. Consecuencias para el código de `src/`: nada de scripts, estilos ni manejadores en línea en `index.html`, ni `eval`; los estilos van en `styles.css`. La etiqueta se inserta como texto para que las comillas simples queden literales. Si un cambio futuro necesita otro origen o directiva (p. ej. cargar un modelo desde una URL), se amplía la política en ese plugin y se documenta aquí. No sustituye a las cabeceras HTTP del servidor que aloje `dist/`, que quedan fuera del repositorio.

## Configuración

Todo valor configurable, y en especial los «propuesta» de la sección 4 de `02_REQUISITOS_FUNCIONALES.md`, está en `src/config/config.js`, que exporta el objeto `CONFIG`, congelado en profundidad (`Object.freeze` recursivo). Para añadir un parámetro: se añade a ese objeto, agrupado por tema, con un comentario que indique si es «propuesta»; los demás módulos lo leen importando `CONFIG`. Nunca se escribe un valor «propuesta» en otro fichero. Los módulos de `render/` reciben la sección que necesitan por parámetro, de modo que se pueden probar con valores propios.

## Pruebas

- Comando: `npm test` (`node --test "tests/**/*.test.js"`). No usa navegador.
- Se prueba automáticamente toda la lógica de `src/logic/` y `src/config/`: estados, progreso, vueltas, clasificación, puntuación, temporizadores y estimaciones, a medida que existan.
- El renderizado (`src/render/`), la sensación de conducción y el HUD se comprueban jugando (ver «Verificación manual» del perfil).
- `tests/raceSession.test.js` prueba el flujo de la partida con la máquina de estados real (crear, repetir, descartar, salida, resultados una sola vez, sin avance fuera de los estados simulados) y que `main.js` no contiene esa lógica.
- Una sola prueba (`tests/logicIsolation.test.js`) comprueba que ningún fichero de `src/logic/` depende de Three.js, del DOM, de `render/`, de `ui/` ni de relojes del navegador, y otra verifica que su patrón detecta cada forma prohibida.
- `tests/contentSecurityPolicy.test.js` comprueba las directivas de la CSP, que el plugin la inserta solo en el build y que `index.html` no tiene scripts ni estilos en línea.

## Decisiones descartadas

- **Sin empaquetador, con import map y `http-server`/`serve`:** también es estático, pero obliga a servir `node_modules/` y no produce una carpeta de distribución. Vite cubre ambos usos con una sola dependencia.
- **Servidor propio en Node sin dependencias:** menos dependencias, pero habría que mantener código ajeno al juego, que además no encaja en `src/` ni en la raíz.
- **Three.js desde CDN:** incumple el espíritu de RNF-06 (sin servicio remoto).
- **Jest o Vitest:** el ejecutor integrado de Node es suficiente y no añade dependencias.
- **TypeScript:** añade una fase de compilación sin que los requisitos lo pidan.
