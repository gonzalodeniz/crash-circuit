# PERFIL.md — Crash Circuit

Reglas propias de este proyecto para todos los roles. Los agentes de `.claude/agents/` son genéricos: todo lo que depende del proyecto está aquí, en secciones con título fijo que los agentes citan por su nombre. No cambies los títulos de las secciones. Solo se modifica con autorización del usuario.

## Producto

**Crash Circuit** es un juego de carreras arcade 3D para navegador de escritorio, construido con HTML5, CSS3, JavaScript y Three.js. El jugador compite desde una cámara de seguimiento contra 9 pilotos controlados por IA (10 participantes) en circuitos cerrados.

**Usuario final:** quien juega. En este proyecto, «usuario» equivale a «jugador», y «comprobarlo usando el producto» equivale a «comprobarlo jugando».

## Idioma

- Documentos de producto, issues, comentarios de GitHub, mensajes de commit y comentarios del código: en español.
- Código e identificadores: en inglés.
- Mantén trazables los términos de los documentos (p. ej. `checkpoint`, `grid`, `lap`) al mapearlos con el texto de requisitos en español.

## Fuentes de verdad

En orden de autoridad:

| Documento | Contenido |
|---|---|
| `docs/product/01_VISION_DEL_PRODUCTO.md` | Alcance, exclusiones, decisiones confirmadas y parámetros abiertos. |
| `docs/product/02_REQUISITOS_FUNCIONALES.md` | Requisitos, reglas de negocio, propuestas de configuración, requisitos no funcionales y casos de aceptación. |
| `docs/product/03_ROADMAP.md` | Entregas E1…E8, en orden. Cada entrega lista sus IDs en una línea `**Requisitos:**`. |

**Identificadores** (estables, nunca se reutilizan):

| Prefijo | Tipo | Campo de la issue |
|---|---|---|
| `RF-xxx` | Requisito funcional | `Requisitos` |
| `RNF-xx` | Requisito no funcional | `Requisitos` |
| `RN-xx` | Regla de negocio | `Reglas de negocio` |
| `CA-xx` | Caso de aceptación de extremo a extremo | `Casos de aceptación relacionados` |

Los valores marcados como **propuesta** están en la sección 4 de `02_REQUISITOS_FUNCIONALES.md`.

## Restricciones de arquitectura

- **Sin persistencia ni backend** (RF-060, RNF-06, RNF-07): ni `localStorage`, ni `sessionStorage`, ni IndexedDB, ni cookies, ni llamadas a servidores. Todo el estado vive en memoria y se reinicia al recargar.
- **Stack** (RNF-02): aplicación estática con HTML5, CSS3, JavaScript y Three.js, con el mínimo de dependencias.
- **Lógica separada del renderizado** (RNF-05): la lógica de competición se puede probar sin navegador.
- **Liberación de recursos** (RNF-04): geometrías, materiales, partículas y sonidos se liberan al reiniciar o cambiar de circuito.
- **Contenido fijo:** 4 modelos de coche (rendimiento idéntico, aspecto distinto), 4 circuitos (muy fácil, fácil, medio, difícil), 1/3/5/10 vueltas y 9 pilotos IA con nombres fijos. Son 64 combinaciones jugables y todas deben funcionar.
- **La dificultad viene del circuito** (trazado y parámetros de la IA), nunca de las estadísticas del coche (RN-07, RF-031).
- **Controles:** solo flechas del teclado, y no deben disparar acciones del navegador durante la carrera (RF-010). Sin música, solo efectos de sonido. Sin soporte móvil.
- **Ubicación del código:** el código del juego va en `src/` y las pruebas automáticas en `tests/`. En la raíz solo van los ficheros de configuración que las herramientas exijan (p. ej. `package.json`). `docs/technical/ARQUITECTURA.md` puede detallar la estructura interna de esas carpetas, pero no cambiar esta regla.
- **Las entregas anteriores siguen funcionando** a medida que se añaden las siguientes.

## Modelo de dominio

Estas reglas afectan a varios sistemas y deben mantenerse coherentes:

- **Estados del juego:** `MENU`, `SELECCION`, `PARRILLA`, `CUENTA_ATRAS`, `EN_CARRERA`, `PAUSA`, `RESULTADOS`. `DESTRUIDO` es un subestado de cada vehículo.
- **Validez de vuelta (RN-01):** una vuelta solo cuenta si los checkpoints se cruzaron en orden antes de la meta. Retroceder u omitir checkpoints nunca suma progreso.
- **Clasificación (RN-02):** quienes han terminado se ordenan por tiempo real de llegada y van por delante de quienes no; el resto se ordena por progreso válido (vueltas + distancia).
- **Fin de carrera (RN-03):** gana el primero en terminar, pero la carrera del jugador sigue hasta que termine él. Entonces se abren los resultados, aunque queden IA en pista.
- **Resultados proyectados (RN-05):** los IA sin llegada real se estiman con la distancia válida restante y el ritmo reciente suavizado. Se etiquetan como «estimado» y las puntuaciones que dependen de ellos, como provisionales. Los tiempos reales nunca se sobrescriben (RF-027).
- **Destrucción y reaparición (RN-04, RF-038…RF-042):** un impacto fuerte (umbral parametrizado) destruye el coche y lo bloquea 3 segundos de tiempo *activo*. Reaparece en un lugar seguro y conserva vueltas, checkpoints, penalizaciones y resultados. Se aplica igual a los 10 participantes.
- **Puntuación (RN-06):** `points = positionPoints + overtakeBonus + fastLapBonus - accidentPenalty`, con todos los componentes parametrizados y reglas anti-abuso para adelantamientos (RF-052) y vueltas rápidas.
- **Pausa:** congela la simulación y todos los relojes, incluido el temporizador de reaparición.

## Configuración

Muchos valores son *propuestas*, no decisiones: tabla de puntos, tecla de pausa `Esc`/`P`, umbral de colisión, protección tras la reaparición, objetivo de 60 FPS. Van en **un único módulo de configuración**, nunca fijos en el código. Quedan pendientes de calibrar los nombres finales, los assets y sus licencias, los valores de puntuación y el algoritmo de estimación.

## Base técnica

La primera issue de la primera entrega deja el proyecto listo para desarrollar:

- Estructura `src/` y `tests/`, Three.js y arranque como aplicación estática (RNF-02, RNF-06).
- Un sistema de pruebas automáticas para la lógica, que se ejecuta sin navegador.
- Los comandos verificados en `COMMANDS.md`.
- `docs/technical/ARQUITECTURA.md` con las decisiones técnicas.

La issue describe el resultado esperado; la elección concreta de herramientas corresponde a `developer-teams`.

## Comprobaciones obligatorias

Las ejecuta `developer-teams` antes del handoff y `qa-teams` al validar. Cualquier incumplimiento es un defecto bloqueante.

1. **Sin persistencia (RF-060):** este comando no debe devolver nada:
   `grep -rnE "localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest" src/`
2. **Modelo de dominio:** el diff respeta todas las reglas de «Modelo de dominio».
3. **Configuración:** ningún valor «propuesta» está fijo en el código.
4. **Arquitectura:** la lógica de competición no depende del renderizado, y los recursos se liberan al reiniciar o cambiar de circuito.
5. **Pruebas automáticas** de toda lógica nueva de progreso, vueltas, clasificación, puntuación, temporizadores y estimaciones. Si falta alguna, es un defecto bloqueante.

## Verificación manual

Solo se puede comprobar jugando y **no bloquea** la validación de QA: sensación de conducción, efectos visuales, cámara, sonido, legibilidad del HUD y del minimapa, y fluidez. QA lo anota en «Verificación manual pendiente», con pasos concretos, y el usuario lo comprueba al aceptar la entrega.

## Documentación de usuario

Escrita para quien juega: frases cortas y sin jerga técnica.

| Fichero | Contenido |
|---|---|
| `README.md` | Qué es el juego, requisitos (navegador de escritorio con WebGL), cómo arrancarlo en local, qué entregas están disponibles y enlaces al resto de la documentación. |
| `docs/user/MANUAL_USUARIO.md` | Cómo jugar: menú y selección, controles, reglas visibles (vueltas válidas, posiciones, destrucción y reaparición, puntuación, resultados y estimaciones), pausa y opciones. |
| `CHANGELOG.md` | Una entrada por issue terminada, agrupada por entrega. |

## Entregas

- Las entregas se identifican como `E1`, `E2`… El título del milestone de GitHub es exactamente ese ID, y su descripción, el nombre de la entrega en el roadmap.
- El título de una issue empieza por el ID de la entrega: `E1 · <título breve orientado al jugador>`.
- Una funcionalidad nueva entra con requisitos nuevos en `02_REQUISITOS_FUNCIONALES.md` y una entrega nueva (`E9`…) al final del roadmap. El procedimiento está en «Funcionalidades nuevas» de `docs/process/FLUJO_DE_TRABAJO.md`.
