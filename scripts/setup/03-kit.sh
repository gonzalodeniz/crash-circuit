#!/usr/bin/env bash
# =============================================================================
# 03-kit.sh — Copia el kit de agentes a otro proyecto y comprueba que es portable
#
# El kit son los ficheros iguales en todos los proyectos: CLAUDE.md, los agentes
# (.claude/agents/), el hook (.claude/hooks/), las reglas del flujo
# (docs/process/) y estos scripts. Lo propio de cada proyecto vive en
# docs/project/ (PERFIL.md y proyecto.json) y en docs/product/.
#
# Al instalar:
#   - Copia los ficheros del kit desde este repositorio al destino. Si un fichero
#     existe y es distinto, NO lo sobrescribe salvo con --force (guarda un .bak).
#   - Crea desde plantillas, solo si no existen, docs/project/PERFIL.md,
#     docs/project/proyecto.json, INDEX.md y COMMANDS.md.
#
# Uso:
#   ./scripts/setup/03-kit.sh --destino /ruta/otro-proyecto
#   ./scripts/setup/03-kit.sh --destino /ruta/otro-proyecto --force
#   ./scripts/setup/03-kit.sh --destino /ruta/otro-proyecto --dry-run
#   ./scripts/setup/03-kit.sh --comprobar                # este repositorio
#   ./scripts/setup/03-kit.sh --comprobar --destino /ruta/otro-proyecto
#
# --comprobar busca en los ficheros del kit el "nombre" de docs/project/proyecto.json
# y los términos de "terminos_no_portables" (si existen). Si aparece alguno, el kit
# ya no es portable: sale con código 1.
# =============================================================================
set -euo pipefail

ORIGEN="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESTINO=""
FORCE=0
DRY_RUN=0
COMPROBAR=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --destino)   DESTINO="${2:?Falta valor para --destino}"; shift 2 ;;
    --force)     FORCE=1; shift ;;
    --dry-run)   DRY_RUN=1; shift ;;
    --comprobar) COMPROBAR=1; shift ;;
    -h|--help)   sed -n '2,27p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done

# Ficheros del kit, relativos a la raíz del proyecto
KIT=(
  "CLAUDE.md"
  ".claude/agents/orquestador.md"
  ".claude/agents/product-manager.md"
  ".claude/agents/developer-teams.md"
  ".claude/agents/qa-teams.md"
  ".claude/agents/doc-teams.md"
  ".claude/agents/security-auditor.md"
  ".claude/agents/quality-auditor.md"
  ".claude/hooks/guard.sh"
  ".claude/hooks/guard.py"
  "docs/process/FLUJO_DE_TRABAJO.md"
  "scripts/README.md"
  "scripts/orquestador.sh"
  "scripts/setup/01-etiquetas.sh"
  "scripts/setup/02-permisos.sh"
  "scripts/setup/03-kit.sh"
  "scripts/setup/plantillas/PERFIL.md"
  "scripts/setup/plantillas/proyecto.json"
  "scripts/setup/plantillas/INDEX.md"
  "scripts/setup/plantillas/COMMANDS.md"
)

# Plantilla → fichero del proyecto que se crea si no existe
PLANTILLAS=(
  "scripts/setup/plantillas/PERFIL.md|docs/project/PERFIL.md"
  "scripts/setup/plantillas/proyecto.json|docs/project/proyecto.json"
  "scripts/setup/plantillas/INDEX.md|INDEX.md"
  "scripts/setup/plantillas/COMMANDS.md|COMMANDS.md"
)

EJECUTABLES=(".claude/hooks/guard.sh" ".claude/hooks/guard.py" "scripts/orquestador.sh"
             "scripts/setup/01-etiquetas.sh" "scripts/setup/02-permisos.sh" "scripts/setup/03-kit.sh")

es_ejecutable() {
  local e; for e in "${EJECUTABLES[@]}"; do [[ "$e" == "$1" ]] && return 0; done
  return 1
}

# --- Comprobación de portabilidad -------------------------------------------
comprobar() {
  local raiz="$1" config="$1/docs/project/proyecto.json" terminos fallos=0 f
  if [[ ! -f "$config" ]]; then
    echo "Aviso: no existe $config; no hay términos que buscar." >&2
    return 0
  fi
  terminos="$(python3 -I -c '
import json, sys
d = json.load(open(sys.argv[1], encoding="utf-8"))
t = [d.get("nombre", "")] + list(d.get("terminos_no_portables", []))
print("\n".join(x for x in t if isinstance(x, str) and x.strip()))
' "$config")"
  [[ -z "$terminos" ]] && { echo "Aviso: proyecto.json no define nombre ni terminos_no_portables." >&2; return 0; }
  echo "Comprobando la portabilidad del kit en $raiz"
  for f in "${KIT[@]}"; do
    [[ "$f" == scripts/setup/plantillas/* ]] && continue  # las plantillas pueden llevar ejemplos
    [[ -f "$raiz/$f" ]] || continue
    if grep -niF -f <(printf '%s\n' "$terminos") "$raiz/$f" >/dev/null; then
      echo "  ✘ $f:"
      grep -niF -f <(printf '%s\n' "$terminos") "$raiz/$f" | sed 's/^/      /'
      fallos=1
    fi
  done
  if [[ $fallos -eq 0 ]]; then
    echo "✔ Ningún fichero del kit contiene términos del proyecto."
  else
    echo "✘ El kit contiene términos del proyecto: muévelos a docs/project/PERFIL.md." >&2
  fi
  return $fallos
}

if [[ $COMPROBAR -eq 1 ]]; then
  comprobar "${DESTINO:-$ORIGEN}"
  exit $?
fi

# --- Instalación --------------------------------------------------------------
[[ -n "$DESTINO" ]] || { echo "ERROR: indica --destino <directorio> o usa --comprobar" >&2; exit 2; }
[[ -d "$DESTINO" ]] || { echo "ERROR: no existe el directorio $DESTINO" >&2; exit 1; }
DESTINO="$(cd "$DESTINO" && pwd)"
[[ "$DESTINO" != "$ORIGEN" ]] || { echo "ERROR: el destino es este mismo repositorio" >&2; exit 2; }

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

copiar() {
  local origen="$1" destino="$2" rel="$3"
  [[ -f "$origen" ]] || { echo "ERROR: falta $origen en el kit de origen" >&2; exit 1; }
  if [[ -f "$destino" ]]; then
    if cmp -s "$origen" "$destino"; then
      echo "= $rel ya está al día"; return 0
    elif [[ $FORCE -eq 0 ]]; then
      echo "! $rel tiene cambios propios: no se toca (usa --force)"; return 0
    fi
    run cp "$destino" "$destino.bak.$(date +%Y%m%d-%H%M%S)"
    run cp "$origen" "$destino"
    echo "✔ $rel sobrescrito (copia .bak guardada)"
  else
    run mkdir -p "$(dirname "$destino")"
    run cp "$origen" "$destino"
    echo "✔ Creado $rel"
  fi
  if es_ejecutable "$rel"; then run chmod +x "$destino"; fi
  return 0
}

echo "Kit: $ORIGEN → $DESTINO"
echo
for f in "${KIT[@]}"; do
  copiar "$ORIGEN/$f" "$DESTINO/$f" "$f"
done

echo
echo "Ficheros del proyecto (solo si no existen):"
for def in "${PLANTILLAS[@]}"; do
  IFS='|' read -r plantilla destino <<< "$def"
  if [[ -f "$DESTINO/$destino" ]]; then
    echo "= $destino ya existe: no se toca"
  else
    run mkdir -p "$(dirname "$DESTINO/$destino")"
    run cp "$ORIGEN/$plantilla" "$DESTINO/$destino"
    echo "✔ Creado $destino desde la plantilla"
  fi
done

cat <<EOF

Siguientes pasos en $DESTINO:
  1. Rellena docs/project/PERFIL.md (sin cambiar los títulos de las secciones).
  2. Rellena docs/project/proyecto.json (nombre, rutas protegidas, permisos del stack).
  3. Escribe docs/product/: visión, requisitos con IDs estables y un roadmap
     cuyas entregas lleven una línea «**Requisitos:** …».
  4. ./scripts/setup/01-etiquetas.sh   (etiquetas del flujo en GitHub)
  5. ./scripts/setup/02-permisos.sh    (genera .claude/settings.json)
  6. ./scripts/setup/03-kit.sh --comprobar
  7. Abre una sesión nueva de Claude Code y lanza ./scripts/orquestador.sh --max 1
EOF
