#!/usr/bin/env bash
# =============================================================================
# 02-permisos.sh — Genera o actualiza .claude/settings.json (permisos)
#
# Es idempotente y NO destruye otras claves del settings.json (hooks, env,
# etc.): solo reescribe el bloque "permissions". Antes de cambiar nada guarda
# una copia de seguridad con fecha.
#
# Uso:
#   ./scripts/setup/02-permisos.sh                       # en el directorio actual
#   ./scripts/setup/02-permisos.sh --dir /opt/apps/crash-circuit
#   ./scripts/setup/02-permisos.sh --extra "Bash(npm *)" --extra "Bash(npx *)"
#   ./scripts/setup/02-permisos.sh --dry-run             # muestra el JSON final
#
# Cuando se defina el stack, añade sus comandos a ALLOW_STACK (abajo) o
# pásalos con --extra.
# =============================================================================
set -euo pipefail

DIR="$(pwd)"
DRY_RUN=0
EXTRA=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir)     DIR="${2:?Falta valor para --dir}"; shift 2 ;;
    --extra)   EXTRA+=("${2:?Falta valor para --extra}"); shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Modo por defecto: acceptEdits = edita archivos sin preguntar; los comandos
# fuera de "allow" piden confirmación.
# ---------------------------------------------------------------------------
DEFAULT_MODE="acceptEdits"

# Comandos comunes del flujo (git + GitHub)
ALLOW_BASE=(
  "Bash(git *)"
  "Bash(gh issue *)"
  "Bash(gh pr *)"
  "Bash(gh label *)"
  "Bash(gh api *)"
  "Bash(gh repo view *)"
  "Bash(ls *)"
  "Bash(tree *)"
  "Bash(date *)"
  "Bash(grep *)"
)

# Comandos del stack (build/test). Rellenar cuando se defina la tecnología.
# Ejemplos: "Bash(make *)" "Bash(python3 -m pytest *)" "Bash(npm run *)"
ALLOW_STACK=(
)

DENY=(
  "Read(./.env)"
  "Read(./.env.*)"
  "Read(./**/.env)"
  "Bash(cat .env*)"
  "Bash(git push --force*)"
  "Bash(git push -f*)"
  "Bash(git reset --hard*)"
  "Bash(git clean -f*)"
  "Bash(gh repo delete*)"
  "Bash(rm -rf *)"
)

# --- Comprobaciones previas -------------------------------------------------
command -v python3 >/dev/null || { echo "ERROR: falta python3" >&2; exit 1; }
[[ -d "$DIR" ]] || { echo "ERROR: no existe el directorio $DIR" >&2; exit 1; }

SETTINGS_DIR="$DIR/.claude"
SETTINGS="$SETTINGS_DIR/settings.json"

# Pasamos las listas a Python separadas por saltos de línea
join_lines() { local IFS=$'\n'; echo "$*"; }
ALLOW_ALL=("${ALLOW_BASE[@]}" ${ALLOW_STACK[@]+"${ALLOW_STACK[@]}"} ${EXTRA[@]+"${EXTRA[@]}"})

NUEVO_JSON="$(
  ALLOW="$(join_lines "${ALLOW_ALL[@]}")" \
  DENY_L="$(join_lines "${DENY[@]}")" \
  MODE="$DEFAULT_MODE" \
  SETTINGS="$SETTINGS" \
  python3 -I - <<'PY'
import json, os, sys

path = os.environ["SETTINGS"]
data = {}
if os.path.exists(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        sys.exit(f"ERROR: {path} no es JSON válido ({e}). Corrígelo o bórralo antes de continuar.")

def uniq(items):
    seen, out = set(), []
    for i in items:
        if i and i not in seen:
            seen.add(i); out.append(i)
    return out

perms = data.get("permissions", {})
perms["defaultMode"] = os.environ["MODE"]
perms["allow"] = uniq(os.environ["ALLOW"].split("\n"))
perms["deny"] = uniq(os.environ["DENY_L"].split("\n"))
data["permissions"] = perms

print(json.dumps(data, indent=2, ensure_ascii=False))
PY
)"

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] Se escribiría en $SETTINGS:"
  echo "$NUEVO_JSON"
  exit 0
fi

mkdir -p "$SETTINGS_DIR/agents"

if [[ -f "$SETTINGS" ]]; then
  if [[ "$(cat "$SETTINGS")" == "$NUEVO_JSON" ]]; then
    echo "Sin cambios: $SETTINGS ya está al día."
    exit 0
  fi
  BACKUP="$SETTINGS.bak.$(date +%Y%m%d-%H%M%S)"
  cp "$SETTINGS" "$BACKUP"
  echo "Copia de seguridad: $BACKUP"
fi

printf '%s\n' "$NUEVO_JSON" > "$SETTINGS"
python3 -m json.tool "$SETTINGS" >/dev/null
echo "✔ Escrito y validado: $SETTINGS"
echo "  allow: ${#ALLOW_ALL[@]} reglas · deny: ${#DENY[@]} reglas · modo: $DEFAULT_MODE"

# Evitar que las copias de seguridad acaben en git
GITIGNORE="$DIR/.gitignore"
if ! grep -qxF '.claude/*.bak.*' "$GITIGNORE" 2>/dev/null; then
  echo '.claude/*.bak.*' >> "$GITIGNORE"
  echo "✔ Añadido '.claude/*.bak.*' a .gitignore"
fi