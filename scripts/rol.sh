#!/usr/bin/env bash
# =============================================================================
# rol.sh — Lanza el orquestador o un subagente concreto del flujo de trabajo
#
# Uso:
#   ./scripts/rol.sh                          # orquestador, sesión interactiva
#   ./scripts/rol.sh --max 5                  # ídem, con un máximo de 5 delegaciones
#   ./scripts/rol.sh --auto                   # orquestador desatendido (log en logs/)
#   ./scripts/rol.sh --auto --max 3           # desatendido, máximo 3 delegaciones
#   ./scripts/rol.sh qa-teams                 # sesión interactiva como qa-teams
#   ./scripts/rol.sh --auto qa-teams "Valida la issue #12"
#   ./scripts/rol.sh --list                   # roles disponibles
#
# - Carga .env si existe y exporta GH_TOKEN (desde GH_TOKEN o GITHUB_PAT).
# - Impide dos ejecuciones simultáneas sobre el repositorio (bloqueo con flock).
# - En modo --auto guarda la salida en logs/<rol>-<fecha>.log.
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

AUTO=0
MAX=""
ROL="orquestador"
PROMPT=""

listar_roles() {
  local f
  for f in .claude/agents/*.md; do
    [[ -f "$f" ]] && sed -n 's/^name:[[:space:]]*//p' "$f" | head -1
  done
  return 0
}
ROLES="$(listar_roles)"
es_rol() { grep -qxF -- "$1" <<< "$ROLES"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --auto) AUTO=1; shift ;;
    --max)  MAX="${2:?Falta valor para --max}"; shift 2 ;;
    --list) echo "$ROLES"; exit 0 ;;
    -h|--help) sed -n '2,18p' "$0"; exit 0 ;;
    -*) echo "Opción desconocida: $1" >&2; exit 2 ;;
    *)
      if [[ "$ROL" == "orquestador" && -z "$PROMPT" ]] && es_rol "$1"; then
        ROL="$1"
      else
        PROMPT="${PROMPT:+$PROMPT }$1"
      fi
      shift ;;
  esac
done

# --- Validaciones ------------------------------------------------------------
es_rol "$ROL" || { echo "ERROR: rol desconocido '$ROL'. Disponibles:" >&2; echo "$ROLES" >&2; exit 2; }
[[ -z "$MAX" || "$MAX" =~ ^[0-9]+$ ]] || { echo "ERROR: --max debe ser un número" >&2; exit 2; }
command -v claude >/dev/null || { echo "ERROR: falta Claude Code (claude)" >&2; exit 1; }
command -v gh     >/dev/null || { echo "ERROR: falta GitHub CLI (gh)" >&2; exit 1; }
command -v flock  >/dev/null || { echo "ERROR: falta flock (paquete util-linux)" >&2; exit 1; }

# --- Credenciales de GitHub ---------------------------------------------------
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi
if [[ -z "${GH_TOKEN:-}" && -n "${GITHUB_PAT:-}" ]]; then
  export GH_TOKEN="$GITHUB_PAT"
fi
gh auth status >/dev/null 2>&1 || { echo "ERROR: gh no autenticado (define GH_TOKEN o GITHUB_PAT en .env, o ejecuta 'gh auth login')" >&2; exit 1; }

# --- Mensaje inicial ----------------------------------------------------------
if [[ "$ROL" == "orquestador" ]]; then
  PROMPT="${PROMPT:-Ejecuta el ciclo de entrega.}"
  [[ -n "$MAX" ]] && PROMPT="$PROMPT Máximo de delegaciones en esta ejecución: $MAX."
elif [[ $AUTO -eq 1 && -z "$PROMPT" ]]; then
  echo "ERROR: en modo --auto, un rol distinto del orquestador necesita un mensaje (p. ej. \"Valida la issue #12\")" >&2
  exit 2
fi

# --- Bloqueo: una sola ejecución a la vez ------------------------------------
mkdir -p logs  # logs/ está en .gitignore (lo añade scripts/setup/02-permisos.sh)
exec 9> logs/.rol.lock
if ! flock -n 9; then
  echo "Ya hay otra ejecución de rol.sh en curso en este repositorio. Inténtalo más tarde." >&2
  exit 3
fi

# --- Ejecución ----------------------------------------------------------------
if [[ $AUTO -eq 0 ]]; then
  # Sesión interactiva (el bloqueo se mantiene mientras dure la sesión)
  if [[ -n "$PROMPT" ]]; then
    exec claude --agent "$ROL" "$PROMPT"
  else
    exec claude --agent "$ROL"
  fi
fi

LOG="logs/${ROL}-$(date +%Y%m%d-%H%M%S).log"
{
  echo "=== $(date '+%F %T') · rol=$ROL"
  echo "=== mensaje: $PROMPT"
  echo
} > "$LOG"

set +e
claude -p --agent "$ROL" "$PROMPT" 2>&1 | tee -a "$LOG"
CODIGO=${PIPESTATUS[0]}
set -e

echo -e "\n=== $(date '+%F %T') · fin (código $CODIGO)" >> "$LOG"
echo "Log: $LOG" >&2
exit "$CODIGO"