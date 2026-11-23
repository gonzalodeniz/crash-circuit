# Desarrollo con subagentes de Claude Code

Este proyecto se desarrolla con un equipo de subagentes de Claude Code coordinados por un orquestador. Los agentes forman un **kit portable**: son iguales en cualquier proyecto, y todo lo específico vive en `docs/project/` y `docs/product/`. Este documento explica cómo instalar el kit, cómo usarlo a diario, cómo añadir funcionalidades nuevas y cómo intervenir cuando te necesita.

> El `README.md` de la raíz describe el producto y lo mantiene `doc-teams`. Este documento trata solo del sistema de agentes.

## Índice

1. [Cómo funciona](#cómo-funciona)
2. [Kit y proyecto](#kit-y-proyecto)
3. [Requisitos](#requisitos)
4. [Instalación](#instalación)
5. [Uso diario](#uso-diario)
6. [Añadir funcionalidades nuevas](#añadir-funcionalidades-nuevas)
7. [Tu papel: decisiones y aceptación de entregas](#tu-papel-decisiones-y-aceptación-de-entregas)
8. [Estados de una issue](#estados-de-una-issue)
9. [Qué puede y qué no puede hacer cada rol](#qué-puede-y-qué-no-puede-hacer-cada-rol)
10. [Modificar la configuración](#modificar-la-configuración)
11. [Solución de problemas](#solución-de-problemas)
12. [Ficheros del sistema](#ficheros-del-sistema)

## Cómo funciona

```
                 ┌──────────────┐
                 │ orquestador  │  lee las etiquetas de las issues y delega
                 └──────┬───────┘
     ┌──────────────┬───┴──────────┬──────────────┐
     ▼              ▼              ▼              ▼
product-manager  developer-teams  qa-teams      doc-teams
crea issues      implementa,      valida la PR  documenta lo
por cobertura    abre PR, fusiona               fusionado
```

- **GitHub es el estado compartido.** Cada issue abierta lleva una etiqueta `estado:*` que indica en qué punto está. Los subagentes no se hablan entre sí: se comunican mediante issues, PR y comentarios con plantillas fijas.
- **El orquestador** aplica la primera regla que se cumple (decisiones pendientes → fusionar → corregir → validar → continuar → documentar → empezar → product-manager), delega en un subagente, comprueba que la transición se ha producido y repite.
- **Una sola issue en curso** en todo el proyecto. El trabajo avanza en serie.
- **Las entregas siguen el roadmap**, con un milestone de GitHub por entrega. `product-manager` crea los milestones y las issues que falten comparando el roadmap con las issues existentes (**cobertura**).
- **Tú intervienes** cuando un agente necesita una decisión y al final de cada entrega, para aceptarla tras comprobarla.
- **Los auditores van aparte.** `security-auditor` y `quality-auditor` no forman parte del ciclo: los lanzas tú o cron, y dejan cada hallazgo como una issue `tipo:tecnica` que `product-manager` prioriza por severidad (ver [Auditorías](#auditorías)).

Las reglas completas están en `docs/process/FLUJO_DE_TRABAJO.md`.

## Kit y proyecto

| Capa | Ficheros | ¿Cambia entre proyectos? |
|---|---|---|
| **Kit** | `CLAUDE.md`, `.claude/agents/`, `.claude/hooks/`, `docs/process/`, `scripts/` | No. Se copia tal cual con `03-kit.sh`. |
| **Contrato del proyecto** | `docs/project/PERFIL.md` y `docs/project/proyecto.json` | Sí. Se escribe una vez por proyecto. |
| **Producto** | `docs/product/` | Sí. Es la fuente de verdad y la mantienes tú. |
| **Generado** | `.claude/settings.json` | Lo genera `02-permisos.sh` a partir de `proyecto.json`. |

- **`PERFIL.md`** contiene en prosa las reglas que aplican los agentes: producto, idioma, fuentes de verdad y formato de los IDs, restricciones, modelo de dominio, configuración, base técnica, comprobaciones obligatorias, verificación manual, documentación de usuario y nombre de las entregas. Sus títulos de sección son fijos, porque los agentes los citan. `CLAUDE.md` lo importa, así que todos los agentes lo tienen siempre en contexto.
- **`proyecto.json`** contiene lo que leen las máquinas:

  | Clave | Quién la usa | Para qué |
  |---|---|---|
  | `nombre` | `03-kit.sh --comprobar` | Detectar el nombre del proyecto dentro del kit. |
  | `rutas_protegidas` | hook `guard.py` | Rutas propias que ningún rol puede editar (se suman a las del kit). |
  | `rutas_doc_teams` | hook `guard.py` | Únicas rutas que puede editar `doc-teams`. |
  | `permisos_extra` | `02-permisos.sh` | Comandos del stack que se añaden a `settings.json`. |
  | `terminos_no_portables` | `03-kit.sh --comprobar` | Palabras del proyecto que no deben aparecer en el kit. |

Para comprobar que el kit sigue siendo portable: `./scripts/setup/03-kit.sh --comprobar`.

## Requisitos

| Herramienta | Comprobación |
|---|---|
| Claude Code ≥ 2.1 | `claude --version` |
| GitHub CLI | `gh --version` |
| git, python3, flock | `git --version && python3 --version && flock --version` |
| Las herramientas del stack del proyecto | ver `COMMANDS.md` |
| Repositorio en GitHub con remoto `origin` | `git remote -v` |

**Credenciales de GitHub:** crea un fichero `.env` en la raíz (no se sube a git) con un token que tenga permisos sobre issues, PR y contenido del repositorio:

```bash
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxx
```

`scripts/orquestador.sh` lo carga y lo exporta como `GH_TOKEN`. Si prefieres no usar `.env`, ejecuta `gh auth login` una vez.

## Instalación

### En un proyecto nuevo

Desde un repositorio que ya tenga el kit:

```bash
./scripts/setup/03-kit.sh --destino /ruta/otro-proyecto --dry-run   # revisa qué hará
./scripts/setup/03-kit.sh --destino /ruta/otro-proyecto
```

Copia el kit y crea desde plantillas, solo si no existen, `docs/project/PERFIL.md`, `docs/project/proyecto.json`, `INDEX.md` y `COMMANDS.md`. Después, en el proyecto nuevo:

1. Rellena `docs/project/PERFIL.md` sin cambiar los títulos de las secciones.
2. Rellena `docs/project/proyecto.json`.
3. Escribe `docs/product/`: visión, requisitos con IDs estables y un roadmap en el que cada entrega lleve una línea `**Requisitos:** …`.
4. Ejecuta los scripts de configuración:
   ```bash
   ./scripts/setup/01-etiquetas.sh --dry-run && ./scripts/setup/01-etiquetas.sh   # etiquetas en GitHub
   ./scripts/setup/02-permisos.sh                                              # .claude/settings.json
   ./scripts/setup/03-kit.sh --comprobar                                       # portabilidad
   git add -A && git commit -m "[setup] Instala el flujo de subagentes" && git push
   ```
5. **Abre una sesión nueva** de Claude Code: las sesiones que ya estaban abiertas no detectan los agentes.

Todos los scripts son **idempotentes**: puedes relanzarlos sin duplicar nada, y no sobrescriben ficheros que hayas editado salvo que uses `--force` (en ese caso guardan una copia `.bak`).

Los milestones no se crean en la instalación: los crea `product-manager` a partir del roadmap la primera vez que se ejecuta.

### Comprobar la instalación

```bash
./scripts/orquestador.sh --list      # debe listar los siete roles
claude                       # y en el prompt escribe @orq: debe aparecer "orquestador (agent)"
```

## Uso diario

Todo se lanza con `scripts/orquestador.sh`:

| Comando | Qué hace |
|---|---|
| `./scripts/orquestador.sh` | Orquestador en sesión **interactiva**: ves cada delegación y puedes responder decisiones en el momento. |
| `./scripts/orquestador.sh --max 3` | Igual, pero se detiene tras 3 delegaciones. |
| `./scripts/orquestador.sh --auto` | Orquestador **desatendido** (máximo 30 delegaciones). La salida queda en `logs/orquestador-<fecha>.log`. |
| `./scripts/orquestador.sh --auto --max 5` | Desatendido con un límite propio. |
| `./scripts/orquestador.sh qa-teams` | Sesión interactiva directamente con un rol, sin orquestador. Útil para depurar. |
| `./scripts/orquestador.sh --auto qa-teams "Valida la issue #12"` | Un rol concreto, desatendido, con una tarea. |
| `./scripts/orquestador.sh security-auditor` | Auditoría de seguridad completa, en sesión interactiva. |
| `./scripts/orquestador.sh --auto security-auditor` | Auditoría de seguridad desatendida, con log en `logs/`. Es la forma de lanzarla desde cron. |
| `./scripts/orquestador.sh quality-auditor` | Auditoría de calidad de código completa, en sesión interactiva. |
| `./scripts/orquestador.sh --auto quality-auditor` | Auditoría de calidad desatendida, con log en `logs/`. Es la forma de lanzarla desde cron. |
| `./scripts/orquestador.sh --list` | Roles disponibles. |

Cualquier texto que no sea un rol se envía como mensaje al orquestador:

```bash
./scripts/orquestador.sh "Ejecuta el ciclo, pero no empieces issues nuevas"
```

**Recomendaciones:**

- Empieza en modo interactivo con `--max` bajo hasta confiar en el comportamiento de cada rol.
- Al comenzar una entrega, lanza `./scripts/orquestador.sh --max 1`: solo creará las issues, y podrás revisarlas en GitHub antes de que empiece el desarrollo.
- El lanzador usa un bloqueo: si ya hay una ejecución en curso, la segunda termina con código 3 sin hacer nada.

### Auditorías

Hay dos auditores. Ninguno corrige, valida, prioriza ni cierra nada.

| Auditor | Qué revisa | Issues que crea |
|---|---|---|
| `security-auditor` | Código, configuración, secretos, dependencias, validación de entradas, exposición de datos sensibles y hardening. | `Seguridad · …` con `tipo:tecnica` y `origen:security-auditor`. |
| `quality-auditor` | Complejidad, duplicación, nomenclatura, diseño (SOLID, patrones y antipatrones), tamaño, cobertura y calidad de las pruebas, deuda técnica, convenciones, documentación técnica y eficiencia. Ejecuta las pruebas para medir la cobertura. | `Calidad · …` con `tipo:tecnica` y `origen:quality-auditor`, con alcance del cambio y esfuerzo orientativo. |

Cada hallazgo lleva los campos `Severidad:` (`critica`, `alta`, `media` o `baja`), `Categoria:`, `Descripcion:`, `Evidencia:` y `Recomendacion:`.

- **Prioridad:** la próxima vez que se ejecute, `product-manager` mete las `critica` y `alta` en la entrega en curso con `estado:nuevo`, y deja las `media` y `baja` para la entrega siguiente.
- **Sin duplicados:** si un hallazgo ya tiene issue abierta, el auditor comenta en ella en vez de crear otra.
- **Si te necesita:** un hallazgo de seguridad `critica` que exige algo que solo puedes hacer tú (por ejemplo, rotar una credencial expuesta) llega con `requiere-decision`.
- **Informe:** al terminar, cada auditor resume las áreas revisadas, los hallazgos, las métricas, las limitaciones y la tendencia respecto a su auditoría anterior. En modo `--auto` queda en `logs/<auditor>-<fecha>.log`.

Para lanzarlas por cron (por ejemplo, los lunes a las 3:00 y a las 4:00), añade con `crontab -e`:

```cron
0 3 * * 1  cd /ruta/al/proyecto && PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin ./scripts/orquestador.sh --auto security-auditor
0 4 * * 1  cd /ruta/al/proyecto && PATH=/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin ./scripts/orquestador.sh --auto quality-auditor
```

Ajusta `PATH` para que incluya `claude` y `gh`. Separa las horas: si a esa hora hay otra ejecución en curso, el lanzador termina con código 3 sin hacer nada.

### Dónde ver lo que ha pasado

- **Resumen final del orquestador:** delegaciones hechas, estado actual, decisiones y verificaciones pendientes, y motivo de parada.
- **GitHub:** issues (estado y comentarios), PR (handoffs de desarrollo y resultados de QA) y milestones.
- **`logs/`:** salida completa de las ejecuciones desatendidas.

## Añadir funcionalidades nuevas

`product-manager` no necesita que le digas qué ha cambiado. Cada vez que se ejecuta compara el roadmap con las issues de cada milestone y crea solo lo que falta. Para una funcionalidad nueva o una release nueva:

1. **Requisitos:** añádelos al documento de requisitos con **IDs nuevos**. Nunca reutilices un ID. Si cambias un requisito ya entregado, márcalo en el propio requisito (p. ej. «Modificado en E9») en vez de reescribirlo sin dejar rastro.
2. **Roadmap:** añade una entrega nueva **al final**, con su objetivo, su criterio de entrega y su línea de requisitos:
   ```markdown
   ## E9 — <nombre>

   **Requisitos:** RF-101, RF-102, RF-120 (modificado)

   **Criterio de entrega:** …
   ```
   También puedes añadir IDs a una entrega que todavía no hayas aceptado.
3. **Ejecuta el orquestador.** Cuando no quede trabajo en curso, delegará en `product-manager`, que:
   - crea el milestone de la entrega nueva;
   - calcula la cobertura (IDs de la entrega menos IDs ya citados en sus issues);
   - crea las issues que falten, con `estado:nuevo`.

Reglas que aplica `product-manager`:

- Una entrega aceptada (milestone cerrado) **no se reabre**. Si añades IDs a una entrega ya aceptada, te pregunta en qué entrega nueva deben ir.
- Si un requisito no aparece en ninguna entrega, o una entrega cita un ID que no existe, abre una issue `Decisión de producto: planificación del roadmap` con su propuesta y espera tu respuesta.
- Una entrega nueva no empieza hasta aceptar la anterior: la entrega en curso es siempre la primera, en el orden del roadmap, con el milestone abierto.

## Tu papel: decisiones y aceptación de entregas

### Decisiones (`requiere-decision`)

Cuando un agente encuentra una contradicción en los documentos de producto o algo que no le corresponde decidir, deja en la issue un comentario con una `Pregunta:` y la etiqueta `requiere-decision`. El orquestador salta esa issue y sigue con el resto; se detiene si bloquea la issue en curso, una aceptación o todo el trabajo restante.

Puedes responder de dos formas:

- **En la sesión interactiva:** el orquestador te presenta la pregunta. Al responder, registra tu respuesta en la issue (`Decisión del usuario: …`), retira la etiqueta y continúa.
- **En GitHub:** responde en la issue con un comentario y retira tú la etiqueta `requiere-decision`. En la siguiente ejecución, el flujo continúa.

Si la decisión implica cambiar los documentos de producto, actualízalos tú: ningún agente puede modificarlos.

### Aceptación de una entrega

Los agentes no pueden comprobar lo que solo se ve usando el producto. Cuando se cierran todas las issues de una entrega, `product-manager` crea la issue **«Aceptación de la entrega <ID>»** con:

- el criterio de entrega del roadmap,
- las issues que la componen,
- todas las *verificaciones manuales pendientes* que QA fue anotando,
- todos los *supuestos* que tomaron los agentes.

Comprueba la entrega siguiendo esa lista y responde:

- **Aceptada:** `product-manager` cierra el milestone y pasa a la entrega siguiente. Cierra tú la issue de aceptación.
- **No aceptada:** indica qué falta; `product-manager` creará las issues correspondientes en esa misma entrega.

### Permisos de comandos nuevos

Si `developer-teams` incorpora una herramienta cuyo comando no está permitido, lo indica en su handoff con la regla exacta (por ejemplo `Bash(make *)`). Añádela a `permisos_extra` de `docs/project/proyecto.json` y relanza `./scripts/setup/02-permisos.sh`.

## Estados de una issue

```
nuevo ──► en-desarrollo ──► listo-para-qa ──► validado ──► (fusionada y cerrada)
                                 ▲     │                         │
                                 │     ▼                         ▼
                                 └─ no-validado          impacto-documental  ──► doc-teams
                                                         changelog-pendiente ──► doc-teams
```

| Etiqueta | Significado | Siguiente rol |
|---|---|---|
| `estado:nuevo` | Lista para empezar | developer-teams |
| `estado:en-desarrollo` | Rama y PR en borrador abiertas | developer-teams |
| `estado:listo-para-qa` | Handoff publicado en la PR | qa-teams |
| `estado:no-validado` | QA ha encontrado defectos bloqueantes | developer-teams |
| `estado:validado` | QA aprueba | developer-teams (fusiona) |
| `impacto-documental` | Al cerrarse, hay que documentar | doc-teams |
| `changelog-pendiente` | Fusionada; hay que anotarla en `CHANGELOG.md` | doc-teams |
| `requiere-decision` | Bloqueada esperando tu respuesta | tú |
| `tipo:tecnica` | Deuda técnica o hallazgo de auditoría | product-manager la prioriza |
| `origen:security-auditor` | Hallazgo de la auditoría de seguridad (va junto a `tipo:tecnica`) | product-manager la prioriza |
| `origen:quality-auditor` | Hallazgo de la auditoría de calidad (va junto a `tipo:tecnica`) | product-manager la prioriza |

Si una misma issue recibe **3 rechazos de QA**, el orquestador se detiene y te pregunta cómo seguir.

## Qué puede y qué no puede hacer cada rol

Las restricciones no dependen solo del prompt: el hook `.claude/hooks/guard.py` bloquea las acciones prohibidas antes de que se ejecuten y le explica el motivo al agente.

| Rol | Modelo | Puede | El hook le impide |
|---|---|---|---|
| orquestador | sonnet | Leer GitHub, delegar, registrar tus decisiones | Tocar ficheros, PR o etiquetas de estado; crear o cerrar issues |
| product-manager | opus | Crear y editar issues, crear y cerrar milestones | Modificar ficheros o git; gestionar PR; cerrar issues |
| developer-teams | sonnet (effort high) | Código, ramas, PR, fusionar | Commit o push en `main`, rebase, push forzado, fusionar sin `estado:validado`, cerrar issues |
| qa-teams | sonnet (effort high) | Descargar la PR, ejecutar pruebas, comentar | Modificar ficheros o git; fusionar; crear o cerrar issues |
| doc-teams | sonnet | Editar las rutas de `rutas_doc_teams`; commit en `main` | Editar cualquier otro fichero; trabajar fuera de `main` |
| security-auditor | opus (effort high) | Leer el repositorio y su historial, consultar dependencias (`npm audit`), crear issues y comentar en ellas | Modificar ficheros o git; instalar, actualizar o ejecutar paquetes; editar, cerrar o reabrir issues; actuar sobre PR |
| quality-auditor | opus (effort high) | Leer el repositorio y su historial, ejecutar las pruebas (`npm test`, cobertura sin escribir ficheros), crear issues y comentar en ellas | Lo mismo que security-auditor, incluido el build |

Además, **ningún rol** puede editar `CLAUDE.md`, `.claude/`, `docs/process/`, `docs/project/` ni las rutas de `rutas_protegidas`, ni escribir fuera del proyecto.

> El hook analiza cada orden del comando (también las que van tras saltos de línea o dentro de `bash -c`, `eval` y `$(…)`), pero previene errores de los agentes, no ataques deliberados: por ejemplo, un script de Python o Node que escriba ficheros no se detecta.

## Modificar la configuración

Cada fichero es su propia fuente de verdad: edítalo directamente.

| Quiero cambiar… | Edita | Y después |
|---|---|---|
| Reglas del proyecto (stack, dominio, comprobaciones, documentación…) | `docs/project/PERFIL.md` | Nada: se aplica en la siguiente sesión. |
| Rutas protegidas o rutas de doc-teams | `docs/project/proyecto.json` | Nada: el hook lo lee en cada llamada. |
| Comandos permitidos del stack | `permisos_extra` de `docs/project/proyecto.json` | `./scripts/setup/02-permisos.sh` |
| Permisos base o denegaciones | `ALLOW_BASE`, `ALLOW_UTILIDADES` o `DENY` de `02-permisos.sh` | `./scripts/setup/02-permisos.sh` |
| Etiquetas | Lista `ETIQUETAS` de `01-etiquetas.sh` | `./scripts/setup/01-etiquetas.sh` |
| Reglas comunes del flujo | `docs/process/FLUJO_DE_TRABAJO.md` | Copiar el kit a los demás proyectos. |
| Prompt, modelo o herramientas de un rol | `.claude/agents/<rol>.md` | Copiar el kit a los demás proyectos. |
| Reglas del hook | `.claude/hooks/guard.py` | Copiar el kit a los demás proyectos. |

Si cambias el kit, mantenlo genérico: lo que sea propio del proyecto va en `PERFIL.md`. Comprueba con `./scripts/setup/03-kit.sh --comprobar` y lleva el cambio a los demás proyectos con `03-kit.sh --destino <ruta> --force`.

Tras cambiar agentes, el hook o `CLAUDE.md`, abre una sesión nueva de Claude Code.

## Solución de problemas

| Síntoma | Causa probable y solución |
|---|---|
| `@orquestador` no aparece en el autocompletado | La sesión se abrió antes de crear `.claude/agents/`. Sal y vuelve a entrar. |
| `/list-agents` no muestra los agentes | Es normal: muestra agentes **en ejecución**, no los definidos. Usa `./scripts/orquestador.sh --list`. |
| `ERROR: gh no autenticado` | Falta `GITHUB_PAT` en `.env` o el token ha caducado. |
| `Ya hay otra ejecución de orquestador.sh en curso` | Otra ejecución tiene el bloqueo. Espera a que termine; si no hay ninguna, borra `logs/.orquestador.lock`. |
| Un agente se queda pidiendo permiso para un comando | Si es de Bash, `.claude/settings.json` está desactualizado: relanza `02-permisos.sh`, que permite todo Bash salvo la lista `deny`. Si es de otra herramienta, añade la regla a `permisos_extra` y relanza el script. Para ejecuciones desatendidas usa `orquestador.sh --auto`: nunca se queda esperando una respuesta. |
| `Bloqueado por guard (<rol>): …` | El hook ha impedido una acción prohibida. Normalmente el agente corrige solo; si se repite, revisa si la regla del hook o `proyecto.json` es demasiado estricta. |
| `product-manager` no crea issues para una funcionalidad nueva | Falta la línea `**Requisitos:**` en la entrega, los IDs no existen en el documento de requisitos o la entrega anterior no está aceptada. Revisa la issue `Decisión de producto: planificación del roadmap`. |
| El orquestador para con «la transición no se produjo» | Revisa la issue y el resumen del subagente. Corrige la situación (etiqueta, PR) y relanza. |
| Hay más de una issue en curso | El flujo se ha desviado. Deja una sola con etiqueta `estado:*` de trabajo y relanza. |
| `03-kit.sh --comprobar` falla | Alguien ha escrito algo del proyecto en el kit. Muévelo a `docs/project/PERFIL.md`. |

## Ficheros del sistema

```
CLAUDE.md                  punto de entrada del kit; importa el perfil y el flujo
.claude/
├── settings.json          permisos (generado por 02-permisos.sh)
├── agents/                definición genérica de cada rol
│   ├── orquestador.md
│   ├── product-manager.md
│   ├── developer-teams.md
│   ├── qa-teams.md
│   ├── doc-teams.md
│   ├── security-auditor.md
│   └── quality-auditor.md
└── hooks/
    ├── guard.sh           punto de entrada del hook
    └── guard.py           reglas de protección por rol
docs/
├── process/
│   └── FLUJO_DE_TRABAJO.md   reglas comunes (kit)
├── project/
│   ├── PERFIL.md             reglas del proyecto para los agentes
│   └── proyecto.json         rutas y permisos del proyecto
├── product/                  fuente de verdad del producto
└── technical/
    └── ARQUITECTURA.md        decisiones técnicas (lo crea developer-teams)
scripts/
├── README.md              este documento
├── orquestador.sh         lanzador
└── setup/
    ├── 01-etiquetas.sh    etiquetas del flujo en GitHub
    ├── 02-permisos.sh     genera .claude/settings.json
    ├── 03-kit.sh          copia el kit a otro proyecto y comprueba su portabilidad
    └── plantillas/        PERFIL.md, proyecto.json, INDEX.md y COMMANDS.md de partida
logs/                      salida de las ejecuciones --auto (no se sube a git)
.env                       credenciales (no se sube a git)
```
