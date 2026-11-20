# Especificación de requisitos — Crash Circuit

**Producto:** Crash Circuit  
**Versión:** 1.0 · **Fecha:** 20/11/2026  
**Estado:** Línea base funcional; parámetros de ajuste señalados como propuestas  
**Relación:** complementa la visión del producto y sirve como referencia de aceptación del roadmap.

## 1. Propósito y convenciones

Este documento traduce las decisiones acordadas en comportamientos verificables. Cada requisito tiene un identificador estable `RF-xxx`. La palabra **debe** indica una condición exigida para el producto final. Los valores etiquetados como **propuesta** no son decisiones cerradas y deberán validarse durante las pruebas de juego.

**Actores:** jugador (control manual), piloto IA (control automatizado), motor de carrera (reglas, tiempos y clasificación).  
**Estados:** `MENU`, `SELECCION`, `PARRILLA`, `CUENTA_ATRAS`, `EN_CARRERA`, `PAUSA`, `DESTRUIDO` (subestado individual de vehículo), `RESULTADOS`.  
**Definiciones:** una «vuelta válida» requiere atravesar los checkpoints en el orden previsto; «fin de carrera del jugador» es el instante en que completa su última vuelta; «tiempo estimado» no es un crono real de llegada.

## 2. Requisitos funcionales

### A. Navegación y configuración

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RF-001 | El sistema debe presentar un menú principal desde el que iniciar una carrera. | Desde la carga inicial se puede entrar en el flujo de selección. |
| RF-002 | Debe mostrar exactamente cuatro opciones de vehículo, visualmente diferenciadas. | Es posible visualizar y escoger cualquiera de los cuatro modelos. |
| RF-003 | Los cuatro modelos deben ofrecer parámetros de rendimiento equivalentes. | Una configuración compartida de velocidad, aceleración y giro impide ventajas mecánicas de origen. |
| RF-004 | Debe permitir seleccionar uno entre exactamente cuatro circuitos. | Cada opción carga su circuito correspondiente y muestra dificultad y datos básicos. |
| RF-005 | Cada circuito debe estar asociado a una dificultad distinta: muy fácil, fácil, medio o difícil. | Las cuatro etiquetas aparecen una vez cada una. |
| RF-006 | En la selección de circuito se debe poder elegir exactamente 1, 3, 5 o 10 vueltas. | Cualquiera de los cuatro valores se aplica a la carrera y se refleja en HUD. |
| RF-007 | Antes de comenzar, se debe conocer el vehículo, circuito y número de vueltas elegidos. | La carrera utiliza exactamente la configuración confirmada. |
| RF-008 | El usuario debe poder volver al menú para elegir otro evento sin recargar la página. | Desde resultados o abandono se puede configurar una carrera nueva. |

### B. Escena, vehículo y control

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RF-009 | La carrera debe renderizarse en 3D con cámara de seguimiento detrás del vehículo del jugador. | La cámara acompaña al coche conservando una perspectiva trasera legible. |
| RF-010 | El jugador debe conducir con las flechas del teclado. | Arriba acelera, abajo frena (y opcionalmente permite marcha atrás detenida), izquierda/derecha giran; ninguna flecha dispara acciones del navegador durante carrera. |
| RF-011 | La física debe ser arcade, con aceleración, desaceleración, dirección e inercia simplificadas. | El coche resulta controlable y transmite velocidad sin modelar una simulación automovilística realista. |
| RF-012 | El vehículo debe permanecer asociado a la posición y sentido reales de la pista. | Cámara, HUD, minimapa y clasificación se actualizan con su desplazamiento. |
| RF-013 | La velocidad debe reducirse cuando el coche circula fuera de la calzada. | A igualdad de aceleración, la velocidad efectiva fuera de pista es menor que dentro. |
| RF-014 | Los cuatro circuitos deben ser recorridos cerrados distintos en longitud y curvas. | Las cuatro rutas tienen geometría propia y se enlazan correctamente en la línea de meta. |
| RF-015 | El mundo debe incorporar límites y obstáculos fuera de la carretera. | Un coche puede interactuar mediante colisión con esos objetos. |

### C. Parrilla, vueltas y estados de carrera

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RF-016 | Deben competir exactamente diez participantes: un jugador y nueve pilotos IA. | La parrilla y la clasificación contienen diez entradas únicas. |
| RF-017 | Los nueve pilotos IA deben conservar una identidad nominal fija. | Los mismos nueve nombres aparecen en distintas carreras. |
| RF-018 | Los pilotos IA deben conducir modelos pertenecientes al catálogo de cuatro coches. | Ningún rival utiliza un quinto modelo. |
| RF-019 | Debe existir una parrilla inicial que coloque a los diez coches en posiciones válidas. | No hay solapamientos al empezar ni coches fuera de pista. |
| RF-020 | Antes de cada carrera debe aparecer una cuenta atrás 3, 2, 1. | No se contabiliza desplazamiento competitivo previo y la cuenta se muestra secuencialmente. |
| RF-021 | Al finalizar la cuenta atrás, todos los vehículos deben recibir la señal de salida simultáneamente. | El estado de carrera cambia para los diez en el mismo instante lógico. |
| RF-022 | Deben contarse las vueltas mediante la línea de meta y checkpoints secuenciales. | Cruzar meta sin recorrer los checkpoints válidos no suma una vuelta. |
| RF-023 | El progreso y la clasificación deben ordenarse por vueltas válidas y distancia válida recorrida. | Un coche con más progreso de carrera figura por delante de otro con menos; las llegadas usan sus instantes de cruce. |
| RF-024 | El primer piloto en completar las vueltas previstas debe declararse ganador. | Se registra el primer instante de llegada sin esperar al jugador. |
| RF-025 | La sesión competitiva del jugador debe concluir cuando este complete sus vueltas. | Se detienen sus controles y tiempo final y se pasa a resultados. |
| RF-026 | El juego debe permitir pausar, reanudar, reiniciar y abandonar una carrera. | Pausa congela simulación/relojes; reanudar restaura; reinicio restablece el evento; abandono vuelve al menú. |
| RF-027 | Los pilotos que terminen antes que el jugador deben conservar tiempo y posición real de llegada. | Sus resultados no se sobrescriben al terminar el jugador. |

### D. Comportamiento de competidores

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RF-028 | Cada piloto IA debe seguir una trayectoria predefinida dependiente del circuito. | Puede completar una vuelta sin intervención humana en cada circuito. |
| RF-029 | La trayectoria de los rivales debe incorporar variaciones acotadas y aleatorias. | Las carreras no son idénticas, sin provocar sistemáticamente salidas de pista. |
| RF-030 | Los vehículos IA deben poder alcanzar, adelantar o ser adelantados dentro de la simulación. | El orden cambia por progreso real y no solo por animaciones decorativas. |
| RF-031 | La dificultad debe depender del circuito seleccionado. | Los parámetros de trazado/conducción producen cuatro niveles relativos, preservando coches equilibrados. |
| RF-032 | Las colisiones y el estado de destrucción deben aplicarse también a los pilotos IA. | Un rival puede sufrir un impacto grave, destruirse y reincorporarse. |

### E. Colisiones, daños, destrucción y reaparición

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RF-033 | Debe detectarse contacto entre vehículos y con límites/obstáculos del escenario. | Las colisiones causan respuesta de juego reconocible y sin atravesar objetos sólidos. |
| RF-034 | Los golpes suaves y rozaduras deben provocar pérdida de velocidad y/o daños visuales leves. | Un toque de baja energía no destruye automáticamente el vehículo. |
| RF-035 | Los impactos fuertes deben destruir el vehículo afectado. | Superar un umbral parametrizable activa el estado de destrucción. |
| RF-036 | Los obstáculos fuera de pista deben poder provocar destrucción cuando el impacto es fuerte. | Chocar rápidamente con un obstáculo activa la misma secuencia que un choque grave entre coches. |
| RF-037 | La destrucción debe mostrarse con efectos visuales espectaculares. | Se aprecian separación/fragmentación de piezas, chispas/humo y efectos adecuados sin bloquear renderizado. |
| RF-038 | El coche destruido debe quedar inhabilitado para conducción durante tres segundos de tiempo activo. | No se conduce durante el intervalo; el cronómetro de reaparición no avanza en pausa. |
| RF-039 | Transcurridos tres segundos, debe generarse un vehículo nuevo en un lugar seguro del circuito. | Vuelve a estar controlable, bien orientado y sin solapamiento inmediato con obstáculos o coches. |
| RF-040 | La reaparición debe preservar vueltas, checkpoints válidos, piloto, resultado previo y penalizaciones. | No se reinicia la carrera individual ni se suman vueltas ficticias. |
| RF-041 | La misma lógica de destrucción/reaparición debe funcionar para los diez participantes. | Jugador y nueve IA vuelven a carrera con los mismos criterios. |
| RF-042 | Durante la reaparición deben evitarse cadenas injustas de choques instantáneos. | Una breve protección o selección segura de posición reduce re-colisiones al reaparecer. **Propuesta técnica**, no regla competitiva cerrada. |

### F. HUD, minimapa y puntuación

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RF-043 | El HUD debe mostrar la posición del jugador sobre diez participantes. | Actualiza al producirse cambios de progreso o llegada. |
| RF-044 | El HUD debe mostrar vuelta actual y total de vueltas. | El valor concuerda con checkpoints, incluida la última vuelta. |
| RF-045 | El HUD debe mostrar el tiempo de carrera transcurrido. | No suma tiempo durante pausa ni antes de la señal de salida. |
| RF-046 | El HUD debe mostrar la velocidad actual del jugador. | Cambia con aceleración, frenado, rozaduras y salidas de pista; unidad visible. |
| RF-047 | El HUD debe mostrar los puntos acumulados. | Refleja bonificaciones y penalizaciones aplicadas sin duplicados. |
| RF-048 | El HUD debe mostrar la diferencia del jugador respecto del líder. | Si el jugador lidera, es cero; en otro caso se muestra una estimación temporal legible derivada del progreso. |
| RF-049 | Debe verse un minimapa flotante arriba a la derecha con el circuito entero. | El trazado no se recorta y permanece referenciado a coordenadas del circuito. |
| RF-050 | El minimapa debe mostrar al jugador y a los nueve rivales con marcadores diferenciables. | Se reconocen diez posiciones y el jugador destaca de forma inequívoca. |
| RF-051 | La puntuación debe considerar posición final, adelantamientos, vueltas rápidas y accidentes. | Cada factor queda registrado y mostrado o desglosable en resultados. |
| RF-052 | Un adelantamiento puntuable debe evitar contabilizaciones repetidas por intercambio continuo de posiciones. | El sistema aplica una regla de validación o antiexplotación documentada. |
| RF-053 | Deben penalizarse los accidentes graves sin impedir que se continúe la carrera. | Se resta la penalización configurada y se puede reaparecer. |

### G. Resultados, audio y ciclo de vida

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RF-054 | Al terminar el jugador debe aparecer una clasificación con los diez pilotos. | Cada piloto tiene puesto, nombre, tiempo final o estimado y puntuación; las puntuaciones dependientes de estimaciones se señalan como provisionales. |
| RF-055 | Deben estimarse los resultados finales de rivales que sigan en pista cuando termine el jugador. | Se calcula proyección desde progreso y ritmo; los valores se etiquetan «estimado» y no se confunden con tiempos reales. |
| RF-056 | La pantalla de resultados debe mostrar tiempo del jugador, clasificación y puntuación. | Datos visibles y coherentes con la carrera disputada. |
| RF-057 | Desde resultados debe poder repetirse la carrera con la misma configuración. | Reinicia posiciones, vueltas, tiempos, estados, daños y puntos. |
| RF-058 | Desde resultados debe poder elegirse otra carrera. | Retorna a selección sin conservar el estado competitivo anterior. |
| RF-059 | Debe reproducir efectos de motor, derrapes, colisiones, explosiones y cuenta atrás. | Cada situación activa su efecto; la app no reproduce música de fondo. |
| RF-060 | El juego debe funcionar sin almacenar datos de partida entre sesiones. | No usa localStorage, IndexedDB, cookies ni backend para guardar progreso o resultados. |

## 3. Reglas de negocio y diseño de carrera

**RN-01 — Progreso de carrera.** Cada piloto tiene un índice de checkpoint válido, número de vueltas completadas y progreso continuo en la vuelta actual. Una vuelta solo se confirma al cruzar meta tras haber pasado por los checkpoints en orden. Desplazarse marcha atrás o saltarse controles no permite acumular progreso ficticio.

**RN-02 — Orden de competición.** Durante la prueba, los pilotos que ya han finalizado se ordenan por instante de llegada real y figuran por delante de pilotos con el mismo objetivo aún sin completar; los restantes se ordenan por progreso válido. Cuando termine el jugador, los puestos que todavía no estén decididos se proyectan de acuerdo con RN-05.

**RN-03 — Victoria y final del jugador.** La victoria corresponde al primer piloto que cruce su última meta válida. Si un IA termina antes, la carrera del jugador continúa hasta su propia llegada. En ese momento se abre resultados aunque otros IA sigan en carrera.

**RN-04 — Accidente y reaparición.** Un choque grave causa destrucción, penalización y un bloqueo de tres segundos (sin avanzar en pausa). Se reaparece en una zona segura acorde con el último avance válido; la destrucción no equivale a abandono.

**RN-05 — Tiempos proyectados.** Para IA sin tiempo de llegada real al cerrar la sesión, estimar el tiempo restante con distancia válida pendiente y velocidad/ritmo reciente suavizado, con límites razonables. Ordenar estimaciones por tiempo proyectado y señalar su condición de simuladas; no atribuirles precisión oficial. Si hay empate, aplicar criterio determinista documentado.

**RN-06 — Puntuación.** La función debe tener la forma `puntos = puntosPosición + bonificaciónAdelantamientos + bonificaciónVueltasRápidas − penalizaciónAccidentes`, con componentes parametrizables. Una posición y puntuación pueden calcularse de manera definitiva al cerrar resultados; el HUD puede presentar un valor provisional. No se exige una tabla numérica particular hasta calibrarla.

**RN-07 — Dificultad.** El circuito determina la etiqueta de dificultad y características del trazado. La IA puede adaptarse a sus curvas y longitud, pero no se introducirán ventajas mecánicas permanentes en ninguno de los cuatro modelos de coche.

## 4. Propuestas de configuración inicial (NO confirmadas)

Estas elecciones son puntos de partida para el prototipo y deben conservarse en un módulo de configuración:

| Parámetro | Propuesta inicial | Estado |
|---|---|---|
| Dirección | Flechas izquierda/derecha; acelerar arriba; frenar/reversa abajo | Convención por validar con prueba de juego |
| Pausa | `Esc` o `P` | Propuesta |
| Puntos por llegada | 1.º: 100; 2.º: 80; 3.º: 65; 4.º: 55; 5.º: 45; 6.º: 35; 7.º: 25; 8.º: 15; 9.º: 10; 10.º: 5 | Propuesta |
| Adelantamiento válido | +5 puntos tras mantener posición ganada un intervalo breve; no premiar repetición artificial del mismo cruce | Propuesta |
| Vuelta rápida | +10 puntos por cada mejora personal válida, con reglas antifraude y sin puntuar primera vuelta automáticamente | Propuesta |
| Accidente grave | −10 puntos por destrucción | Propuesta |
| Protección tras reaparición | Invulnerabilidad de corta duración, visualmente indicada | Propuesta |
| Nivel de rendimiento | 60 FPS objetivo en equipo de referencia por definir | Objetivo, no garantía |

## 5. Requisitos no funcionales (complementarios)

| ID | Requisito no funcional | Comprobación |
|---|---|---|
| RNF-01 | Ejecutarse en navegadores modernos de escritorio compatibles con WebGL y Three.js. | Pruebas de humo en versiones de referencia de Chrome, Edge y Firefox a fijar. |
| RNF-02 | Implementarse con HTML5, CSS3 y JavaScript; Three.js para escena 3D. | Revisión de dependencias y arranque reproducible. |
| RNF-03 | Ejecutar diez coches con IA y efectos activos sin bloqueos graves; aspirar a 60 FPS. | Perfilado reproducible en ordenador de referencia y escenarios con colisiones simultáneas. |
| RNF-04 | Evitar fugas de memoria en reinicios, destrucciones y cambios de circuito. | Repetir carreras y comprobar liberación/reutilización de geometrías, partículas y sonidos. |
| RNF-05 | Mantener interfaz y lógica de competición separadas del renderizado. | Código organizado en módulos con responsabilidades claras. |
| RNF-06 | Funcionar sin servicio remoto ni autenticación para lógica de carrera. | Juego ejecutable como aplicación estática bajo servidor web local o alojamiento de archivos estáticos; no se requiere backend. |
| RNF-07 | No persistir información del usuario ni telemetría de carrera. | Auditoría de APIs de almacenamiento y tráfico de datos de aplicación. |
| RNF-08 | Mantener visibilidad y contraste de HUD, minimapa y resultados en resoluciones de escritorio habituales. | Comprobación visual con distintas proporciones de pantalla. |
| RNF-09 | Gestionar activación de sonido conforme a restricciones del navegador. | Los sonidos comienzan después de una interacción explícita si el navegador bloquea autoplay. |

## 6. Casos de aceptación de extremo a extremo

**CA-01 — Carrera básica.** Dado un vehículo, circuito y una vuelta, cuando el jugador inicia, ve 3-2-1, sale con diez coches, cruza checkpoints y meta, entonces aparece su resultado y puede repetir.

**CA-02 — Vuelta inválida.** Dado un coche que evita un checkpoint, cuando cruza meta, entonces el contador de vueltas no aumenta indebidamente.

**CA-03 — Choque leve.** Dado un toque suave con otro coche, cuando ocurre, entonces se observa una reacción leve y ninguno se destruye automáticamente.

**CA-04 — Choque grave y retorno.** Dado un impacto fuerte contra coche u obstáculo, cuando el coche se destruye, entonces muestra efectos, no responde al control durante tres segundos activos y reaparece en pista con su progreso conservado.

**CA-05 — Accidente de IA.** Dado un rival IA que sufre un impacto fuerte, cuando pasan tres segundos activos, entonces vuelve a circular, sin duplicar participantes.

**CA-06 — Pausa.** Dada una carrera activa, cuando se pausa, entonces se congelan movimiento, cuenta atrás de destrucción y tiempo; al reanudar continúan sin saltos temporales.

**CA-07 — Rival ganador.** Dado un IA que alcanza la meta final antes que el jugador, entonces se registra la victoria del rival, pero el jugador sigue corriendo hasta terminar.

**CA-08 — Resultados estimados.** Dado que el jugador acaba mientras algunos rivales siguen circulando, cuando se muestran resultados, entonces las llegadas reales mantienen sus tiempos y el resto se marca como «estimado».

**CA-09 — Sin persistencia.** Dada una carrera completada, cuando se recarga la página, entonces no queda ningún resultado anterior guardado.

**CA-10 — Matriz de selecciones.** Dadas las combinaciones de 4 coches, 4 circuitos y 4 distancias, todas permiten iniciar y completar una carrera sin configuración incompatible.

## 7. Dependencias, riesgos y decisiones pendientes

- **Nombres propios:** se deben asignar nombres definitivos a nueve pilotos y etiquetas para coches/circuitos. Hasta entonces se usarán identificadores internos estables y rótulos provisionales.
- **Física y detección:** colisiones fiables en movimiento rápido requieren detección adecuada y límites de velocidad/paso temporal para evitar atravesar obstáculos.
- **IA y rendimiento:** diez coches, fragmentación, humo y minimapa deberán optimizarse con reutilización de objetos, límites de partículas y presupuestos de draw calls.
- **Puntuación:** calibrar valores y reglas antiexplotación en pruebas; sus componentes ya están definidos, no su magnitud.
- **Estimaciones de rivales:** no presentarlas como tiempos oficiales; definir y probar la aproximación en circuitos y dificultades distintos.
- **Audio y assets:** seleccionar recursos con derechos de uso compatibles y generar efectos sin música.
- **Navegadores/hardware:** concretar matriz de soporte y máquina de referencia al estabilizar la versión 1.0.

## 8. Definición de terminado del producto completo

Un requisito se considera terminado si funciona, cuenta con una prueba manual o automatizada documentada, no rompe el flujo de inicio a resultado y puede repetirse tras reiniciar. La entrega final requiere todos los `RF-001` a `RF-060`, los casos de aceptación `CA-01` a `CA-10`, la matriz de 64 configuraciones y la revisión de los requisitos no funcionales.
