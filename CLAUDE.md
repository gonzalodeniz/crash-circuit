# CLAUDE.md

Este fichero forma parte del kit de agentes y es igual en todos los proyectos. Lo propio de cada proyecto está en `docs/project/`.

## Comportamiento general de los agentes

- **Este fichero es estable.** Modifícalo lo mínimo posible y solo con autorización explícita del usuario. Si crees que debe cambiar, propón el cambio concreto y espera la aprobación antes de editarlo.
- **El perfil del proyecto manda en lo específico.** `docs/project/PERFIL.md` (importado abajo) define el producto, el idioma, las fuentes de verdad, las restricciones, el modelo de dominio y las comprobaciones obligatorias. Aplícalo siempre.
- **Consulta `INDEX.md` primero** para localizar ficheros en vez de explorar el repositorio a ciegas.
- **Mantén `INDEX.md` al día:** cuando crees, muevas o elimines un fichero, actualiza su entrada en el índice en el mismo cambio.
- **Los documentos de producto son la fuente de verdad** (ver «Fuentes de verdad» del perfil). Ante una contradicción o un vacío que cambie lo que ve o hace el usuario, pregunta; el resto de dudas se resuelven y registran según «Preguntas y bloqueos» de `FLUJO_DE_TRABAJO.md`.
- **Los comandos útiles están en `COMMANDS.md`.** Consúltalo antes de ejecutar y añade solo comandos verificados; no inventes comandos de build, lint o test.
- **Idioma:** sigue la sección «Idioma» del perfil, salvo que el usuario pida otra cosa.

## Perfil del proyecto

@docs/project/PERFIL.md

<!-- flujo-subagentes -->
## Flujo de trabajo con subagentes

El trabajo se reparte entre subagentes (`.claude/agents/`) coordinados por `orquestador`. Las reglas comunes (roles, estados, ramas, plantillas y cómo plantear preguntas cuando trabajas como subagente) están en:

@docs/process/FLUJO_DE_TRABAJO.md
