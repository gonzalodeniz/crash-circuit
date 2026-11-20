# Visión del producto — Crash Circuit

**Producto:** Crash Circuit  
**Versión del documento:** 1.0  
**Fecha:** 20 de noviembre de 2026  
**Estado:** Visión funcional consensuada; detalles de calibración pendientes  
**Documentos relacionados:** `02_REQUISITOS_FUNCIONALES.md`, `03_ROADMAP.md`

## 1. Resumen ejecutivo

Crash Circuit es un videojuego de carreras para navegadores de escritorio, desarrollado con HTML5, CSS3, JavaScript y Three.js. El jugador compite desde una cámara situada detrás de su coche contra **nueve vehículos controlados por el juego**, en circuitos cerrados. La experiencia busca ser inmediata, dinámica y visualmente espectacular: conducción arcade, adelantamientos, colisiones con daños, destrucción de vehículos en impactos fuertes y reaparición después de tres segundos.

El jugador selecciona uno de **cuatro modelos de coche**, uno de **cuatro circuitos** y el número de vueltas (**1, 3, 5 o 10**). Cada circuito tiene un nivel de dificultad propio: **muy fácil, fácil, medio y difícil**. Una cuenta atrás de 3, 2, 1 precede a la salida simultánea de los diez vehículos. Gana quien complete primero la distancia de carrera, pero la sesión jugable del jugador termina cuando este cruza la meta, independientemente de su posición.

La aplicación mostrará información de competición en tiempo real, un minimapa flotante y una pantalla final de resultados. **No existirá persistencia**: las partidas, resultados y puntuaciones vivirán exclusivamente en memoria mientras esté abierta la sesión.

## 2. Problema y oportunidad

La propuesta ofrece una experiencia de carreras arcade autocontenida, accesible desde un navegador de escritorio, sin instalación adicional de software de juego, registro ni conexión a servicios propios. El enfoque prioriza la diversión y la claridad de reglas sobre la simulación automovilística.

**Propuesta de valor:** carreras 3D rápidas de iniciar, con diez participantes, variedad de escenarios y coches, una competición comprensible y colisiones visualmente impactantes, todo dentro del navegador.

## 3. Público objetivo y plataforma

- Jugadores ocasionales de escritorio que utilizan teclado y navegador web moderno.
- Usuarios que valoran la sensación arcade, las partidas de duración configurable y la competición contra IA.
- Plataforma objetivo: navegadores de escritorio con soporte de WebGL adecuado para Three.js.
- No se requiere soporte específico para pantallas táctiles, teléfonos o tabletas.

## 4. Visión de la experiencia

> «Elegir coche y circuito, arrancar tras una cuenta atrás y disputar una carrera divertida contra nueve rivales: adelantar, derrapar, esquivar obstáculos, sobrevivir a choques espectaculares y conocer la clasificación al cruzar la meta».

### Principios de diseño

1. **Acceso inmediato:** pocos pasos entre abrir la página y empezar a correr.
2. **Conducción accesible:** flechas del teclado y comportamiento arcade, no simulación estricta.
3. **Competición legible:** posición, vuelta, velocidad, tiempo, puntuación y diferencia con el líder siempre visibles durante la carrera.
4. **Variedad sin desequilibrio:** cuatro diseños visuales de vehículos con rendimiento equivalente; la dificultad deriva principalmente del circuito.
5. **Accidentes espectaculares, sin frustración prolongada:** destrucción audiovisual y regreso a pista a los tres segundos, con continuidad de la carrera.
6. **Sesiones efímeras:** todo se reinicia al recargar o cerrar el navegador.

## 5. Recorrido principal del jugador

1. Abre el juego y accede al menú principal.
2. Entra en selección de vehículo; examina cuatro coches visualmente distintos y elige uno.
3. Entra en selección de circuito; examina cuatro recorridos con dificultad y trazado diferentes.
4. Selecciona 1, 3, 5 o 10 vueltas.
5. Inicia la carrera. Los diez vehículos se sitúan en parrilla; aparece «3, 2, 1» y se da una salida simultánea.
6. Conduce con las flechas del teclado; los nueve rivales siguen sus rutas con ligeras variaciones y pueden adelantar o sufrir accidentes.
7. Consulta el panel de carrera y el minimapa. Puede pausar, reanudar, reiniciar o abandonar.
8. Si sufre un impacto fuerte, el vehículo se destruye mediante efectos visuales y sonoros; reaparece en un lugar seguro después de tres segundos y continúa.
9. Al completar sus vueltas, se congela su tiempo y aparece el resultado: clasificación de los diez pilotos, tiempos reales disponibles, estimaciones señaladas para los rivales que aún no terminaron, puntuación y opciones para repetir o elegir otra carrera.

## 6. Alcance funcional del producto completo

### Vehículos y participantes

- Cuatro modelos con silueta/apariencia propias y parámetros de conducción equilibrados.
- Un coche controlado por el jugador y nueve controlados por IA: diez participantes en total.
- Nueve rivales identificados por nombres de piloto **fijos entre carreras**.
- Los competidores utilizan los mismos cuatro modelos visuales disponibles para el jugador.

### Circuitos

- Cuatro circuitos cerrados diferenciados por longitud, curvas y nivel de dificultad.
- Cuatro opciones de número de vueltas por carrera.
- Salidas de pista que reducen velocidad; obstáculos fuera de pista con posibilidad de destrucción por impactos fuertes.
- Puntos de control invisibles que validan vueltas y evitan atajos ilegítimos.

### Conducción y accidentes

- Cámara de seguimiento situada detrás del vehículo.
- Conducción arcade mediante teclado: flechas para acelerar, frenar y girar; configuración concreta documentada en requisitos.
- Colisiones coche-coche, coche-límites y coche-obstáculo.
- Rozaduras e impactos leves: reducción de velocidad y/o daños visibles leves; impactos fuertes: destrucción del vehículo.
- Animación de fragmentos y partículas, acompañada de efectos de sonido y posible sacudida de cámara limitada.
- Reaparición tras tres segundos, sin perder las vueltas ya validadas.

### Competición e interfaz

- Parrilla de salida simultánea tras cuenta atrás «3, 2, 1».
- Clasificación por vueltas completadas y progreso válido sobre el circuito.
- Victoria del primer participante que complete las vueltas previstas.
- Fin de la sesión del jugador al cruzar meta; si no todos los rivales terminaron, se estiman sus resultados y se etiquetan como tales.
- Panel: posición, vuelta, tiempo, velocidad, puntos y diferencia respecto al líder.
- Minimapa flotante arriba a la derecha con trazado completo y marcadores diferenciables para los diez coches.
- Puntuación en función de posición final, adelantamientos válidos y vueltas rápidas, con penalización por accidentes.
- Controles de pausa, reanudación, reinicio y abandono.
- Resultados: clasificación, tiempos, puntos y opciones de repetir o seleccionar otro evento.
- Sonidos de motor, derrape, colisiones, explosiones y cuenta atrás; **sin música**.

## 7. Límites y exclusiones

Fuera del alcance acordado:

- Multijugador local o en línea, servidores de juego, cuentas y perfiles de usuario.
- Almacenamiento de récords, estadísticas entre sesiones, guardado de partidas o cualquier persistencia de datos.
- Modificación de vehículos, mejoras mecánicas, progresión desbloqueable o economía del juego.
- Controles específicos de móvil/tableta.
- Simulación realista de suspensión, neumáticos, daños estructurales o dinámica avanzada.
- Editor de circuitos.
- Música de fondo.

## 8. Objetivos de aceptación del producto

Se considerará alcanzada la visión cuando:

- Se puedan ejecutar las **64 combinaciones** de cuatro vehículos × cuatro circuitos × cuatro opciones de vueltas, sin bloqueos de flujo.
- En cada carrera participen un jugador y nueve pilotos de IA con identidad consistente.
- Se puedan iniciar carreras, completarlas, pausar, continuar, reiniciar y abandonar desde la interfaz.
- La clasificación y el cómputo de vueltas respondan correctamente a adelantamientos, atajos, colisiones, accidentes y reapariciones.
- Todos los elementos informativos y de cierre acordados estén operativos.
- La destrucción sea claramente visible, el vehículo reaparezca después de tres segundos y la carrera conserve su estado competitivo.
- No se guarden datos de la partida entre recargas ni en almacenamiento del navegador.
- Se trabaje con un **objetivo de rendimiento de 60 FPS** en un ordenador de referencia por acordar; no constituye una garantía universal para cualquier hardware.

## 9. Decisiones confirmadas y parámetros abiertos

**Confirmadas por el promotor:** perspectiva trasera 3D; estilo arcade; flechas; cuatro coches visualmente diferentes y equilibrados; cuatro circuitos de dificultad creciente; 1/3/5/10 vueltas; nueve rivales nombrados; trayectorias de IA con aleatoriedad; choques con daños o destrucción según intensidad; reaparición a tres segundos tanto de IA como de jugador; salida simultánea; gana el primero; final del jugador al cruzar su meta; panel y minimapa; puntuación compuesta; estimación final de rivales pendientes; sonidos sin música; escritorio; sin persistencia.

**Pendientes de calibración, no bloqueantes:** nombres definitivos de pilotos, coches y circuitos; recursos visuales y licencias; velocidad/umbral exactos de colisión; valores numéricos de puntuación; algoritmo exacto de estimación de resultados y tolerancia de la diferencia al líder; hardware y navegadores mínimos de referencia. Estos elementos deben quedar parametrizados o documentarse antes del cierre de la versión 1.0.

## 10. Criterio de priorización

El orden de construcción favorecerá: (1) bucle de conducción y vuelta jugable, (2) selección de contenido, (3) diez participantes e IA, (4) impactos y reaparición, (5) sistema de clasificación y marcador, (6) acabado audiovisual, resultados y rendimiento. El roadmap detalla las entregas verificables.
