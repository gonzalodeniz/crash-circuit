# INDEX.md

Índice de todos los ficheros del proyecto, para que los agentes los localicen rápidamente. Actualízalo cuando se cree, mueva o elimine un fichero.

## Raíz

- `CLAUDE.md`: punto de entrada de los agentes (kit). Importa el perfil del proyecto y el flujo de trabajo. Solo se modifica con autorización del usuario.
- `COMMANDS.md`: comandos útiles para los agentes (build, lint, test, ejecución local). Solo comandos verificados.
- `INDEX.md`: este índice.
- `README.md`: descripción del juego y cómo arrancarlo. Lo mantiene `doc-teams`.
- `CHANGELOG.md`: resumen de cada issue terminada, agrupado por entrega. Lo mantiene `doc-teams`.
- `.gitignore`: ficheros excluidos de git (`.env`, copias de seguridad `*.bak.*`, `logs/`, `node_modules/`, `dist/` y la caché de Python `__pycache__/` que genera el hook).
- `package.json` y `package-lock.json`: dependencias (`three`, `vite`) y scripts npm (`dev`, `build`, `preview`, `test`).
- `vite.config.js`: configuración de Vite (raíz `src/`, salida `dist/`, puertos locales) y plugin que inserta la Content Security Policy en el build.

## `src/` (código del juego)

- `src/index.html`: página de arranque con el lienzo `#game-canvas`.
- `src/styles.css`: estilos; el lienzo ocupa toda la ventana.
- `src/main.js`: punto de entrada; traduce eventos del DOM y dibuja, sin decidir el flujo de la partida (de eso se encarga `raceSession.js`); arranca el bucle.
- `src/config/config.js`: módulo único de configuración (valores «propuesta» incluidos, también los de la IA de los rivales, los de los choques, los del contacto entre coches y los de la intensidad de los golpes y el daño).
- `src/logic/gameState.js`: estados del juego y máquina de estados, con el flujo `MENU -> SELECCION -> PARRILLA` (sin Three.js ni DOM).
- `src/logic/trackCatalog.js`: consulta del catálogo de circuitos de la configuración (`trackDefinitions`, `findTrackDefinition`, `requireTrackDefinition`) y datos básicos para la selección (`trackSummary`, `trackSummaries`, `countCurves`) (sin Three.js ni DOM).
- `src/logic/carModels.js`: consulta del catálogo de modelos de coche de la configuración (`carModels`, `findCarModel`, `requireCarModel`) (sin Three.js ni DOM).
- `src/logic/track.js`: trazado del circuito como dato (línea central cerrada, anchura, meta, checkpoints, parrilla) y funciones geométricas (sin Three.js ni DOM).
- `src/logic/lapOptions.js`: opciones de vueltas de la carrera (`lapOptions`, `requireLapOption`): solo 1, 3, 5 o 10, tomadas de la configuración (sin Three.js ni DOM).
- `src/logic/raceSetup.js`: configuración confirmada de la carrera (`createRaceSetup`, `defaultRaceSetup`, `createRaceFromSetup`, `raceSetupSummary`): valida coche, circuito y vueltas y es la única fuente de la que se crea la carrera (sin Three.js ni DOM).
- `src/logic/startingGrid.js`: los diez participantes de la parrilla en orden de salida (`createGridEntries`, `aiDrivers`): el jugador en el hueco de la configuración y los nueve pilotos IA con nombre y modelo fijos (sin Three.js ni DOM).
- `src/logic/random.js`: fuente de aleatoriedad inyectable con semilla (`createSeededRandom`) para que las carreras con rivales sean reproducibles en las pruebas (sin Three.js ni DOM).
- `src/logic/aiDriver.js`: pilotos IA (`createRacingLine`, `createAiDriver`, `aiInput`, `aiLevel`): trayectoria predefinida de cada circuito con variaciones aleatorias acotadas, perfil de velocidades por nivel de dificultad, maniobra para salir de un atasco contra un objeto (`aiDrive`, `createAiRecovery`) y las cuatro entradas del jugador como única salida (sin Three.js ni DOM).
- `src/logic/race.js`: crea la carrera (en el circuito y con las vueltas elegidos) con su lista de participantes colocados en la parrilla y el piloto IA de cada rival (`drivers`), define `ParticipantStatus` (estado de cada participante, distinto de `GameState`), `stepRace` (secuencia de pasos privados: reloj y salida, cada participante, ganador y clasificación; avanza reloj y coches, con las entradas de la IA para los rivales, marca la llegada al completar las vueltas y registra el ganador en `race.winner`) y `raceTimeOf` (sin Three.js ni DOM).
- `src/logic/standings.js`: clasificación en vivo de los diez participantes (`compareParticipants`, `rankParticipants`, `standingsOf`, `positionOf`): llegados por instante de llegada y por delante de los demás, el resto por progreso válido, desempate por hueco de parrilla (sin Three.js ni DOM).
- `src/logic/raceResults.js`: resultados para el jugador (`buildRaceResults`, `resultsTexts`): ganador, puesto del jugador sobre diez, su tiempo y los participantes que llegaron antes con su tiempo real, y los textos de la pantalla desde `CONFIG.ui.results` (sin Three.js ni DOM).
- `src/logic/raceSession.js`: flujo de la partida (`RaceSession`): guarda el coche, el circuito y las vueltas elegidos, los pasos de la selección (coche, circuito y resumen; `confirmSelection`, `backSelection`) y la configuración confirmada, crea y descarta la carrera según el estado, avanza con `step` y aplica `beginCountdown`, `startGo` y `finishRace` (sin Three.js ni DOM).
- `src/logic/raceClock.js`: cuenta atrás «3, 2, 1», señal de salida y cronómetro de carrera, avanzados con el paso de tiempo simulado (sin Three.js ni DOM).
- `src/logic/scenery.js`: límite exterior y obstáculos sólidos de cada circuito (`buildScenery`): rectángulo que rodea el trazado y círculos colocados fuera de la calzada según la definición del circuito (sin Three.js ni DOM).
- `src/logic/collisions.js`: colisiones de un coche con el límite y los obstáculos (`resolveSceneryCollision`, `touchesScenery`): detección continua y respuesta al golpe (rebote o desvío con pérdida de velocidad) (sin Three.js ni DOM).
- `src/logic/carContacts.js`: contacto entre coches (`resolveCarContacts`, `applySlide`, `carsOverlap`): detección continua, separación sin solapes y respuesta al golpe (intercambio de velocidad, deslizamiento y cambio de rumbo) (sin Three.js ni DOM).
- `src/logic/impact.js`: intensidad de los golpes y daño de un coche (`ImpactSeverity`, `classifyImpact`, `applyImpact`, `createDamage`, `stepDamage`): leve o fuerte según la velocidad de impacto, pérdida de velocidad del golpe fuerte y estado del daño visual (sin Three.js ni DOM).
- `src/logic/progress.js`: progreso de carrera de un participante (RN-01): vueltas válidas, checkpoints en orden, distancia válida y contador «Vuelta X/Y» (sin Three.js ni DOM).
- `src/logic/chaseCamera.js`: posición y punto de mira de la cámara de seguimiento a partir de la pose del coche (sin Three.js ni DOM).
- `src/logic/driving.js`: modelo de conducción arcade (`createCarState`, `stepCar`, `inputFromKeys`); recibe entradas y un paso de tiempo (sin Three.js ni DOM).
- `src/ui/keyboardInput.js`: captura de las flechas (DOM); evita las acciones del navegador mientras dura la carrera.
- `src/ui/raceHud.js`: HUD de la carrera (DOM); muestra la señal de la cuenta atrás, el cronómetro y la vuelta actual.
- `src/ui/resultsScreen.js`: pantalla de resultados (DOM); muestra «Carrera terminada» con el ganador, el puesto y el tiempo del jugador, los que llegaron antes que él y las opciones «Repetir» y «Menú».
- `src/ui/optionSelectionScreen.js`: pantalla genérica de selección (DOM); muestra opciones (ratón y flechas) en uno o dos grupos, marca la elegida, ignora la repetición de Intro y avisa con funciones de retorno.
- `src/ui/carSelectionScreen.js`: primer paso de la selección (DOM); los cuatro modelos de coche como opciones, con su muestra de colores.
- `src/ui/trackSelectionScreen.js`: segundo paso de la selección (DOM); los cuatro circuitos como opciones, con su dificultad, longitud y número de curvas, y debajo las opciones de vueltas (1, 3, 5, 10).
- `src/ui/summaryScreen.js`: tercer paso de la selección (DOM); muestra el resumen de coche, circuito, dificultad y vueltas con «Volver» y «¡A correr!».
- `src/ui/mainMenu.js`: menú principal (DOM); muestra el título y la opción «Empezar» y avisa con una función de retorno.
- `src/render/sceneRenderer.js`: escena y cámara de Three.js (recibe el renderizador y la ventana desde `main.js`, así se prueba sin WebGL); dibuja el circuito, la meta, el muro exterior, los obstáculos y los coches de la carrera, muestra la vista previa giratoria del coche en la selección y libera sus recursos.
- `src/render/carMesh.js`: construye la malla de un coche a partir del aspecto de su modelo y devuelve los recursos que hay que liberar (no necesita WebGL).
- `src/render/damageVisuals.js`: daño visual de un coche (marcas, carrocería ennegrecida, chispas y humo) a partir del daño que decide la lógica (no necesita WebGL).

## `tests/` (pruebas automáticas, sin navegador)

- `tests/helpers/autopilot.js`: piloto automático compartido de las pruebas (`autopilot`, `CORNERING_AUTOPILOT`): sigue la línea central con dos variantes, sin freno o con frenada en curva. No es una prueba (no termina en `.test.js`).
- `tests/config.test.js`: pruebas del módulo de configuración.
- `tests/track.test.js`: pruebas del trazado cerrado, la normalización de distancias (`wrapDistance`, `signedDistance`), la meta las posiciones de parrilla (los huecos no se solapan, comprobado con rectángulos de coche) y la búsqueda del punto más cercano con pista.
- `tests/carModels.test.js`: pruebas del catálogo (cuatro modelos únicos, sin rendimiento propio), de que la carrera guarda el modelo, de la misma trayectoria con los cuatro modelos (RF-003) y de la elección en la sesión (repetir la conserva).
- `tests/trackCatalog.test.js`: pruebas de los cuatro circuitos (trazado cerrado, parrilla, checkpoints, una vuelta válida, checkpoint omitido, longitudes, curvas y dificultades distintas).
- `tests/trackSelection.test.js`: pruebas de los pasos de la selección (coche y circuito), de que la carrera usa el circuito elegido y de que los 16 pares coche-circuito llegan a los resultados.
- `tests/lapSelection.test.js`: pruebas de las opciones de vueltas (solo 1/3/5/10), de la elección en la sesión (repetir la conserva) y de que con cada valor la carrera termina justo en la última vuelta, con el contador del HUD sin pasar del total y el tiempo congelado.
- `tests/raceSetup.test.js`: pruebas de la configuración confirmada (incompleta o fuera del catálogo no se confirma, la carrera usa esos valores, resumen, volver atrás, repetir, menú) y de la matriz de las 64 combinaciones hasta `RESULTADOS` (CA-10 parcial).
- `tests/startingGrid.test.js`: pruebas de la parrilla de diez: participantes únicos, nombres fijos de los rivales, modelos del catálogo, mismo rendimiento, hueco del jugador desde la configuración, huellas de los coches en los cuatro circuitos, salida simultánea y parrilla nueva al repetir.
- `tests/aiDriver.test.js`: pruebas de los rivales: cuatro niveles de IA ordenados, vuelta válida de los nueve en los cuatro circuitos, salida de calzada acotada, reproducibilidad con semilla, mismas entradas y rendimiento que el jugador, progreso con la misma lógica y niveles más rápidos con la dificultad.
- `tests/standings.test.js`: pruebas de la clasificación: orden por progreso, adelantamiento (intercambio de progreso y adelantar o ser adelantado en pista), checkpoint omitido y marcha atrás sin mejorar posición, llegados por delante y por instante de llegada, desempate estable y diez entradas únicas.
- `tests/raceWinner.test.js`: pruebas del ganador (un rival gana y el jugador sigue hasta su meta, tiempos reales de los llegados sin cambios, ganador jugador, puesto coherente, repetir sin restos), de los textos de resultados desde la configuración y de la carrera completa de CA-01.
- `tests/collisions.test.js`: pruebas de límites y obstáculos en los cuatro circuitos: colocación fuera de la calzada y de la parrilla, nada se atraviesa a velocidad máxima, rebote, desvío y pérdida de velocidad, salida del choque (jugador y rivales), mismas reglas para los diez y sin progreso por rebotar (RF-015, RF-033, RN-01).
- `tests/carContacts.test.js`: pruebas del contacto entre coches: sin solapes ni atravesarse a velocidad máxima, alcance, frente y costado, mismas reglas para los diez, montonera contra el muro, empujones (hacia atrás o saltando checkpoints no suman; el avance real cuenta para clasificación y vueltas), carreras completas con semilla y rivales que no se bloquean (RF-033, RF-032, RN-01).
- `tests/impact.test.js`: pruebas de la intensidad de los golpes: leve o fuerte según el umbral de la configuración contra coches, muro y obstáculos, consecuencias distintas e iguales para los diez, toque suave sin destrucción (CA-03), daño acotado y sin efecto en el rendimiento, y carreras nuevas sin daños.
- `tests/damageVisuals.test.js`: pruebas, sin WebGL, de lo que se muestra con cada daño y de que sus recursos se pueden liberar.
- `tests/offRoad.test.js`: pruebas de la salida de calzada: detección dentro/fuera en los cuatro circuitos, menor velocidad fuera sin saltos, recuperación al volver, misma regla para los diez participantes y recortes sin vueltas, progreso ni posiciones (RN-01), con recuperación al cruzar el checkpoint pendiente.
- `tests/random.test.js`: pruebas de la fuente de aleatoriedad con semilla.
- `tests/sceneRenderer.test.js`: pruebas de la liberación de recursos del renderizado (RNF-04) con un renderizador falso: `dispose()` de todas las geometrías, materiales y texturas de la carrera anterior y de la vista previa, y grupos fuera de la escena; y que el muro y los obstáculos se dibujan donde dice la lógica.
- `tests/carMesh.test.js`: pruebas de la malla de cada modelo (aspecto distinto, mismas dimensiones, recursos liberados).
- `tests/race.test.js`: pruebas de la lista de participantes y la cámara de seguimiento.
- `tests/driving.test.js`: pruebas de la conducción (aceleración, frenado, marcha atrás, también tras un golpe, giro, determinismo, paso de tiempo máximo) y del rendimiento compartido.
- `tests/raceClock.test.js`: pruebas de la cuenta atrás, la señal de salida simultánea, la inmovilidad previa a la salida y el cronómetro.
- `tests/progress.test.js`: pruebas de checkpoints y meta, vueltas válidas (CA-02), retroceso y zigzag sobre la meta, progreso monótono, contador de vueltas del HUD y una vuelta completa conduciendo con `stepRace` (con progreso exactamente quieto durante la cuenta atrás).
- `tests/raceFinish.test.js`: pruebas de la llegada del jugador (RF-025: tiempo y progreso congelados, vueltas sin pasar del total), de los estados de resultados, repetir y menú de la máquina de estados, y de que no hay persistencia.
- `tests/raceSession.test.js`: pruebas del flujo de la partida con la máquina de estados real (carrera creada al entrar en parrilla, nueva al repetir, descartada al volver al menú, salida y resultados una sola vez, sin avance en pausa) y de que `main.js` no repite esa lógica.
- `tests/contentSecurityPolicy.test.js`: pruebas de la CSP del build (directivas mínimas, solo en build, sin scripts ni estilos en línea).
- `tests/guardForks.test.js`: prueba del hook `.claude/hooks/guard.py` con un `gh` falso: bloquea `gh pr checkout` y `gh pr merge` de una PR de fork (o de origen no comprobable) y permite las del propio repositorio.
- `tests/guardRamas.test.js`: prueba del hook `.claude/hooks/guard.py` con un `gh` falso para el flujo de ramas: `developer-teams` no hace commit ni push en `develop` ni en `main` y solo abre y fusiona PR contra `develop`; `doc-teams` trabaja solo en `develop`; `product-manager` solo crea y fusiona (con `--merge`) la PR de la entrega `develop` → `main` si su issue de aceptación existe y no tiene `requiere-decision`.
- `tests/guardEnv.test.js`: prueba del hook `.claude/hooks/guard.py`: bloquea cualquier orden de Bash (para todos los roles) con un fichero `.env` o `.env.*` como argumento o redirección (`head .env`, `grep -r . .env`, `< .env`…) y permite `.env.example`.
- `tests/gameState.test.js`: pruebas de los estados del juego y de la máquina de estados.
- `tests/logicIsolation.test.js`: prueba única de la separación lógica/renderizado (RNF-05): recorre todos los ficheros de `src/logic/` y falla si dependen de Three.js, del DOM, de `render/`, de `ui/` o de relojes del navegador.

## `docs/user/`

- `docs/user/MANUAL_USUARIO.md`: manual del jugador (cómo jugar). Lo mantiene `doc-teams`.

## `docs/presentacion/`

- `docs/presentacion/agentes-crash-circuit.pptx`: presentación del sistema de agentes (qué hace cada agente, orquestador, subagentes frente a auditores, flujo completo de una issue, permisos, modelos y modos de `scripts/orquestador.sh`), para público técnico y de gestión.

## `docs/technical/`

- `docs/technical/ARQUITECTURA.md`: stack, estructura de carpetas, módulos, configuración, pruebas y decisiones descartadas.

## `docs/project/` (contrato del proyecto)

- `docs/project/PERFIL.md`: reglas propias de Crash Circuit para todos los roles (producto, idioma, fuentes de verdad, restricciones, modelo de dominio, configuración, base técnica, comprobaciones obligatorias, verificación manual, documentación de usuario y entregas). Solo se modifica con autorización del usuario.
- `docs/project/proyecto.json`: datos del proyecto que leen el hook y los scripts (rutas protegidas, rutas de `doc-teams`, permisos del stack, términos no portables). Solo se modifica con autorización del usuario.

## `docs/product/` (fuente de verdad del producto, en español)

- `docs/product/01_VISION_DEL_PRODUCTO.md`: alcance, exclusiones, decisiones confirmadas vs. parámetros abiertos.
- `docs/product/02_REQUISITOS_FUNCIONALES.md`: requisitos `RF-001`..`RF-060`, reglas de negocio `RN-01`..`RN-07`, propuestas de configuración, requisitos no funcionales `RNF-01`..`RNF-09` y casos de aceptación `CA-01`..`CA-10`.
- `docs/product/03_ROADMAP.md`: orden de entrega E1 a E8, cada una jugable de forma independiente y con su línea `**Requisitos:**`.

<!-- indice-flujo-subagentes -->
## Kit de agentes (igual en todos los proyectos)

- `docs/process/FLUJO_DE_TRABAJO.md`: reglas comunes de los subagentes (roles, entregas y cobertura, funcionalidades nuevas, estados, ramas, plantillas, bloqueos). Solo se modifica con autorización del usuario.
- `.claude/agents/`: definiciones genéricas de los subagentes (orquestador, product-manager, developer-teams, qa-teams, doc-teams) y de los auditores `security-auditor` y `quality-auditor`, que se lanzan fuera del ciclo (manual o por cron).
- `.claude/hooks/guard.sh` y `.claude/hooks/guard.py`: hook que bloquea, por rol, comandos y ediciones de ficheros prohibidos. Lee las rutas del proyecto en `docs/project/proyecto.json`.
- `.claude/settings.json`: permisos de Claude Code. Lo genera `scripts/setup/02-permisos.sh`.
- `scripts/orquestador.sh`: lanza el orquestador (interactivo o `--auto`) o un subagente concreto; carga `.env`, impide ejecuciones simultáneas y guarda logs en `logs/`.
- `scripts/README.md`: manual de uso del sistema de subagentes (kit y proyecto, instalación, uso diario, funcionalidades nuevas, decisiones, aceptación de entregas, solución de problemas).
- `scripts/setup/`: scripts de instalación, numerados en orden de ejecución.
  - `scripts/setup/01-etiquetas.sh`: crea las etiquetas de GitHub del flujo de trabajo.
  - `scripts/setup/02-permisos.sh`: genera `.claude/settings.json` con los permisos base y los `permisos_extra` de `proyecto.json`.
  - `scripts/setup/03-kit.sh`: copia el kit a otro proyecto (`--destino`) y comprueba que no contiene nada del proyecto (`--comprobar`).
  - `scripts/setup/plantillas/`: `PERFIL.md`, `proyecto.json`, `INDEX.md` y `COMMANDS.md` de partida para un proyecto nuevo.
