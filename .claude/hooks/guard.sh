#!/usr/bin/env bash
# Uso (desde el frontmatter de un agente):
#   "$CLAUDE_PROJECT_DIR"/.claude/hooks/guard.sh <rol>
exec python3 -I "$(dirname "$0")/guard.py" "$@"
