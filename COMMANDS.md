# COMMANDS.md

Comandos útiles para los agentes. Solo se listan comandos que existen y han sido verificados en este repositorio; no se inventan.

Requisitos: Node >= 20 y npm (verificado con Node 22.23 y npm 12). Todos los comandos se ejecutan desde la raíz del repositorio.

## Instalación de dependencias

- `npm install`: instala `three` y `vite` según `package-lock.json`. Verificado.

## Build

- `npm run build`: genera la aplicación estática en `dist/` (no se versiona). Verificado.

## Lint

_Pendiente: no hay linter configurado._

## Test

- `npm test`: ejecuta las pruebas automáticas de `tests/` con el ejecutor integrado de Node, sin navegador. Verificado (9 pruebas).

## Ejecución local

- `npm run dev`: servidor local con recarga en <http://127.0.0.1:5190/>. Verificado (responde 200).
- `npm run preview`: sirve `dist/` (tras `npm run build`) en <http://127.0.0.1:5191/>. Verificado (responde 200).

Los puertos están fijados en `vite.config.js`; si están ocupados, el comando falla en vez de cambiar de puerto.
