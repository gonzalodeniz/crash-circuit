# INDEX.md

Índice de todos los ficheros del proyecto, para que los agentes los localicen rápidamente. Actualízalo cuando se cree, mueva o elimine un fichero.

## Raíz

- `CLAUDE.md`: punto de entrada de los agentes (kit). Importa el perfil del proyecto y el flujo de trabajo. Solo se modifica con autorización del usuario.
- `COMMANDS.md`: comandos útiles para los agentes (build, lint, test, ejecución local). Solo comandos verificados.
- `INDEX.md`: este índice.
- `README.md`: descripción del juego y cómo arrancarlo. Lo mantiene `doc-teams`.
- `CHANGELOG.md`: resumen de cada issue terminada, agrupado por entrega. Lo mantiene `doc-teams`.
- `.gitignore`: ficheros excluidos de git (`.env`, copias de seguridad `*.bak.*` y `logs/`).

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
- `.claude/agents/`: definiciones genéricas de los subagentes (orquestador, product-manager, developer-teams, qa-teams, doc-teams).
- `.claude/hooks/guard.sh` y `.claude/hooks/guard.py`: hook que bloquea, por rol, comandos y ediciones de ficheros prohibidos. Lee las rutas del proyecto en `docs/project/proyecto.json`.
- `.claude/settings.json`: permisos de Claude Code. Lo genera `scripts/setup/02-permisos.sh`.
- `scripts/rol.sh`: lanza el orquestador (interactivo o `--auto`) o un subagente concreto; carga `.env`, impide ejecuciones simultáneas y guarda logs en `logs/`.
- `scripts/README.md`: manual de uso del sistema de subagentes (kit y proyecto, instalación, uso diario, funcionalidades nuevas, decisiones, aceptación de entregas, solución de problemas).
- `scripts/setup/`: scripts de instalación, numerados en orden de ejecución.
  - `scripts/setup/01-etiquetas.sh`: crea las etiquetas de GitHub del flujo de trabajo.
  - `scripts/setup/02-permisos.sh`: genera `.claude/settings.json` con los permisos base y los `permisos_extra` de `proyecto.json`.
  - `scripts/setup/03-kit.sh`: copia el kit a otro proyecto (`--destino`) y comprueba que no contiene nada del proyecto (`--comprobar`).
  - `scripts/setup/plantillas/`: `PERFIL.md`, `proyecto.json`, `INDEX.md` y `COMMANDS.md` de partida para un proyecto nuevo.
