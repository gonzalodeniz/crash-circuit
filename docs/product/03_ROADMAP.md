# Roadmap de producto — Crash Circuit

**Versión:** 2.0  
**Fecha:** 20 de noviembre de 2026  
**Objetivo:** definir el orden de las entregas jugables, desde el MVP más básico hasta el producto completo.

## Principios

- Cada entrega añade valor visible para el jugador y mantiene operativas las capacidades ya entregadas.
- El orden responde a la evolución de la experiencia del juego, no a la organización del trabajo técnico.
- Una entrega se considera completada cuando se puede jugar y comprobar su resultado.
- No se fijan fechas ni duraciones hasta conocer los recursos disponibles.
- El producto final será un juego de carreras arcade 3D para navegador de escritorio, sin persistencia de datos.
- Cada entrega lista en su línea **Requisitos:** los identificadores que cubre (`RF`, `RN`, `RNF` y `CA`). `(parcial)` indica que la entrega cubre solo una parte y que el resto llega en una entrega posterior. Los identificadores nuevos se añaden al final del documento de requisitos y nunca se reutilizan.

## Resumen de entregas

| Entrega | Nombre | Experiencia disponible para el jugador |
|---|---|---|
| **E1** | **MVP: primera carrera** | Conducir un coche en un circuito, completar una vuelta y terminar la carrera. |
| **E2** | **Personalización de carrera** | Elegir entre 4 vehículos, 4 circuitos y carreras de 1, 3, 5 o 10 vueltas. |
| **E3** | **Competición contra rivales** | Correr contra otros 9 pilotos, adelantar y competir por la primera posición. |
| **E4** | **Colisiones y obstáculos** | Sufrir golpes, reducir velocidad fuera de pista y esquivar obstáculos. |
| **E5** | **Destrucción y reaparición** | Presenciar choques espectaculares y volver a competir después de 3 segundos. |
| **E6** | **Información de carrera y puntuación** | Consultar posición, velocidad, tiempos, vueltas, puntos y minimapa. |
| **E7** | **Experiencia arcade completa** | Pausar, reanudar, reiniciar o abandonar; escuchar efectos y revisar resultados completos. |
| **E8** | **Producto completo (v1.0)** | Disfrutar de todas las funcionalidades con una experiencia estable, equilibrada y pulida. |

## E1 — MVP: primera carrera

**Requisitos:** RF-001, RF-003 (parcial), RF-008 (parcial), RF-009, RF-010, RF-011, RF-012 (parcial), RF-014 (parcial), RF-016 (parcial), RF-019 (parcial), RF-020, RF-021 (parcial), RF-022, RF-023 (parcial), RF-025, RF-044 (parcial), RF-045 (parcial), RF-056 (parcial), RF-057 (parcial), RF-060, RN-01, RNF-02, RNF-05, RNF-06, RNF-07, CA-01 (parcial), CA-02, CA-09

**Objetivo:** ofrecer la versión más sencilla que ya se pueda jugar de principio a fin.

**El jugador podrá:**
- Controlar un vehículo con las flechas del teclado desde una cámara situada detrás del coche.
- Recorrer un único circuito cerrado con conducción arcade.
- Comenzar la carrera con una cuenta atrás «3, 2, 1».
- Completar una vuelta con un cronómetro y una meta reconocible.
- Ver que la carrera ha terminado y volver a intentarlo.

**Criterio de entrega:** una persona puede abrir el juego, disputar una carrera y terminarla sin ayuda externa.

**Todavía no incluye:** selección de vehículos o circuitos, rivales, destrucción, puntuación ni minimapa.

## E2 — Personalización de carrera

**Requisitos:** RF-002, RF-003, RF-004, RF-005, RF-006, RF-007, RF-014, CA-10 (parcial)

**Objetivo:** introducir todas las opciones de elección previstas para el producto.

**El jugador podrá:**
- Elegir visualmente entre 4 vehículos de aspecto diferente y prestaciones equilibradas.
- Elegir entre 4 circuitos diferenciados por su longitud y curvas, con dificultad muy fácil, fácil, media y difícil.
- Elegir 1, 3, 5 o 10 vueltas antes de competir.
- Consultar las opciones seleccionadas y disputar la carrera correspondiente.

**Criterio de entrega:** cualquiera de las 64 combinaciones de vehículo, circuito y vueltas puede jugarse y finalizarse correctamente.

## E3 — Competición contra rivales

**Requisitos:** RF-016, RF-017, RF-018, RF-019, RF-021, RF-023, RF-024, RF-027, RF-028, RF-029, RF-030, RF-031, RN-02, RN-03, RN-07, CA-01, CA-07

**Objetivo:** convertir las carreras individuales en competiciones con diez participantes.

**El jugador podrá:**
- Correr contra 9 vehículos controlados por el juego, cada uno con un piloto identificado por su nombre.
- Ver a los 10 vehículos salir simultáneamente tras la cuenta atrás.
- Competir contra rivales que siguen el circuito con pequeñas variaciones en su conducción.
- Adelantar y ser adelantado, con posiciones acordes al progreso de cada participante.
- Continuar hasta cruzar su propia meta, aunque otro piloto ya haya ganado.

**Criterio de entrega:** las posiciones y vueltas de los participantes se calculan de forma coherente y se identifica al ganador.

## E4 — Colisiones y obstáculos

**Requisitos:** RF-013, RF-015, RF-032 (parcial), RF-033, RF-034, CA-03

**Objetivo:** incorporar riesgos que cambian el resultado de la carrera.

**El jugador experimentará:**
- Choques entre coches y contra obstáculos del entorno.
- Rozaduras y golpes leves que provocan daños o pérdida de velocidad, sin destrucción inmediata.
- Reducción de velocidad cuando circule fuera de la carretera.
- Obstáculos en los márgenes del circuito capaces de provocar accidentes graves.
- Las mismas reglas de colisión para los vehículos rivales.

**Criterio de entrega:** los golpes leves y los fuertes tienen consecuencias distintas, y salirse del trazado representa una desventaja real.

## E5 — Destrucción y reaparición

**Requisitos:** RF-032, RF-035, RF-036, RF-037, RF-038, RF-039, RF-040, RF-041, RF-042, RN-04, CA-04, CA-05

**Objetivo:** incorporar el elemento visual más característico del juego.

**El jugador experimentará:**
- Destrucción espectacular del vehículo en accidentes graves, con fragmentos, chispas, humo y efectos de impacto.
- Una interrupción de 3 segundos tras la destrucción.
- Reaparición con un coche nuevo en un lugar seguro del circuito.
- Continuación de la carrera sin perder el progreso de vueltas conseguido.
- Destrucción y reaparición equivalentes para los nueve competidores.

**Criterio de entrega:** los coches pueden destruirse y regresar correctamente a la carrera, incluso cuando se producen varios accidentes a la vez.

## E6 — Información de carrera, minimapa y puntuación

**Requisitos:** RF-012, RF-043, RF-044, RF-045, RF-046, RF-047, RF-048, RF-049, RF-050, RF-051, RF-052, RF-053, RN-06, RNF-08 (parcial)

**Objetivo:** ofrecer información completa durante la competición.

**El jugador podrá consultar:**
- Su posición actual, vuelta, tiempo transcurrido y velocidad.
- Su puntuación y la diferencia respecto al líder.
- Un minimapa flotante arriba a la derecha que muestra todo el circuito.
- La ubicación diferenciada de su coche y los otros nueve participantes en el minimapa.
- Puntos por posición, adelantamientos y vueltas rápidas, con penalizaciones por accidentes.

**Criterio de entrega:** la información permanece sincronizada con lo que ocurre en la carrera y la puntuación responde a los eventos reales.

**Nota:** los valores numéricos concretos de las bonificaciones y penalizaciones se ajustarán durante las pruebas de equilibrio.

## E7 — Experiencia arcade completa

**Requisitos:** RF-008, RF-026, RF-054, RF-055, RF-056, RF-057, RF-058, RF-059, RN-05, RNF-09, CA-06, CA-08

**Objetivo:** completar las interacciones y la presentación de una carrera.

**El jugador podrá:**
- Pausar, reanudar, reiniciar o abandonar una carrera.
- Escuchar el motor, los derrapes, impactos, explosiones y la cuenta atrás, sin música.
- Finalizar la carrera cuando su vehículo cruce la meta después de completar las vueltas seleccionadas.
- Consultar una clasificación de los diez pilotos, tiempos y puntuación.
- Identificar qué tiempos son reales y cuáles se han estimado para los competidores que todavía no habían terminado.
- Repetir la misma carrera o elegir otra.

**Criterio de entrega:** toda la experiencia, desde la selección inicial hasta los resultados y una nueva partida, funciona sin interrupciones.

## E8 — Producto completo (versión 1.0)

**Requisitos:** RNF-01, RNF-03, RNF-04, RNF-07, RNF-08, CA-09, CA-10

**Objetivo:** entregar la experiencia definitiva, fiable y coherente con la visión del producto.

**Incluye:**
- Ajuste del equilibrio de los cuatro vehículos y las cuatro dificultades.
- Mejora del comportamiento de los rivales y de la espectacularidad de las colisiones.
- Pulido de controles, cámaras, menús, marcadores, sonidos y efectos.
- Revisión de la claridad de las clasificaciones, puntuaciones y tiempos estimados.
- Comprobación de las 64 combinaciones de vehículo, circuito y vueltas.
- Corrección de errores y mejora de la fluidez en navegadores de escritorio.
- Verificación de que no se conservan datos de partidas al cerrar o recargar el juego.

**Criterio de entrega:** están disponibles y funcionan todas las características acordadas, sin errores bloqueantes en los recorridos principales del juego.

## Evolución de la experiencia

**E1 — Carrera individual** → **E2 — Selección de contenido** → **E3 — Rivales** → **E4 — Colisiones** → **E5 — Destrucción** → **E6 — Marcadores y minimapa** → **E7 — Experiencia completa** → **E8 — Versión 1.0**

## Alcance cerrado de la versión 1.0

La versión completa incluye 4 vehículos, 4 circuitos, carreras de 1/3/5/10 vueltas, 9 pilotos rivales, conducción arcade, colisiones, destrucción y reaparición a los 3 segundos, sistema de puntos, minimapa, controles de carrera, resultados y efectos sonoros. Está destinada a navegadores de escritorio y no guarda datos entre sesiones.

Quedan fuera del alcance actual el multijugador en línea, las cuentas de usuario, la progresión persistente, las compras, la música y el soporte específico para móviles.
