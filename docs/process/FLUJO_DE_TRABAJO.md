# Flujo de trabajo con subagentes

Reglas comunes a todos los roles. Cada rol tiene además sus instrucciones en `.claude/agents/<rol>.md`. Si este documento y el de un rol se contradicen, prevalece este y el rol debe señalarlo como bloqueo (ver «Preguntas y bloqueos»).

## Roles

| Rol | Responsabilidad | Nunca hace |
|---|---|---|
| `orquestador` | Lee el estado de las issues y delega en el rol que corresponda. | Implementar, validar, documentar ni decidir producto. |
| `product-manager` | Convierte `docs/product/` en issues ejecutables, por entregas del roadmap (E1…E8). | Escribir código. Cambiar `docs/product/` sin autorización del usuario. |
| `developer-teams` | Implementa una issue, abre la PR, corrige tras QA y fusiona cuando está validada. | Fusionar sin `estado:validado`. Trabajar en dos issues a la vez. |
| `qa-teams` | Valida la PR contra los criterios de aceptación y los `RF`/`RN`/`CA` referenciados. | Modificar código, fusionar ni cerrar issues. |
| `doc-teams` | Actualiza `README.md` y la documentación de usuario (`docs/user/`) tras una fusión con impacto documental. | Modificar código, `docs/product/` ni `docs/technical/`. |
| `quality-auditor`, `security-auditor` | Auditorías periódicas (cron), fuera del ciclo del orquestador. Sus hallazgos se convierten en issues `tipo:tecnica`. | Implementar correcciones. |

## Estados de una issue (etiquetas)

Cada issue abierta tiene **exactamente una** etiqueta `estado:*`. Quien produce la transición cambia la etiqueta en el mismo paso:

```bash
gh issue edit <N> --remove-label "estado:<actual>" --add-label "estado:<nuevo>"
```

| Estado | Siguiente rol | Transición que produce |
|---|---|---|
| (sin issues abiertas en la entrega en curso) | `product-manager` | Crea las issues de la siguiente entrega con `estado:nuevo`. |
| `estado:nuevo` | `developer-teams` | → `estado:en-desarrollo` (crea rama y PR en borrador). |
| `estado:en-desarrollo` | `developer-teams` | Continúa → `estado:listo-para-qa` (PR lista para revisión). |
| `estado:listo-para-qa` | `qa-teams` | → `estado:validado` o `estado:no-validado`. |
| `estado:no-validado` | `developer-teams` | Corrige en la misma rama y PR → `estado:listo-para-qa`. |
| `estado:validado` | `developer-teams` | Fusiona la PR (squash) y borra la rama; la issue se cierra sola. |
| Issue cerrada con `impacto-documental` | `doc-teams` | Documenta y retira la etiqueta `impacto-documental`. |
| `requiere-decision` (cualquier estado) | Usuario | El orquestador se detiene y presenta la pregunta. |
| `Aceptación de la entrega Ek` respondida (sin `requiere-decision`) | `product-manager` | Cierra el milestone o crea issues para lo que falta. |
| `Decisión de producto: …` respondida (sin `requiere-decision`) | `product-manager` | Aplica la decisión a las issues afectadas. |

Prioridad del orquestador, de mayor a menor: `requiere-decision` → decisiones respondidas → `validado` → `no-validado` → `listo-para-qa` → `en-desarrollo` → documentación pendiente → `nuevo` → crear issues nuevas.

Las issues abiertas sin etiqueta `estado:*` ni `requiere-decision` (por ejemplo, una aceptación de entrega ya tramitada o una issue técnica aplazada) no generan trabajo.

Solo hay **una issue en desarrollo a la vez** en todo el proyecto.

## Contenido mínimo de una issue

Una issue no puede pasar a desarrollo si le falta alguno de estos apartados:

```markdown
**Entrega:** E1
**Requisitos:** RF-009, RF-010, RF-011
**Reglas de negocio:** RN-01 (o «ninguna»)
**Descripción:** qué debe poder hacer el jugador al terminar esta issue.
**Criterios de aceptación:**
- [ ] Criterio verificable 1
- [ ] Criterio verificable 2
**Casos de aceptación relacionados:** CA-01 (o «ninguno»)
**Dependencias:** #12 (o «ninguna»)
**Fuera de alcance:** lo que explícitamente no se hace aquí.
```

Cada issue se asigna al milestone de su entrega (`E1`, `E2`…).

## Ramas, commits y PR

- Rama por issue: `feat/<N>-<slug>` (o `fix/<N>-<slug>`), creada desde `main` actualizado.
- Commits en inglés con prefijo del rol y referencia a la issue: `[developer-teams] Add checkpoint-based lap validation (#12)`.
- Una PR por issue, con `Closes #<N>` en la descripción. Se abre en borrador al empezar y se marca lista al pasar a QA.
- La PR se sincroniza con `main` antes de cada paso a QA.
- Fusión siempre con *squash* y borrado de la rama: `gh pr merge <PR> --squash --delete-branch`.
- `main` no recibe commits directos, salvo los de `product-manager` y `doc-teams` sobre documentación.

## Comentarios estructurados

Todo comentario en issues o PR empieza con `Rol: <rol>`. Los textos de issues y comentarios van en español; el código y los commits, en inglés (ver `CLAUDE.md`).

**Handoff de `developer-teams` a QA** (comentario en la PR):

```markdown
Rol: developer-teams
Issue: #<N>
Resumen: …
Criterios cubiertos: lista de criterios de la issue y cómo se cumplen
Pruebas ejecutadas: comandos de COMMANDS.md y resultado
Verificación manual sugerida: pasos para comprobarlo jugando (o «ninguna»)
Decisiones relevantes: …
Arquitectura: ARQUITECTURA.md actualizado|sin cambios
Limitaciones y deuda técnica: … (o «ninguna»)
Impacto documental: sí|no
```

Si `Impacto documental: sí`, añade también la etiqueta `impacto-documental` a la issue.

**Resultado de `qa-teams`** (comentario en la PR):

```markdown
Rol: qa-teams
Issue: #<N>
Resultado: validado|no validado
Criterios: ✅/❌ por cada criterio de aceptación, con evidencia
Pruebas ejecutadas: comandos y resultado
Defectos bloqueantes: … (o «ninguno»)
Observaciones no bloqueantes: …
Verificación manual pendiente: lo que solo puede comprobarse jugando (o «ninguna»)
```

## Preguntas y bloqueos

`CLAUDE.md` pide preguntar al usuario ante dudas o contradicciones. Un subagente no puede hablar con el usuario, así que:

1. Comenta en la issue con `Rol: <rol>` y un apartado `Pregunta:` concreto, con las opciones que ves y su consecuencia.
2. Añade la etiqueta `requiere-decision`.
3. Termina tu ejecución e informa del bloqueo en tu respuesta final.

El orquestador no delega en ninguna issue con `requiere-decision` y presenta la pregunta al usuario. Cuando el usuario responde, el orquestador registra la respuesta en la issue con un comentario `Rol: orquestador` y un apartado `Decisión del usuario:` literal, retira la etiqueta y el flujo continúa. El usuario también puede responder directamente en GitHub y retirar él mismo la etiqueta.

No decidas por tu cuenta nada que contradiga `docs/product/`. Los valores marcados como «propuesta» en los requisitos sí pueden usarse como punto de partida, siempre en el módulo de configuración.

## Ficheros protegidos

- `CLAUDE.md`, `.claude/**` y `docs/process/FLUJO_DE_TRABAJO.md`: solo con autorización explícita del usuario.
- `docs/product/**`: fuente de verdad; ningún rol la modifica sin autorización.
- `docs/technical/ARQUITECTURA.md`: decisiones técnicas (stack, estructura de carpetas, módulos y responsabilidades, módulo de configuración, estrategia de pruebas). Lo crea `developer-teams` en la issue de base técnica de E1 y lo actualiza en la misma PR que cambie cualquiera de esas decisiones. `qa-teams` comprueba que el código coincide con él.
- `INDEX.md` y `COMMANDS.md`: cualquier rol que cree, mueva o borre ficheros, o verifique un comando nuevo, los actualiza en el mismo cambio.
- Cuando se incorpore una herramienta nueva (build, test, lint), `developer-teams` la añade a `COMMANDS.md` e indica en su handoff que hay que permitir el comando en `.claude/settings.json`.
