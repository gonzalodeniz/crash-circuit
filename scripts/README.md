# Desarrollo con subagentes de Claude Code

Crash Circuit se desarrolla con un equipo de subagentes de Claude Code coordinados por un orquestador. Este documento explica cómo instalar el sistema, cómo usarlo a diario y cómo intervenir cuando te necesita.

> El `README.md` de la raíz describe el juego y lo mantiene `doc-teams`. Este documento trata solo del sistema de agentes.

## Índice

1. [Cómo funciona](#cómo-funciona)
2. [Requisitos](#requisitos)
3. [Instalación desde cero](#instalación-desde-cero)
4. [Uso diario](#uso-diario)
5. [Tu papel: decisiones y aceptación de entregas](#tu-papel-decisiones-y-aceptación-de-entregas)
6. [Estados de una issue](#estados-de-una-issue)
7. [Qué puede y qué no puede hacer cada rol](#qué-puede-y-qué-no-puede-hacer-cada-rol)
8. [Modificar la configuración](#modificar-la-configuración)
9. [Solución de problemas](#solución-de-problemas)
10. [Ficheros del sistema](#ficheros-del-sistema)

## Cómo funciona

```
                 ┌──────────────┐
                 │ orquestador  │  lee las etiquetas de las issues y delega
                 └──────┬───────┘
     ┌──────────────┬───┴──────────┬──────────────┐
     ▼              ▼              ▼              ▼
product-manager  developer-teams  qa-teams      doc-teams
crea issues      implementa,      valida la PR  documenta lo
por entrega      abre PR, fusiona               fusionado
```

- **GitHub es el estado compartido.** Cada issue abierta lleva una etiqueta `estado:*` que indica en qué punto está. Los subagentes no se hablan entre sí: se comunican mediante issues, PR y comentarios con plantillas fijas.
- **El orquestador** aplica la primera regla que se cumple (decisiones pendientes → fusionar → corregir → validar → continuar → documentar → empezar → crear issues), delega en un subagente, comprueba que la transición se ha producido y repite.
- **Una sola issue en curso** en todo el proyecto. El trabajo avanza en serie.
- **Las entregas siguen el roadmap** (`docs/product/03_ROADMAP.md`), con un milestone de GitHub por entrega (E1…E8).
- **Tú intervienes** cuando un agente necesita una decisión y al final de cada entrega, para aceptarla tras probar el juego.

Las reglas completas están en `docs/process/FLUJO_DE_TRABAJO.md`.

## Requisitos

| Herramienta | Comprobación |
|---|---|
| Claude Code ≥ 2.1 | `claude --version` |
| GitHub CLI | `gh --version` |
| git, python3, flock | `git --version && python3 --version && flock --version` |
| Node.js y npm (los usará el juego) | `node --version && npm --version` |
| Repositorio en GitHub con remoto `origin` | `git remote -v` |

**Credenciales de GitHub:** crea un fichero `.env` en la raíz (no se sube a git) con un token que tenga permisos sobre issues, PR y contenido del repositorio:

```bash
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx
```

`scripts/rol.sh` lo carga y lo exporta como `GH_TOKEN`. Si prefieres no usar `.env`, ejecuta `gh auth login` una vez.

## Instalación desde cero

Los scripts de `scripts/setup/` están numerados en orden de ejecución. Todos son **idempotentes**: puedes relanzarlos sin duplicar nada, y no sobrescriben ficheros que hayas editado salvo que uses `--force` (en ese caso guardan una copia `.bak`).

```bash
cd /opt/apps/crash-circuit
chmod +x scripts/rol.sh scripts/setup/*.sh

# 1. Etiquetas de estado y milestones E1…E8 en GitHub
./scripts/setup/01-etiquetas.sh --dry-run    # revisa qué hará
./scripts/setup/01-etiquetas.sh

# 2. Permisos de Claude Code (.claude/settings.json)
./scripts/setup/02-permisos.sh

# 3. Reglas del flujo (docs/process/FLUJO_DE_TRABAJO.md + sección en CLAUDE.md + INDEX.md)
./scripts/setup/03-flujo-trabajo.sh

# 4. Subagentes (.claude/agents/) y hook de protección (.claude/hooks/)
./scripts/setup/04-agentes.sh

git add -A && git commit -m "[setup] Install subagent workflow"
git push
```

Después, **abre una sesión nueva** de Claude Code: las sesiones que ya estaban abiertas no detectan los agentes.

Para comprobar la instalación:

```bash
./scripts/rol.sh --list      # debe listar los cinco roles
claude                       # y en el prompt escribe @orq: debe aparecer "orquestador (agent)"
```

## Uso diario

Todo se lanza con `scripts/rol.sh`:

| Comando | Qué hace |
|---|---|
| `./scripts/rol.sh` | Orquestador en sesión **interactiva**: ves cada delegación y puedes responder decisiones en el momento. |
| `./scripts/rol.sh --max 3` | Igual, pero se detiene tras 3 delegaciones. |
| `./scripts/rol.sh --auto` | Orquestador **desatendido** (máximo 10 delegaciones). La salida queda en `logs/orquestador-<fecha>.log`. |
| `./scripts/rol.sh --auto --max 5` | Desatendido con un límite propio. |
| `./scripts/rol.sh qa-teams` | Sesión interactiva directamente con un rol, sin orquestador. Útil para depurar. |
| `./scripts/rol.sh --auto qa-teams "Valida la issue #12"` | Un rol concreto, desatendido, con una tarea. |
| `./scripts/rol.sh --list` | Roles disponibles. |

Cualquier texto que no sea un rol se envía como mensaje al orquestador:

```bash
./scripts/rol.sh "Ejecuta el ciclo, pero no empieces issues nuevas"
```

**Recomendaciones:**

- Empieza en modo interactivo con `--max` bajo hasta confiar en el comportamiento de cada rol.
- Al comenzar una entrega, lanza `./scripts/rol.sh --max 1`: solo creará las issues, y podrás revisarlas en GitHub antes de que empiece el desarrollo.
- El lanzador usa un bloqueo: si ya hay una ejecución en curso, la segunda termina con código 3 sin hacer nada.

### Dónde ver lo que ha pasado

- **Resumen final del orquestador:** delegaciones hechas, estado actual, decisiones y verificaciones pendientes, y motivo de parada.
- **GitHub:** issues (estado y comentarios), PR (handoffs de desarrollo y resultados de QA) y milestones.
- **`logs/`:** salida completa de las ejecuciones desatendidas.

## Tu papel: decisiones y aceptación de entregas

### Decisiones (`requiere-decision`)

Cuando un agente encuentra una ambigüedad, una contradicción con `docs/product/` o algo que no le corresponde decidir, deja en la issue un comentario con una `Pregunta:` y la etiqueta `requiere-decision`. El orquestador se detiene en cuanto ve esa etiqueta.

Puedes responder de dos formas:

- **En la sesión interactiva:** el orquestador te presenta la pregunta. Al responder, registra tu respuesta en la issue (`Decisión del usuario: …`), retira la etiqueta y continúa.
- **En GitHub:** responde en la issue con un comentario y retira tú la etiqueta `requiere-decision`. En la siguiente ejecución, el flujo continúa.

Si la decisión implica cambiar `docs/product/`, actualiza tú esos documentos: ningún agente puede modificarlos.

### Aceptación de una entrega

Los agentes no pueden jugar. Cuando se cierran todas las issues de una entrega, `product-manager` crea la issue **«Aceptación de la entrega Ek»** con:

- el criterio de entrega del roadmap,
- las issues que la componen,
- todas las *verificaciones manuales pendientes* que QA fue anotando.

Prueba el juego siguiendo esa lista y responde:

- **Aceptada:** `product-manager` cierra el milestone y crea las issues de la entrega siguiente. Cierra tú la issue de aceptación.
- **No aceptada:** indica qué falta; `product-manager` creará las issues correspondientes en esa misma entrega.

### Permisos de comandos nuevos

Si `developer-teams` incorpora una herramienta cuyo comando no está permitido, lo indica en su handoff con la regla exacta (por ejemplo `Bash(make *)`). Añádela a `ALLOW_STACK` en `scripts/setup/02-permisos.sh` y relanza el script.

## Estados de una issue

```
nuevo ──► en-desarrollo ──► listo-para-qa ──► validado ──► (fusionada y cerrada)
                                 ▲     │                         │
                                 │     ▼                         ▼
                                 └─ no-validado          impacto-documental ──► doc-teams
```

| Etiqueta | Significado | Siguiente rol |
|---|---|---|
| `estado:nuevo` | Lista para empezar | developer-teams |
| `estado:en-desarrollo` | Rama y PR en borrador abiertas | developer-teams |
| `estado:listo-para-qa` | Handoff publicado en la PR | qa-teams |
| `estado:no-validado` | QA ha encontrado defectos bloqueantes | developer-teams |
| `estado:validado` | QA aprueba | developer-teams (fusiona) |
| `impacto-documental` | Al cerrarse, hay que documentar | doc-teams |
| `requiere-decision` | Bloqueada esperando tu respuesta | tú |
| `tipo:tecnica` | Deuda técnica o hallazgo de auditoría | product-manager la prioriza |

Si una misma issue recibe **3 rechazos de QA**, el orquestador se detiene y te pregunta cómo seguir.

## Qué puede y qué no puede hacer cada rol

Las restricciones no dependen solo del prompt: el hook `.claude/hooks/guard.py` bloquea las acciones prohibidas antes de que se ejecuten y le explica el motivo al agente.

| Rol | Modelo | Puede | El hook le impide |
|---|---|---|---|
| orquestador | sonnet | Leer GitHub, delegar, registrar tus decisiones | Tocar ficheros, PR o etiquetas de estado; crear o cerrar issues |
| product-manager | opus | Crear y editar issues, cerrar milestones | Modificar ficheros o git; gestionar PR; cerrar issues |
| developer-teams | sonnet (effort high) | Código, ramas, PR, fusionar | Commit o push en `main`, rebase, push forzado, fusionar sin `estado:validado`, cerrar issues |
| qa-teams | sonnet (effort high) | Descargar la PR, ejecutar pruebas, comentar | Modificar ficheros o git; fusionar; crear o cerrar issues |
| doc-teams | sonnet | Editar `README.md`, `INDEX.md` y `docs/user/`; commit en `main` | Editar cualquier otro fichero; trabajar fuera de `main` |

Además, **ningún rol** puede editar `CLAUDE.md`, `CONTEXT.md`, `.claude/`, `docs/process/` ni `docs/product/`, ni escribir fuera del proyecto.

> El hook previene errores de los agentes, no ataques deliberados: un comando envuelto en `bash -c "…"` podría eludirlo.

## Modificar la configuración

Los scripts de `scripts/setup/` son la **fuente de verdad** de la configuración. Para que un cambio sobreviva a una reinstalación, haz el cambio en el script y relánzalo:

| Quiero cambiar… | Edita | Y ejecuta |
|---|---|---|
| Etiquetas o milestones | Listas `ETIQUETAS` / `MILESTONES` de `01-etiquetas.sh` | `./scripts/setup/01-etiquetas.sh` |
| Comandos permitidos | `ALLOW_BASE`, `ALLOW_STACK` o `DENY` de `02-permisos.sh` | `./scripts/setup/02-permisos.sh` |
| Reglas comunes del flujo | Bloque `CONTENIDO_FLUJO` de `03-flujo-trabajo.sh` | `./scripts/setup/03-flujo-trabajo.sh --force` |
| Prompt, modelo o herramientas de un rol | Bloque `AGENTE_<ROL>` de `04-agentes.sh` | `./scripts/setup/04-agentes.sh --force <rol>` |
| Reglas del hook | Bloque `GUARD_PY` de `04-agentes.sh` | `./scripts/setup/04-agentes.sh --force` |

Si editas directamente `.claude/agents/*.md` o `docs/process/FLUJO_DE_TRABAJO.md`, el cambio funciona, pero el script dejará de coincidir: al relanzarlo te avisará de que hay cambios propios y no los tocará. Con `--force` los sobrescribirá (guardando una copia `.bak`).

Tras cambiar agentes o el hook, abre una sesión nueva de Claude Code.

## Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| `@orquestador` no aparece en el autocompletado | La sesión se abrió antes de crear `.claude/agents/`. Sal y vuelve a entrar. |
| `/list-agents` no muestra los agentes | Es normal: muestra agentes **en ejecución**, no los definidos. Usa `./scripts/rol.sh --list`. |
| `claude agents` abre un panel de sesiones | En las versiones recientes es el gestor de sesiones en segundo plano, no un listado de agentes. |
| `ERROR: gh no autenticado` | Falta `GITHUB_PAT` en `.env` o el token ha caducado. |
| `Ya hay otra ejecución de rol.sh en curso` | Otra ejecución tiene el bloqueo. Espera a que termine; si no hay ninguna, borra `logs/.rol.lock`. |
| Un agente se queda pidiendo permiso para un comando | El comando no está en `.claude/settings.json`. Añádelo con `02-permisos.sh` si es legítimo. |
| `Bloqueado por guard (<rol>): …` | El hook ha impedido una acción prohibida. Normalmente el agente corrige solo; si se repite, revisa si la regla del hook es demasiado estricta. |
| El orquestador para con «la transición no se produjo» | Revisa la issue y el resumen del subagente. Corrige la situación (etiqueta, PR) y relanza. |
| Hay más de una issue en curso | El flujo se ha desviado. Deja una sola con etiqueta `estado:*` de trabajo y relanza. |
| Quiero ver qué ha hecho un agente concreto | Ejecución desatendida: `logs/`. Interactiva: el historial de la sesión. Siempre: los comentarios `Rol: …` en GitHub. |

## Ficheros del sistema

```
.claude/
├── settings.json          permisos (02-permisos.sh)
├── agents/                definición de cada rol (04-agentes.sh)
│   ├── orquestador.md
│   ├── product-manager.md
│   ├── developer-teams.md
│   ├── qa-teams.md
│   └── doc-teams.md
└── hooks/
    ├── guard.sh           punto de entrada del hook (04-agentes.sh)
    └── guard.py           reglas de protección por rol
docs/
├── process/
│   └── FLUJO_DE_TRABAJO.md   reglas comunes (03-flujo-trabajo.sh)
└── technical/
    └── ARQUITECTURA.md        decisiones técnicas (lo crea developer-teams)
scripts/
├── README.md              este documento
├── rol.sh                 lanzador
└── setup/                 instalación, en orden
    ├── 01-etiquetas.sh
    ├── 02-permisos.sh
    ├── 03-flujo-trabajo.sh
    └── 04-agentes.sh
logs/                      salida de las ejecuciones --auto (no se sube a git)
.env                       credenciales (no se sube a git)
```

### Pendiente

- **Auditorías periódicas** (`quality-auditor` y `security-auditor`) lanzadas por cron, fuera del ciclo del orquestador.