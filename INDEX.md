# INDEX.md

Índice de todos los ficheros del proyecto, para que los agentes los localicen rápidamente. Actualízalo cuando se cree, mueva o elimine un fichero.

## Raíz

- `CLAUDE.md`: comportamiento general de los agentes y convenciones de idioma. Solo se modifica con autorización del usuario.
- `CONTEXT.md`: contexto del proyecto: resumen del producto, restricciones de arquitectura, modelo de dominio y configuración.
- `COMMANDS.md`: comandos útiles para los agentes (build, lint, test, ejecución local). Solo comandos verificados.
- `INDEX.md`: este índice.
- `.gitignore`: ficheros excluidos de git (copias de seguridad `.claude/*.bak.*`).

## `docs/product/` (fuente de verdad del producto, en español)

- `docs/product/01_VISION_DEL_PRODUCTO.md`: alcance, exclusiones, decisiones confirmadas vs. parámetros abiertos.
- `docs/product/02_REQUISITOS_FUNCIONALES.md`: requisitos `RF-001`..`RF-060`, reglas de negocio `RN-01`..`RN-07` y valores de configuración inicial no confirmados.
- `docs/product/03_ROADMAP.md`: orden de entrega E1 a E8, cada una jugable de forma independiente.

<!-- indice-flujo-subagentes -->
## Flujo de trabajo y configuración de agentes

- `docs/process/FLUJO_DE_TRABAJO.md`: reglas comunes de los subagentes (roles, estados, ramas, plantillas, bloqueos). Solo se modifica con autorización del usuario.
- `.claude/settings.json`: permisos de Claude Code. Se genera con `scripts/setup/02-permisos.sh`.
- `.claude/agents/`: definiciones de los subagentes (orquestador, product-manager, developer-teams, qa-teams, doc-teams, quality-auditor, security-auditor).
- `scripts/setup/`: scripts para reconstruir la configuración desde cero, numerados en orden de ejecución.
  - `scripts/setup/01-etiquetas.sh`: crea las etiquetas de GitHub del flujo de trabajo.
  - `scripts/setup/02-permisos.sh`: genera `.claude/settings.json` con los permisos de Claude Code.
  - `scripts/setup/03-flujo-trabajo.sh`: instala `docs/process/FLUJO_DE_TRABAJO.md` y las referencias en `CLAUDE.md` e `INDEX.md`.
