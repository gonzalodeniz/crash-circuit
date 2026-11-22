# Changelog

Resumen de las issues terminadas, agrupadas por entrega del roadmap (de la más reciente a la más antigua). Lo mantiene `doc-teams` tras cada fusión.

## E1 — MVP: primera carrera

- **#7 E1 · Base técnica: el juego arranca en el navegador como aplicación estática** (PR #14, 2026-11-22): el juego se arranca en local con `npm run dev` y muestra una escena 3D de prueba a pantalla completa que se adapta a la ventana. El proyecto queda con código en `src/`, pruebas automáticas sin navegador en `tests/` (`npm test`), un módulo único de configuración y la lógica separada del renderizado. Requisitos: RNF-02, RNF-05 (parcial), RNF-06, RNF-07 (parcial), RF-060 (parcial).
