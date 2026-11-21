gh label create "estado:nuevo"            --color "C5DEF5" --description "Lista para que developer-teams la tome"
gh label create "estado:en-desarrollo"    --color "FBCA04" --description "developer-teams trabajando en su rama"
gh label create "estado:listo-para-qa"    --color "0E8A16" --description "Handoff hecho, pendiente de qa-teams"
gh label create "estado:no-validado"      --color "D93F0B" --description "QA rechaza; vuelve a developer-teams"
gh label create "estado:validado"         --color "1D76DB" --description "QA aprueba; pendiente de merge"
gh label create "impacto-documental"      --color "BFD4F2" --description "Requiere actualización por doc-teams"
gh label create "tipo:tecnica"            --color "5319E7" --description "Deuda técnica o hallazgo de auditoría"

gh label list | grep -E "estado:|impacto|tipo:"