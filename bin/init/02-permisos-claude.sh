cat > .claude/settings.json <<'EOF'
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(git *)",
      "Bash(gh issue *)",
      "Bash(gh pr *)",
      "Bash(gh label *)",
      "Bash(gh api *)",
      "Bash(ls *)",
      "Bash(tree *)",
      "Bash(date *)"
    ],
    "deny": [
      "Read(./.env)",
      "Read(./.env.*)",
      "Bash(cat .env*)",
      "Bash(git push --force*)",
      "Bash(git push -f*)",
      "Bash(git reset --hard*)",
      "Bash(gh repo delete*)",
      "Bash(rm -rf *)"
    ]
  }
}
EOF

python3 -m json.tool .claude/settings.json > /dev/null && echo "settings.json OK"
git add .claude && git commit -m "[setup] Añade permisos de Claude Code y estructura de agentes"