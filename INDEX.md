# INDEX.md

Índice de todos los ficheros del proyecto, para que los agentes los localicen rápidamente. Actualízalo cuando se cree, mueva o elimine un fichero.

## Raíz

- `CLAUDE.md`: punto de entrada de los agentes (kit). Importa el perfil del proyecto y el flujo de trabajo. Solo se modifica con autorización del usuario.
- `COMMANDS.md`: comandos útiles para los agentes (build, lint, test, ejecución local). Solo comandos verificados.
- `INDEX.md`: este índice.
- `README.md`: descripción del juego y cómo arrancarlo. Lo mantiene `doc-teams`.
- `CHANGELOG.md`: resumen de cada issue terminada, agrupado por entrega. Lo mantiene `doc-teams`.
- `.gitignore`: ficheros excluidos de git (`.env`, copias de seguridad `*.bak.*`, `logs/`, `node_modules/` y `dist/`).
- `package.json` y `package-lock.json`: dependencias (`three`, `vite`) y scripts npm (`dev`, `build`, `preview`, `test`).
- `vite.config.js`: configuración de Vite (raíz `src/`, salida `dist/`, puertos locales) y plugin que inserta la Content Security Policy en el build.

## `src/` (código del juego)

- `src/index.html`: página de arranque con el lienzo `#game-canvas`.
- `src/styles.css`: estilos; el lienzo ocupa toda la ventana.
- `src/main.js`: punto de entrada; traduce eventos del DOM y dibuja, sin decidir el flujo de la partida (de eso se encarga `raceSession.js`); arranca el bucle.
- `src/config/config.js`: módulo único de configuración (valores «propuesta» incluidos).
- `src/logic/gameState.js`: estados del juego y máquina de estados (sin Three.js ni DOM).
- `src/logic/track.js`: trazado del circuito como dato (línea central cerrada, anchura, meta, checkpoints, parrilla) y funciones geométricas (sin Three.js ni DOM).
- `src/logic/race.js`: crea la carrera con su lista de participantes colocados en la parrilla, define `ParticipantStatus` (estado de cada participante, distinto de `GameState`), `stepRace` (avanza reloj y coches y marca la llegada al completar las vueltas) y `raceTimeOf` (sin Three.js ni DOM).
- `src/logic/raceSession.js`: flujo de la partida (`RaceSession`): crea y descarta la carrera según el estado, avanza con `step` y aplica `beginCountdown`, `startGo` y `finishRace` (sin Three.js ni DOM).
- `src/logic/raceClock.js`: cuenta atrás «3, 2, 1», señal de salida y cronómetro de carrera, avanzados con el paso de tiempo simulado (sin Three.js ni DOM).
- `src/logic/progress.js`: progreso de carrera de un participante (RN-01): vueltas válidas, checkpoints en orden, distancia válida y contador «Vuelta X/Y» (sin Three.js ni DOM).
- `src/logic/chaseCamera.js`: posición y punto de mira de la cámara de seguimiento a partir de la pose del coche (sin Three.js ni DOM).
- `src/logic/driving.js`: modelo de conducción arcade (`createCarState`, `stepCar`, `inputFromKeys`); recibe entradas y un paso de tiempo (sin Three.js ni DOM).
- `src/ui/keyboardInput.js`: captura de las flechas (DOM); evita las acciones del navegador mientras dura la carrera.
- `src/ui/raceHud.js`: HUD de la carrera (DOM); muestra la señal de la cuenta atrás, el cronómetro y la vuelta actual.
- `src/ui/resultsScreen.js`: pantalla de resultados (DOM); muestra «Carrera terminada» con el tiempo final y las opciones «Repetir» y «Menú».
- `src/ui/mainMenu.js`: menú principal (DOM); muestra el título y la opción «Empezar» y avisa con una función de retorno.
- `src/render/sceneRenderer.js`: escena, cámara y renderizador de Three.js; dibuja el circuito, la meta y los coches de la carrera y libera sus recursos.

## `tests/` (pruebas automáticas, sin navegador)

- `tests/config.test.js`: pruebas del módulo de configuración.
- `tests/track.test.js`: pruebas del trazado cerrado, la meta y las posiciones de parrilla (los huecos no se solapan, comprobado con rectángulos de coche).
- `tests/race.test.js`: pruebas de la lista de participantes y la cámara de seguimiento.
- `tests/driving.test.js`: pruebas de la conducción (aceleración, frenado, marcha atrás, giro, determinismo, paso de tiempo máximo) y del rendimiento compartido.
- `tests/raceClock.test.js`: pruebas de la cuenta atrás, la señal de salida simultánea, la inmovilidad previa a la salida y el cronómetro.
- `tests/progress.test.js`: pruebas de checkpoints y meta, vueltas válidas (CA-02), retroceso y zigzag sobre la meta, progreso monótono, contador de vueltas del HUD y una vuelta completa conduciendo con `stepRace` (con progreso exactamente quieto durante la cuenta atrás).
- `tests/raceFinish.test.js`: pruebas de la llegada del jugador (RF-025: tiempo y progreso congelados, vueltas sin pasar del total), de los estados de resultados, repetir y menú de la máquina de estados, y de que no hay persistencia.
- `tests/raceSession.test.js`: pruebas del flujo de la partida con la máquina de estados real (carrera creada al entrar en parrilla, nueva al repetir, descartada al volver al menú, salida y resultados una sola vez, sin avance en pausa) y de que `main.js` no repite esa lógica.
- `tests/contentSecurityPolicy.test.js`: pruebas de la CSP del build (directivas mínimas, solo en build, sin scripts ni estilos en línea).
- `tests/gameState.test.js`: pruebas de los estados del juego y de la máquina de estados.
- `tests/logicIsolation.test.js`: prueba única de la separación lógica/renderizado (RNF-05): recorre todos los ficheros de `src/logic/` y falla si dependen de Three.js, del DOM, de `render/`, de `ui/` o de relojes del navegador.

## `docs/user/`

- `docs/user/MANUAL_USUARIO.md`: manual del jugador (cómo jugar). Lo mantiene `doc-teams`.

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
