# Changelog

Resumen de las issues terminadas, agrupadas por entrega del roadmap (de la más reciente a la más antigua). Lo mantiene `doc-teams` tras cada fusión.

## E1 — MVP: primera carrera

- **#7 E1 · Base técnica: el juego arranca en el navegador como aplicación estática** (PR #14, 2026-11-22): el juego se arranca en local con `npm run dev` y muestra una escena 3D de prueba a pantalla completa que se adapta a la ventana. El proyecto queda con código en `src/`, pruebas automáticas sin navegador en `tests/` (`npm test`), un módulo único de configuración y la lógica separada del renderizado. Requisitos: RNF-02, RNF-05 (parcial), RNF-06, RNF-07 (parcial), RF-060 (parcial).
- **#8 E1 · Menú principal desde el que empezar una carrera** (PR #15, 2026-11-22): al abrir el juego aparece un menú con el título «Crash Circuit» y el botón «Empezar», que se activa con el ratón o con Intro/Espacio. Al pulsarlo, el menú desaparece y el juego pasa a la parrilla, que por ahora muestra la escena de prueba. Requisitos: RF-001, RNF-05 (parcial).
- **#9 E1 · Un circuito cerrado con el coche del jugador en la parrilla y cámara trasera** (PR #16, 2026-11-22): al pulsar «Empezar» se ve un circuito cerrado provisional (unos 877 m) con calzada, borde blanco y línea de meta a cuadros. El coche del jugador (modelo provisional de formas simples) aparece en la parrilla, sobre la calzada y mirando hacia la meta, visto desde una cámara de seguimiento trasera. La escena se libera al volver al menú o a la selección. Requisitos: RF-009, RF-014 (parcial), RF-016 (parcial), RF-019 (parcial).
