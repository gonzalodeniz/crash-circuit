# CLAUDE.md

## Comportamiento general de los agentes

- **Este fichero es estable.** Modifícalo lo mínimo posible y solo con autorización explícita del usuario. Si crees que debe cambiar, propón el cambio concreto y espera la aprobación antes de editarlo.
- **Lee `CONTEXT.md` al empezar** para conocer el producto, las restricciones de arquitectura, el modelo de dominio y la configuración.
- **Consulta `INDEX.md` primero** para localizar ficheros en vez de explorar el repositorio a ciegas.
- **Mantén `INDEX.md` al día:** cuando crees, muevas o elimines un fichero, actualiza su entrada en el índice en el mismo cambio.
- **Los documentos de `docs/product/` son la fuente de verdad.** Ante una duda o contradicción, pregunta al usuario en lugar de decidir por tu cuenta.
- **Los comandos útiles están en `COMMANDS.md`.** Consúltalo antes de ejecutar y añade solo comandos verificados; no inventes comandos de build, lint o test.

## Convenciones de idioma

Los documentos de producto están en español. Escribe el código, los identificadores y los mensajes de commit en inglés, y los comentarios del código en español, salvo que el usuario pida otra cosa. Mantén trazables los términos de los documentos (p. ej. `checkpoint`, `grid`, `lap`) al mapearlos con el texto de requisitos en español.

<!-- flujo-subagentes -->
## Flujo de trabajo con subagentes

El trabajo se reparte entre subagentes (`.claude/agents/`) coordinados por `orquestador`. Las reglas comunes (roles, estados, ramas, plantillas y cómo plantear preguntas cuando trabajas como subagente) están en:

@docs/process/FLUJO_DE_TRABAJO.md
