# INDEX.md

Índice de todos los ficheros del proyecto, para que los agentes los localicen rápidamente. Actualízalo cuando se cree, mueva o elimine un fichero.

## Raíz

- `CLAUDE.md`: punto de entrada de los agentes (kit). Importa el perfil del proyecto y el flujo de trabajo. Solo se modifica con autorización del usuario.
- `COMMANDS.md`: comandos útiles para los agentes (build, lint, test, ejecución local). Solo comandos verificados.
- `INDEX.md`: este índice.

## `docs/project/` (contrato del proyecto)

- `docs/project/PERFIL.md`: reglas propias del proyecto para todos los roles, en secciones con título fijo. Solo se modifica con autorización del usuario.
- `docs/project/proyecto.json`: datos del proyecto que leen el hook y los scripts (rutas protegidas, rutas de doc-teams, permisos del stack). Solo se modifica con autorización del usuario.

## `docs/product/` (fuente de verdad del producto)

- <Un fichero por línea, con su contenido.>

## Kit de agentes

- `docs/process/FLUJO_DE_TRABAJO.md`: reglas comunes de los subagentes (roles, estados, entregas y cobertura, ramas, plantillas, bloqueos).
- `.claude/agents/`: definiciones genéricas de los subagentes (orquestador, product-manager, developer-teams, qa-teams, doc-teams).
- `.claude/hooks/guard.sh` y `.claude/hooks/guard.py`: hook que bloquea, por rol, comandos y ediciones de ficheros prohibidos.
- `.claude/settings.json`: permisos de Claude Code. Lo genera `scripts/setup/02-permisos.sh`.
- `scripts/orquestador.sh`: lanza el orquestador (interactivo o `--auto`) o un subagente concreto.
- `scripts/README.md`: manual de uso del sistema de subagentes.
- `scripts/setup/`: scripts de instalación (`01-etiquetas.sh`, `02-permisos.sh`, `03-kit.sh`) y plantillas del proyecto (`plantillas/`).
