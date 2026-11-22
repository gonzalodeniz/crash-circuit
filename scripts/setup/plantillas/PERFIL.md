# PERFIL.md — <nombre del proyecto>

Reglas propias de este proyecto para todos los roles. Los agentes de `.claude/agents/` son genéricos: todo lo que depende del proyecto está aquí, en secciones con título fijo que los agentes citan por su nombre. No cambies los títulos de las secciones. Solo se modifica con autorización del usuario.

> Plantilla: sustituye cada indicación entre `<…>` y borra esta nota. Sé breve; el detalle va en los documentos de producto.

## Producto

<Qué es el producto, en dos o tres frases, y con qué tecnología se construye.>

**Usuario final:** <quién lo usa. Indica cómo se llama en este proyecto, p. ej. «jugador», «cliente», y qué significa «comprobarlo usando el producto»>.

## Idioma

- <Idioma de los documentos de producto, issues, comentarios de GitHub, commits y comentarios del código.>
- <Idioma del código y los identificadores.>

## Fuentes de verdad

En orden de autoridad:

| Documento | Contenido |
|---|---|
| `docs/product/<visión>.md` | Alcance, exclusiones y decisiones confirmadas. |
| `docs/product/<requisitos>.md` | Requisitos con ID estable, reglas de negocio y casos de aceptación. |
| `docs/product/<roadmap>.md` | Entregas en orden. Cada entrega lista sus IDs en una línea `**Requisitos:**`. |

**Identificadores** (estables, nunca se reutilizan):

| Prefijo | Tipo | Campo de la issue |
|---|---|---|
| `RF-xxx` | Requisito funcional | `Requisitos` |
| `RNF-xx` | Requisito no funcional | `Requisitos` |
| `RN-xx` | Regla de negocio | `Reglas de negocio` |
| `CA-xx` | Caso de aceptación | `Casos de aceptación relacionados` |

<Dónde están los valores marcados como «propuesta», si los hay.>

## Restricciones de arquitectura

- <Stack obligatorio y límites de dependencias.>
- <Restricciones que condicionan la arquitectura: persistencia, red, plataformas, rendimiento…>
- <Ubicación del código y de las pruebas (p. ej. `src/` y `tests/`).>

## Modelo de dominio

<Reglas que afectan a varios sistemas y deben mantenerse coherentes: estados, invariantes, cálculos. Cita los IDs.>

## Configuración

<Qué valores no están cerrados y dónde deben vivir (p. ej. un único módulo de configuración, sin valores fijos en el código).>

## Base técnica

<Qué debe dejar lista la primera issue de la primera entrega: estructura, stack, sistema de pruebas, `COMMANDS.md` y `docs/technical/ARQUITECTURA.md`.>

## Comprobaciones obligatorias

Las ejecuta `developer-teams` antes del handoff y `qa-teams` al validar. Cualquier incumplimiento es un defecto bloqueante.

1. <Comprobación con su comando exacto, si existe.>
2. <Qué lógica exige pruebas automáticas.>

## Verificación manual

<Qué solo puede comprobarse usando el producto. No bloquea la validación de QA: se anota en «Verificación manual pendiente» y se revisa al aceptar la entrega.>

## Documentación de usuario

<Público y estilo.>

| Fichero | Contenido |
|---|---|
| `README.md` | <Qué es, requisitos, cómo arrancarlo, qué entregas están disponibles.> |
| `docs/user/<manual>.md` | <Cómo se usa.> |
| `CHANGELOG.md` | Una entrada por issue terminada, agrupada por entrega. |

## Entregas

- Las entregas se identifican como <`E1`, `E2`… o `v1.1`…>. El título del milestone de GitHub es exactamente ese ID, y su descripción, el nombre de la entrega en el roadmap.
- El título de una issue empieza por el ID de la entrega: `<ID> · <título breve orientado al usuario>`.
- Una funcionalidad nueva entra con requisitos nuevos y una entrega nueva al final del roadmap. El procedimiento está en «Funcionalidades nuevas» de `docs/process/FLUJO_DE_TRABAJO.md`.
