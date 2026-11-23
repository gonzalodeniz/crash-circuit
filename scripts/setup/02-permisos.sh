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
#   ./scripts/setup/02-permisos.sh --dir /ruta/al/proyecto
#   ./scripts/setup/02-permisos.sh --extra "Bash(make *)"  # regla puntual
#   ./scripts/setup/02-permisos.sh --dry-run             # muestra el JSON final
#
# Los comandos propios del proyecto (build, test…) se leen de "permisos_extra"
# en docs/project/proyecto.json. Para añadir uno de forma duradera, edita ese
# fichero y relanza este script.
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
# de Bash están todos permitidos (ver ALLOW_BASE) salvo los de DENY.
# ---------------------------------------------------------------------------
DEFAULT_MODE="acceptEdits"

# Bash sin patrón: permite cualquier comando, también los que Claude Code no
# puede analizar por prefijo (sustitución de procesos <(…), órdenes encadenadas).
# Con reglas por prefijo, esos comandos piden confirmación en sesión interactiva
# (el flujo se queda esperando) y se deniegan en modo --auto. Lo que cada rol
# puede o no puede hacer lo limita el hook guard.py; lo peligroso, la lista DENY,
# que prevalece sobre "allow" en todos los modos de permisos.
ALLOW_BASE=(
  "Bash"
)

# Los comandos del stack (build/test) son propios de cada proyecto: se leen de
# "permisos_extra" en docs/project/proyecto.json (ver más abajo).

# Las reglas de .env son complementarias y limitadas: Claude Code solo las aplica a la
# herramienta Read y al comando `cat` (no a `head`, `grep`, `sed`, `source`…). La
# protección real es el hook guard.py, que bloquea cualquier orden de Bash cuyo argumento
# o redirección sea un fichero .env o .env.* (salvo .env.example).
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
  "Bash(rm -fr *)"
  "Bash(rm -r -f *)"
  "Bash(rm -f -r *)"
)

# --- Comprobaciones previas -------------------------------------------------
command -v python3 >/dev/null || { echo "ERROR: falta python3" >&2; exit 1; }
[[ -d "$DIR" ]] || { echo "ERROR: no existe el directorio $DIR" >&2; exit 1; }

SETTINGS_DIR="$DIR/.claude"
SETTINGS="$SETTINGS_DIR/settings.json"
CONFIG_PROYECTO="$DIR/docs/project/proyecto.json"

# Permisos propios del proyecto (permisos_extra de proyecto.json)
LEER_PERMISOS='
import json, sys
try:
    with open(sys.argv[1], encoding="utf-8") as f:
        datos = json.load(f)
except (OSError, json.JSONDecodeError) as e:
    sys.exit(f"ERROR: no se puede leer {sys.argv[1]} ({e})")
reglas = datos.get("permisos_extra", []) if isinstance(datos, dict) else []
if not isinstance(reglas, list) or not all(isinstance(r, str) for r in reglas):
    sys.exit("ERROR: permisos_extra debe ser una lista de cadenas")
print("\n".join(reglas))
'
ALLOW_STACK=()
if [[ -f "$CONFIG_PROYECTO" ]]; then
  REGLAS_PROYECTO="$(python3 -I -c "$LEER_PERMISOS" "$CONFIG_PROYECTO")"
  while IFS= read -r regla; do
    [[ -n "$regla" ]] && ALLOW_STACK+=("$regla")
  done <<< "$REGLAS_PROYECTO"
  echo "Permisos del proyecto (docs/project/proyecto.json): ${#ALLOW_STACK[@]} reglas" >&2
else
  echo "Aviso: no existe docs/project/proyecto.json; solo se aplican los permisos base." >&2
fi

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
allow = uniq(os.environ["ALLOW"].split("\n"))
if "Bash" in allow:  # "Bash" ya cubre cualquier regla Bash(...): se omiten por redundantes
    allow = [r for r in allow if not r.startswith("Bash(")]
perms["allow"] = allow
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
# Cuenta las reglas del fichero escrito (allow puede quedar reducido al omitir las redundantes)
python3 -I -c '
import json, sys
p = json.load(open(sys.argv[1], encoding="utf-8"))["permissions"]
print("  allow: %d reglas · deny: %d reglas · modo: %s" % (len(p["allow"]), len(p["deny"]), p["defaultMode"]))
' "$SETTINGS"

# Evitar que credenciales, copias de seguridad y logs acaben en git
GITIGNORE="$DIR/.gitignore"
for patron in '.env' '.env.*' '*.bak.*' 'logs/'; do
  if ! grep -qxF -- "$patron" "$GITIGNORE" 2>/dev/null; then
    # Si el fichero no acaba en salto de línea, añadirlo para no pegar el patrón a la última línea
    if [[ -s "$GITIGNORE" && -n "$(tail -c1 "$GITIGNORE")" ]]; then echo >> "$GITIGNORE"; fi
    echo "$patron" >> "$GITIGNORE"
    echo "✔ Añadido '$patron' a .gitignore"
  fi
done