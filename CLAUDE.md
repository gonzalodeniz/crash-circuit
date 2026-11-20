# CLAUDE.md

## Comportamiento general de los agentes

- **Este fichero es estable.** Modifícalo lo mínimo posible y solo con autorización explícita del usuario. Si crees que debe cambiar, propón el cambio concreto y espera la aprobación antes de editarlo.
- **Consulta `INDEX.md` primero** para localizar ficheros en vez de explorar el repositorio a ciegas.
- **Mantén `INDEX.md` al día:** cuando crees, muevas o elimines un fichero, actualiza su entrada en el índice en el mismo cambio.
- **Los documentos de `docs/product/` son la fuente de verdad.** Ante una duda o contradicción, pregunta al usuario en lugar de decidir por tu cuenta.
- **Los comandos útiles están en `COMMANDS.md`.** Consúltalo antes de ejecutar y añade solo comandos verificados; no inventes comandos de build, lint o test.

## Resumen del producto

"Crash Circuit": un juego de carreras arcade para navegador de escritorio construido con HTML5, CSS3, JavaScript y Three.js. El jugador compite desde una cámara de seguimiento contra 9 pilotos controlados por IA (10 participantes) en circuitos cerrados.

Documentos fuente de verdad, en orden de autoridad:
- `docs/product/01_VISION_DEL_PRODUCTO.md`: alcance, exclusiones, decisiones confirmadas vs. parámetros abiertos.
- `docs/product/02_REQUISITOS_FUNCIONALES.md`: requisitos `RF-001`..`RF-060`, reglas de negocio `RN-01`..`RN-07` y valores de configuración inicial no confirmados.
- `docs/product/03_ROADMAP.md`: orden de entrega E1 a E8, cada una jugable de forma independiente.

Referencia los IDs de requisitos (`RF-xxx`, `RN-xx`) al implementar o probar comportamiento.

## Restricciones que condicionan la arquitectura

- **Sin persistencia ni backend.** RF-060 prohíbe localStorage, IndexedDB, cookies y servidores. Todo el estado vive en memoria y se reinicia al recargar.
- **Contenido fijo:** 4 modelos de auto (parámetros de rendimiento idénticos, visuales distintos), 4 circuitos (uno por dificultad: muy fácil, fácil, medio, difícil), 1/3/5/10 vueltas, 9 pilotos IA con nombres fijos. Eso da 64 combinaciones jugables, y todas deben funcionar.
- **La dificultad proviene del circuito** (trazado y parámetros de la IA), nunca de las estadísticas del auto (RN-07, RF-031).
- **Solo flechas del teclado**, y las flechas no deben disparar acciones del navegador durante una carrera (RF-010). Sin música, solo efectos de sonido (SFX). Sin soporte móvil.
- **El orden de construcción sigue el roadmap:** ciclo de conducción, selección de contenido, IA, colisiones, destrucción/reaparición, HUD/puntaje, pulido. Mantén funcionando las entregas anteriores a medida que se agregan las siguientes.

## Modelo de dominio a preservar

Estas reglas abarcan varios sistemas, así que mantenlas consistentes:

- **Estados del juego:** `MENU`, `SELECCION`, `PARRILLA`, `CUENTA_ATRAS`, `EN_CARRERA`, `PAUSA`, `RESULTADOS`; `DESTRUIDO` es un subestado por vehículo.
- **Validez de vuelta (RN-01):** una vuelta cuenta solo si los checkpoints se cruzaron en orden antes de la línea de meta. Retroceder u omitir checkpoints nunca debe sumar progreso.
- **Clasificación (RN-02):** los pilotos que terminaron se ordenan por tiempo real de llegada y quedan por delante de los que no terminaron; el resto se ordena por progreso válido (vueltas + distancia).
- **Fin de carrera (RN-03):** el primero en terminar gana, pero la carrera del jugador continúa hasta que este termine. Cuando el jugador termina, se abre la pantalla de resultados aunque aún haya autos IA corriendo.
- **Resultados proyectados (RN-05):** los autos IA sin llegada real se estiman a partir de la distancia válida restante y el ritmo reciente suavizado. Etiquétalos como "estimado" y marca como provisionales los puntajes que dependan de ellos. Los tiempos reales de llegada nunca se sobrescriben (RF-027).
- **Destrucción y reaparición (RN-04, RF-038..042):** un impacto fuerte (umbral parametrizado) destruye el auto, con un bloqueo de 3 segundos de tiempo *activo* (el temporizador no debe avanzar durante la pausa). El auto reaparece en un lugar seguro y conserva vueltas, checkpoints, penalizaciones y resultados. La misma lógica aplica a los 10 participantes.
- **Puntaje (RN-06):** `points = positionPoints + overtakeBonus + fastLapBonus - accidentPenalty`, con todos los componentes parametrizados. Requiere reglas anti-abuso para los adelantamientos (RF-052) y las vueltas rápidas.
- **Pausa:** congela la simulación y todos los relojes, incluido el temporizador de reaparición.

## Configuración

Muchos valores son explícitamente *propuestas*, no decisiones (tabla de puntos, tecla de pausa `Esc`/`P`, umbral de colisión, protección posterior a la reaparición, objetivo de 60 FPS en una máquina de referencia indefinida). Manténlos en un único módulo de configuración y no los escribas directamente en el código (sin hardcodear). Los documentos listan elementos pendientes de calibración (nombres finales, assets y licencias, valores de puntaje, algoritmo de estimación).

## Convenciones de idioma

Los documentos de producto están en español. Escribe el código, los identificadores y los mensajes de commit en inglés, y los comentarios del código en español, salvo que el usuario pida otra cosa. Mantén trazables los términos de los documentos (p. ej. `checkpoint`, `grid`, `lap`) al mapearlos con el texto de requisitos en español.
