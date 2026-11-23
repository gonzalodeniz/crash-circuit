#!/usr/bin/env bash
# =============================================================================
# 01-etiquetas.sh — Crea o actualiza las etiquetas del flujo en GitHub
#
# El orquestador decide a qué subagente delegar según estas etiquetas.
# Los milestones (uno por entrega del roadmap) no se crean aquí: los crea
# product-manager a partir del roadmap del proyecto.
# Es idempotente: si una etiqueta ya existe, actualiza su color y descripción.
#
# Uso:
#   ./scripts/setup/01-etiquetas.sh                 # repo del directorio actual
#   ./scripts/setup/01-etiquetas.sh --repo org/repo # repo explícito
#   ./scripts/setup/01-etiquetas.sh --dry-run       # muestra lo que haría
#   ./scripts/setup/01-etiquetas.sh --purge-default # borra también las etiquetas
#                                                   # por defecto de GitHub
# =============================================================================
set -euo pipefail

REPO=""
DRY_RUN=0
PURGE_DEFAULT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)          REPO="${2:?Falta valor para --repo}"; shift 2 ;;
    --dry-run)       DRY_RUN=1; shift ;;
    --purge-default) PURGE_DEFAULT=1; shift ;;
    -h|--help)       sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
# Definición de etiquetas: nombre|color|descripción
# Para añadir o cambiar etiquetas, edita solo esta lista y vuelve a ejecutar.
# ---------------------------------------------------------------------------
ETIQUETAS=(
  "estado:nuevo|C5DEF5|Lista para que developer-teams la tome"
  "estado:en-desarrollo|FBCA04|developer-teams trabajando en su rama"
  "estado:listo-para-qa|0E8A16|Handoff hecho, pendiente de qa-teams"
  "estado:no-validado|D93F0B|QA rechaza; vuelve a developer-teams"
  "estado:validado|1D76DB|QA aprueba; pendiente de merge"
  "impacto-documental|BFD4F2|Requiere actualización por doc-teams"
  "changelog-pendiente|C2E0C6|Fusionada; doc-teams debe anotarla en CHANGELOG.md"
  "tipo:tecnica|5319E7|Deuda técnica o hallazgo de auditoría"
  "origen:security-auditor|E99695|Hallazgo de la auditoría de seguridad"
  "origen:quality-auditor|F9D0C4|Hallazgo de la auditoría de calidad de código"
  "requiere-decision|B60205|Bloqueada: un rol necesita una decisión del usuario"
)

# Etiquetas que GitHub crea por defecto en repos nuevos
ETIQUETAS_DEFAULT=(bug documentation duplicate enhancement "good first issue" \
                   "help wanted" invalid question wontfix)

run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '[dry-run]'; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

# --- Comprobaciones previas -------------------------------------------------
command -v gh >/dev/null || { echo "ERROR: falta GitHub CLI (gh)" >&2; exit 1; }

if [[ $DRY_RUN -eq 0 ]]; then
  gh auth status >/dev/null 2>&1 || { echo "ERROR: gh no autenticado. Ejecuta 'gh auth login' o exporta GH_TOKEN" >&2; exit 1; }
fi

REPO_ARGS=()
if [[ -n "$REPO" ]]; then
  REPO_ARGS=(--repo "$REPO")
elif [[ $DRY_RUN -eq 0 ]]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)" \
    || { echo "ERROR: no se detecta repo de GitHub. Usa --repo org/repo o ejecútalo dentro del repositorio" >&2; exit 1; }
  REPO_ARGS=(--repo "$REPO")
fi

echo "Repositorio: ${REPO:-<directorio actual>}"
echo

# --- Crear / actualizar ------------------------------------------------------
for def in "${ETIQUETAS[@]}"; do
  IFS='|' read -r nombre color desc <<< "$def"
  # --force: si ya existe, la actualiza en lugar de fallar
  run gh label create "$nombre" --color "$color" --description "$desc" --force "${REPO_ARGS[@]}"
  [[ $DRY_RUN -eq 0 ]] && echo "  ✔ $nombre"
done

# --- Borrar las de por defecto (opcional) -----------------------------------
if [[ $PURGE_DEFAULT -eq 1 ]]; then
  echo
  echo "Borrando etiquetas por defecto de GitHub..."
  for nombre in "${ETIQUETAS_DEFAULT[@]}"; do
    run gh label delete "$nombre" --yes "${REPO_ARGS[@]}" 2>/dev/null || true
  done
fi

# --- Verificación ------------------------------------------------------------
if [[ $DRY_RUN -eq 0 ]]; then
  echo
  echo "Etiquetas del flujo en ${REPO}:"
  gh label list "${REPO_ARGS[@]}" --limit 100 | grep -E '^(estado:|impacto-documental|changelog-pendiente|tipo:|origen:)' || true
fi