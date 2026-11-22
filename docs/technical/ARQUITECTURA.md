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
tests/              Pruebas automáticas (*.test.js), ejecutables sin navegador
dist/               Resultado de `npm run build` (no se versiona)
```

En la raíz solo van `package.json`, `package-lock.json` y `vite.config.js`, que las herramientas exigen.

## Módulos y responsabilidades

- `src/config/config.js`: único origen de los valores configurables.
- `src/logic/gameState.js`: estados del juego (`MENU`, `SELECCION`, `PARRILLA`, `CUENTA_ATRAS`, `EN_CARRERA`, `PAUSA`, `RESULTADOS`) y transiciones permitidas. Las transiciones actuales son una primera propuesta basada en RF-008 y RF-026 y las issues siguientes pueden ampliarlas.
- `src/render/sceneRenderer.js`: crea el `WebGLRenderer`, la escena y la cámara, adapta el lienzo a la ventana y libera sus recursos con `dispose()` (RNF-04).
- `src/main.js`: único punto donde se juntan lógica y renderizado; contiene el bucle `requestAnimationFrame`.

Regla de dependencias (RNF-05): `logic/` no importa `three`, el DOM ni `render/`. `render/` puede leer datos de `logic/`, pero no decide nada de la competición. Las pruebas comprueban que `logic/gameState.js` no menciona Three.js ni el DOM.

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
