# Flujo de trabajo con subagentes

Reglas comunes a todos los roles. Forman parte del kit de agentes y son iguales en todos los proyectos: lo específico del proyecto está en `docs/project/PERFIL.md`. Cada rol tiene además sus instrucciones en `.claude/agents/<rol>.md`. Si este documento y el de un rol se contradicen, prevalece este: el rol lo sigue y anota la contradicción como `Supuesto:` en su comentario, sin bloquear. Si el perfil y este documento se contradicen, prevalece este en el proceso y el perfil en lo relativo al producto.

## Roles

| Rol | Responsabilidad | Nunca hace |
|---|---|---|
| `orquestador` | Lee el estado de las issues y delega en el rol que corresponda. | Implementar, validar, documentar ni decidir producto. |
| `product-manager` | Convierte los documentos de producto en issues ejecutables, entrega a entrega, según el roadmap. | Escribir código. Cambiar los documentos de producto sin autorización del usuario. |
| `developer-teams` | Implementa una issue, abre la PR, corrige tras QA y fusiona cuando está validada. | Fusionar sin `estado:validado`. Trabajar en dos issues a la vez. |
| `qa-teams` | Valida la PR contra los criterios de aceptación y los identificadores de requisitos referenciados. | Modificar código, fusionar ni cerrar issues. |
| `doc-teams` | Actualiza la documentación de usuario tras una fusión con impacto documental y anota cada issue terminada en `CHANGELOG.md`. | Modificar código, los documentos de producto ni `docs/technical/`. |
| `quality-auditor`, `security-auditor` | Auditorías periódicas, lanzadas por cron o manualmente, fuera del ciclo del orquestador. Sus hallazgos se convierten en issues `tipo:tecnica` (ver «Auditorías»). | Implementar correcciones, validar, priorizar ni cerrar issues. |

## Entregas y cobertura

- El **roadmap** (ver «Fuentes de verdad» del perfil) define las entregas en orden. Cada entrega tiene un ID, un nombre, un criterio de entrega y una línea `**Requisitos:**` con los IDs que cubre, también los de reglas de negocio, requisitos no funcionales y casos de aceptación. Un ID puede aparecer en varias entregas si se cubre por partes: márcalo con `(parcial)` o `(modificado)`.
- Cada entrega tiene un **milestone** en GitHub cuyo título es el ID de la entrega. Lo crea `product-manager` cuando la entrega aparece en el roadmap.
- La **entrega en curso** es la primera entrega, en el orden del roadmap, cuyo milestone está abierto.
- **Cobertura de una entrega:** los IDs de su línea `**Requisitos:**` menos los IDs citados en las issues de su milestone, abiertas o cerradas. Si el resultado no está vacío, quedan requisitos sin issue y `product-manager` las crea. El cálculo es idempotente: repetirlo no duplica issues.
- Una entrega **aceptada** (milestone cerrado) no se reabre. Los cambios sobre algo ya entregado van en una entrega nueva.

### Funcionalidades nuevas

Para añadir funcionalidades (una release nueva o una ampliación), el usuario:

1. Añade los requisitos nuevos en el documento de requisitos con **IDs nuevos**. Un ID nunca se reutiliza. Si cambia un requisito ya entregado, lo indica en el propio requisito (p. ej. «Modificado en E9») en vez de reescribirlo sin dejar rastro.
2. Añade una entrega nueva **al final** del roadmap, con su línea `**Requisitos:**` y su criterio de entrega, o añade IDs a una entrega que aún no esté aceptada.
3. Ejecuta el orquestador. Cuando no queda trabajo en curso, delega en `product-manager`, que crea el milestone y las issues que falten por cobertura.

Si un requisito no aparece en ninguna entrega, o una entrega cita un ID que no existe, `product-manager` lo trata como una decisión de producto pendiente.

## Estados de una issue (etiquetas)

Cada issue abierta tiene **exactamente una** etiqueta `estado:*`. Quien produce la transición cambia la etiqueta en el mismo paso:

```bash
gh issue edit <N> --remove-label "estado:<actual>" --add-label "estado:<nuevo>"
```

| Estado | Siguiente rol | Transición que produce |
|---|---|---|
| (sin trabajo en curso ni issues `estado:nuevo` disponibles) | `product-manager` | Crea los milestones y las issues que falten por cobertura, con `estado:nuevo`, o prepara la aceptación de la entrega. |
| `estado:nuevo` | `developer-teams` | → `estado:en-desarrollo` (crea rama y PR en borrador). |
| `estado:en-desarrollo` | `developer-teams` | Continúa → `estado:listo-para-qa` (PR lista para revisión). |
| `estado:listo-para-qa` | `qa-teams` | → `estado:validado` o `estado:no-validado`. |
| `estado:no-validado` | `developer-teams` | Corrige en la misma rama y PR → `estado:listo-para-qa`. |
| `estado:validado` | `developer-teams` | Fusiona la PR (squash) y borra la rama; la issue se cierra sola. Le añade `changelog-pendiente`. |
| Issue cerrada con `impacto-documental` | `doc-teams` | Documenta y retira la etiqueta `impacto-documental`. |
| Issue cerrada con `changelog-pendiente` | `doc-teams` | Añade su entrada a `CHANGELOG.md` y retira la etiqueta `changelog-pendiente`. |
| `requiere-decision` (cualquier estado) | Usuario | El orquestador salta esa issue (y las que dependen de ella) y sigue con el resto; se detiene solo si bloquea la issue en curso, una aceptación de entrega o todo el trabajo restante. |
| `Aceptación de la entrega <ID>` respondida (sin `requiere-decision`) | `product-manager` | Cierra el milestone o crea issues para lo que falta. |
| `Decisión de producto: …` respondida (sin `requiere-decision`) | `product-manager` | Aplica la decisión a las issues afectadas. |

Prioridad del orquestador, de mayor a menor: `requiere-decision` → decisiones respondidas → `validado` → `no-validado` → `listo-para-qa` → `en-desarrollo` → documentación pendiente (`impacto-documental` o `changelog-pendiente`) → `nuevo` → `product-manager` (cobertura y aceptación).

Las issues abiertas sin etiqueta `estado:*` ni `requiere-decision` (por ejemplo, una aceptación de entrega ya tramitada o una issue técnica aplazada) no generan trabajo.

Solo hay **una issue en desarrollo a la vez** en todo el proyecto.

## Auditorías

Los auditores se lanzan con `scripts/orquestador.sh <auditor>`, a mano o desde cron (con `--auto`). No entran en el ciclo del orquestador, y el bloqueo del lanzador impide que coincidan con él.

- **Una issue por hallazgo**, con las etiquetas `tipo:tecnica` y `origen:<auditor>`, sin `estado:*` ni milestone. El cuerpo lleva el «Contenido mínimo de una issue» (con `**Requisitos:** ninguno`, para no alterar la cobertura) y el hallazgo con los campos literales `Severidad:`, `Descripcion:`, `Evidencia:` y `Recomendacion:`.
- **Severidad:** solo `critica`, `alta`, `media` o `baja`.
- **Prioridad:** la decide `product-manager` según la severidad: `critica` y `alta` entran en la entrega en curso con `estado:nuevo`; `media` y `baja`, en la entrega siguiente.
- **Sin duplicados:** antes de crear un hallazgo, el auditor busca sus issues anteriores (abiertas y cerradas) y comenta en la existente en vez de repetirla.
- El historial de hallazgos son esas issues: de ellas salen las métricas y la tendencia.

## Contenido mínimo de una issue

Una issue no puede pasar a desarrollo si le falta alguno de estos apartados. Los prefijos de los IDs y el campo en el que va cada uno están en «Fuentes de verdad» del perfil.

```markdown
**Entrega:** <ID de la entrega>
**Requisitos:** <IDs de requisitos; si es parcial: «<ID> (parcial: qué parte)»>
**Reglas de negocio:** <IDs> (o «ninguna»)
**Descripción:** qué debe poder hacer el usuario al terminar esta issue.
**Criterios de aceptación:**
- [ ] Criterio verificable 1
- [ ] Criterio verificable 2
**Casos de aceptación relacionados:** <IDs> (o «ninguno»)
**Dependencias:** #12 (o «ninguna»)
**Fuera de alcance:** lo que explícitamente no se hace aquí.
```

Cada issue se asigna al milestone de su entrega.

## Ramas, commits y PR

- Rama por issue: `feat/<N>-<slug>` (o `fix/<N>-<slug>`), creada desde `main` actualizado.
- Commits con prefijo del rol y referencia a la issue, en el idioma del perfil: `[developer-teams] <verbo en 3.ª persona> … (#12)`.
- Una PR por issue, con `Closes #<N>` en la descripción. Se abre en borrador al empezar y se marca lista al pasar a QA.
- La PR se sincroniza con `main` antes de cada paso a QA.
- Fusión siempre con *squash* y borrado de la rama: `gh pr merge <PR> --squash --delete-branch`.
- `main` no recibe commits directos, salvo los de `doc-teams` sobre documentación.

## Comentarios estructurados

Todo comentario en issues o PR empieza con `Rol: <rol>`. Los textos de issues, comentarios y commits siguen la sección «Idioma» del perfil.

**Handoff de `developer-teams` a QA** (comentario en la PR):

```markdown
Rol: developer-teams
Issue: #<N>
Resumen: …
Criterios cubiertos: lista de criterios de la issue y cómo se cumplen
Pruebas ejecutadas: comandos de COMMANDS.md y resultado
Comprobaciones obligatorias: resultado de cada una (ver perfil)
Verificación manual sugerida: pasos para comprobarlo usando el producto (o «ninguna»)
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
Comprobaciones obligatorias: ✅/❌ por cada una (ver perfil)
Defectos bloqueantes: … (o «ninguno»)
Observaciones no bloqueantes: …
Verificación manual pendiente: lo que solo puede comprobarse usando el producto (o «ninguna»)
```

## Preguntas y bloqueos

El flujo está pensado para ejecutarse desatendido: **escala solo los bloqueos importantes**. Escala con `requiere-decision` únicamente si:

- los documentos de producto se contradicen o no definen algo que cambia lo que ve o hace el usuario, y no hay un valor «propuesta» aplicable;
- la tarea exige modificar un fichero protegido, ampliar el alcance de la entrega o hacer algo irreversible;
- un problema de entorno o de permisos te impide terminar y no puedes sortearlo dentro de tus reglas.

Para todo lo demás (decisiones técnicas, detalles de implementación, valores «propuesta», ambigüedades menores con una lectura razonable) **decide tú**: elige la opción más conservadora y fácil de revertir, y regístrala en tu comentario (handoff, resultado de QA, issue o comentario de documentación) con una línea `Supuesto: <qué has decidido y por qué>`. El usuario revisa todos los supuestos al aceptar la entrega.

Cuando sí debas escalar (un subagente no puede hablar con el usuario):

1. Comenta en la issue con `Rol: <rol>` y un apartado `Pregunta:` concreto, con las opciones que ves y su consecuencia.
2. Añade la etiqueta `requiere-decision`.
3. Termina tu ejecución e informa del bloqueo en tu respuesta final.

El orquestador no delega en ninguna issue con `requiere-decision`, sigue con el trabajo que no dependa de ella y, al final, presenta la pregunta al usuario. Cuando el usuario responde, el orquestador registra la respuesta en la issue con un comentario `Rol: orquestador` y un apartado `Decisión del usuario:` literal, retira la etiqueta y el flujo continúa. El usuario también puede responder directamente en GitHub y retirar él mismo la etiqueta.

No decidas por tu cuenta nada que contradiga los documentos de producto. Los valores marcados como «propuesta» sí pueden usarse como punto de partida, siempre en el módulo de configuración.

## Ficheros protegidos

- **Kit:** `CLAUDE.md`, `.claude/**` y `docs/process/**`. Solo con autorización explícita del usuario.
- **Contrato del proyecto:** `docs/project/**` (`PERFIL.md` y `proyecto.json`). Solo con autorización explícita del usuario.
- **Documentos de producto** y demás rutas de `rutas_protegidas` en `docs/project/proyecto.json`: son la fuente de verdad, y ningún rol los modifica sin autorización.
- `docs/technical/ARQUITECTURA.md`: decisiones técnicas (stack, estructura de carpetas, módulos y responsabilidades, módulo de configuración, estrategia de pruebas). Lo crea `developer-teams` en la issue de base técnica y lo actualiza en la misma PR que cambie cualquiera de esas decisiones. `qa-teams` comprueba que el código coincide con él.
- `INDEX.md` y `COMMANDS.md`: cualquier rol que cree, mueva o borre ficheros, o verifique un comando nuevo, los actualiza en el mismo cambio.
- Cuando se incorpore una herramienta nueva (build, test, lint), `developer-teams` la añade a `COMMANDS.md` e indica en su handoff la regla de permiso que hay que añadir a `permisos_extra` de `docs/project/proyecto.json`.

El hook `.claude/hooks/guard.py` aplica estas protecciones. Lee las rutas específicas del proyecto en `docs/project/proyecto.json`.
