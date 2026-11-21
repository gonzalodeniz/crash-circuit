#!/usr/bin/env python3
"""Hook PreToolUse que bloquea acciones prohibidas para cada rol.

- Edit/Write/NotebookEdit: impide modificar ficheros protegidos o fuera del proyecto.
- Bash: tokeniza el comando con shlex (comillas, separadores, saltos de línea,
  redirecciones) y aplica las reglas del rol a cada orden simple, incluidas las
  que van dentro de `bash -c`, `eval`, `$(…)` y `…`. Los cuerpos de heredocs y
  los comentarios se ignoran, para no bloquear por palabras de una issue o PR.
- developer-teams: no hace commit ni push en main ni fusiona PR sin estado:validado.

Previene errores de los agentes; no es un sandbox frente a un uso hostil
(p. ej. `python -c` que escriba ficheros no se detecta).

Salida 0 = permitir; salida 2 = bloquear (el motivo va por stderr).
"""
import json
import os
import re
import shlex
import subprocess
import sys

ROL = sys.argv[1] if len(sys.argv) > 1 else ""

try:
    DATOS = json.load(sys.stdin)
except Exception:
    sys.exit(0)  # entrada inesperada: no bloquear

# Cuando un rol es el agente principal (p. ej. el orquestador), su hook también se
# ejecuta en las herramientas de sus subagentes. Si la orden viene de otro rol que
# tiene su propio guard, se le cede el control a ese guard; cualquier otro subagente
# (general-purpose, Explore…) sigue sujeto a las reglas del rol principal.
ROLES_CON_GUARD = {"orquestador", "product-manager", "developer-teams", "qa-teams", "doc-teams"}
AGENTE = DATOS.get("agent_type") or ""
if AGENTE and AGENTE != ROL and AGENTE in ROLES_CON_GUARD:
    sys.exit(0)

HERRAMIENTA = DATOS.get("tool_name", "")
ENTRADA = DATOS.get("tool_input") or {}
PROYECTO = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR") or DATOS.get("cwd") or os.getcwd())
CWD = os.path.realpath(DATOS.get("cwd") or PROYECTO)


def bloquear(motivo):
    print(f"Bloqueado por guard ({ROL}): {motivo}", file=sys.stderr)
    sys.exit(2)


def run(*args, timeout=20):
    """Ejecuta un comando y devuelve stdout, o None si falla."""
    try:
        r = subprocess.run(args, cwd=CWD, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:
        return None


def dentro_del_proyecto(ruta):
    rel = os.path.relpath(os.path.realpath(os.path.join(CWD, os.path.expanduser(ruta))), PROYECTO)
    return not (rel == ".." or rel.startswith(".." + os.sep))


# ---------------------------------------------------------------------------
# Ficheros protegidos
# ---------------------------------------------------------------------------
# Rutas relativas a la raíz; las que terminan en "/" protegen todo el directorio.
PROTEGIDOS_COMUNES = [
    "CLAUDE.md",
    "CONTEXT.md",
    ".claude/",
    "docs/process/",
    "docs/product/",
]

# Roles que solo pueden editar dentro de estas rutas (si no figuran, sin restricción extra).
SOLO_EN = {
    "product-manager": [],  # no edita ficheros
    "qa-teams": [],         # no edita ficheros
    "doc-teams": ["README.md", "CHANGELOG.md", "INDEX.md", "docs/user/"],
    "orquestador": [],      # no edita ficheros
}


def comprobar_fichero(ruta):
    absoluta = os.path.realpath(os.path.join(PROYECTO, ruta))
    rel = os.path.relpath(absoluta, PROYECTO)
    if rel == ".." or rel.startswith(".." + os.sep):
        bloquear(f"{ruta} está fuera del proyecto.")
    rel = rel.replace(os.sep, "/")
    for p in PROTEGIDOS_COMUNES:
        if rel == p.rstrip("/") or (p.endswith("/") and rel.startswith(p)):
            bloquear(f"{rel} es un fichero protegido: solo se modifica con autorización del usuario. "
                     "Si crees que debe cambiar, usa requiere-decision (ver FLUJO_DE_TRABAJO.md).")
    if ROL in SOLO_EN:
        permitidas = SOLO_EN[ROL]
        if not any(rel == p.rstrip("/") or (p.endswith("/") and rel.startswith(p)) for p in permitidas):
            bloquear(f"{ROL} no puede modificar {rel}.")


if HERRAMIENTA in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
    ruta = ENTRADA.get("file_path") or ENTRADA.get("notebook_path")
    if ruta:
        comprobar_fichero(ruta)
    sys.exit(0)

if HERRAMIENTA != "Bash":
    sys.exit(0)

# ---------------------------------------------------------------------------
# Reglas por rol
# ---------------------------------------------------------------------------
# Subcomandos de git prohibidos por rol.
BLOQUEO_GIT = {
    "product-manager": ({"commit", "push", "merge", "rebase", "reset", "checkout", "switch", "branch", "tag",
                         "stash", "cherry-pick", "revert", "am", "restore", "add", "rm", "mv", "apply", "clean"},
                        "product-manager no modifica el repositorio git: su trabajo vive en GitHub Issues."),
    "developer-teams": ({"rebase"},
                        "no uses rebase (obligaría a push forzado): sincroniza con 'git merge origin/main'."),
    "qa-teams": ({"commit", "push", "merge", "rebase", "reset", "tag", "stash", "cherry-pick", "revert", "am",
                  "add", "rm", "mv", "apply"},
                 "qa-teams no modifica el repositorio: valida y deja el resultado en la PR."),
    "orquestador": ({"commit", "push", "pull", "merge", "rebase", "reset", "checkout", "switch", "branch", "tag",
                     "stash", "cherry-pick", "revert", "restore", "am", "add", "rm", "mv", "apply", "clean"},
                    "el orquestador no modifica el repositorio: delega en el subagente que corresponda."),
    "doc-teams": ({"merge", "rebase", "reset", "tag", "stash", "cherry-pick", "revert"},
                  "operación git fuera del alcance de doc-teams."),
}

# Acciones de gh prohibidas por rol: {grupo: (acciones, motivo)}.
BLOQUEO_GH = {
    "product-manager": {
        "pr": ({"create", "merge", "close", "edit", "ready"},
               "product-manager no gestiona PR: eso corresponde a developer-teams."),
        "issue": ({"close", "delete", "transfer"},
                  "product-manager no cierra issues: se cierran al fusionar su PR. Si una issue sobra, usa requiere-decision."),
    },
    "developer-teams": {
        "issue": ({"close", "delete", "transfer"},
                  "las issues se cierran solas al fusionar su PR con 'Closes #N'."),
    },
    "qa-teams": {
        "pr": ({"merge", "ready", "close", "create", "edit", "reopen"},
               "qa-teams no gestiona PR: solo las revisa y comenta."),
        "issue": ({"close", "delete", "transfer", "create", "reopen"},
                  "qa-teams no crea ni cierra issues: sus hallazgos van en el comentario de revisión."),
    },
    "orquestador": {
        "pr": ({"create", "merge", "close", "edit", "ready", "reopen", "checkout", "comment", "review"},
               "el orquestador no actúa sobre PR: delega en developer-teams o qa-teams."),
        "issue": ({"create", "close", "delete", "transfer", "reopen", "develop", "lock"},
                  "el orquestador no crea ni cierra issues: delega en product-manager."),
    },
    "doc-teams": {
        "pr": ({"merge", "ready", "close", "create", "edit", "reopen"}, "doc-teams no gestiona PR."),
        "issue": ({"close", "delete", "transfer", "create", "reopen"}, "doc-teams no crea ni cierra issues."),
    },
}

# Roles que no modifican ficheros desde Bash, con el motivo.
SIN_FICHEROS = {
    "product-manager": "product-manager no modifica ficheros.",
    "qa-teams": "qa-teams no modifica ficheros.",
    "orquestador": "el orquestador no modifica ficheros.",
    "doc-teams": "doc-teams modifica ficheros solo con Edit/Write, dentro de README.md, CHANGELOG.md, INDEX.md y docs/user/.",
}

# ---------------------------------------------------------------------------
# Análisis del comando
# ---------------------------------------------------------------------------
HEREDOC = re.compile(r"<<-?[ \t]*(['\"]?)(\w+)\1([^\n]*)\n(?:.*?\n)??[ \t]*\2[ \t]*(?=\n|$)", re.S)
PUNTUACION = set(";&|()<>\n")
SHELLS = {"bash", "sh", "zsh", "dash", "ksh"}
ENVOLTORIOS = {"sudo", "doas", "env", "command", "builtin", "exec", "nohup", "time", "nice",
               "xargs", "timeout", "stdbuf"}
RESERVADAS = {"if", "then", "else", "elif", "do", "while", "until", "!", "{", "}"}

_SIN_CALCULAR = object()
ESTADO = {"rama": _SIN_CALCULAR}


def rama_actual():
    """Rama en la que se ejecutará la orden, teniendo en cuenta los switch/checkout previos del comando."""
    if ESTADO["rama"] is _SIN_CALCULAR:
        ESTADO["rama"] = run("git", "rev-parse", "--abbrev-ref", "HEAD")
    return ESTADO["rama"]


def cerrar_parentesis(texto, i):
    """Devuelve la posición del ")" que cierra el "(" de texto[i]."""
    nivel = 0
    for j in range(i, len(texto)):
        if texto[j] == "(":
            nivel += 1
        elif texto[j] == ")":
            nivel -= 1
            if nivel == 0:
                return j
    return len(texto) - 1


def preparar(texto):
    """Quita comentarios y continuaciones de línea, y extrae `…` y "$(…)" como subcomandos."""
    salida, subcomandos = [], []
    i, n, comilla = 0, len(texto), None
    while i < n:
        c = texto[i]
        if comilla == "'":
            salida.append(c)
            if c == "'":
                comilla = None
            i += 1
            continue
        if c == "\\" and i + 1 < n:
            if texto[i + 1] != "\n":  # barra + salto de línea = continuación
                salida.append(texto[i:i + 2])
            i += 2
            continue
        if c == "`":
            j = i + 1
            while j < n and texto[j] != "`":
                j += 2 if texto[j] == "\\" else 1
            subcomandos.append(texto[i + 1:j])
            salida.append(" " if comilla is None else "")
            i = j + 1
            continue
        if comilla == '"':
            if c == '"':
                comilla = None
            elif c == "$" and texto[i + 1:i + 2] == "(":
                j = cerrar_parentesis(texto, i + 1)
                subcomandos.append(texto[i + 2:j])
                i = j + 1
                continue
            salida.append(c)
            i += 1
            continue
        if c in "'\"":
            comilla = c
        elif c == "#" and (i == 0 or texto[i - 1] in " \t\n;&|()"):
            j = texto.find("\n", i)
            i = n if j < 0 else j
            continue
        salida.append(c)
        i += 1
    return "".join(salida), subcomandos


def tokenizar(texto):
    lex = shlex.shlex(texto, posix=True, punctuation_chars=";&|()<>\n")
    lex.whitespace = " \t\r"
    lex.whitespace_split = True
    lex.commenters = ""
    return list(lex)


def es_puntuacion(t):
    return bool(t) and set(t) <= PUNTUACION


def ordenes(tokens):
    """Agrupa los tokens en órdenes simples: [(palabras, redirecciones de salida)]."""
    palabras, redirs, i = [], [], 0
    while i < len(tokens):
        t = tokens[i]
        if es_puntuacion(t):
            if "<" in t or ">" in t:
                if set(t) & set(";|()\n") or "&&" in t:
                    if palabras or redirs:
                        yield palabras, redirs
                    palabras, redirs = [], []
                destino = None
                if i + 1 < len(tokens) and not es_puntuacion(tokens[i + 1]):
                    destino = tokens[i + 1]
                    i += 1
                if ">" in t:
                    redirs.append((t, destino))
            else:
                if palabras or redirs:
                    yield palabras, redirs
                palabras, redirs = [], []
            i += 1
            continue
        palabras.append(t)
        i += 1
    if palabras or redirs:
        yield palabras, redirs


def normalizar(palabras):
    """Quita asignaciones, palabras reservadas y envoltorios (sudo, env, xargs…) del inicio."""
    i = 0
    while i < len(palabras):
        p = palabras[i]
        base = os.path.basename(p)
        if re.match(r"[A-Za-z_]\w*=", p) or p in RESERVADAS:
            i += 1
        elif base in ENVOLTORIOS:
            i += 1
            while i < len(palabras) and (palabras[i].startswith("-")
                                         or re.fullmatch(r"[\d.]+[smhd]?", palabras[i])
                                         or re.match(r"[A-Za-z_]\w*=", palabras[i])):
                i += 1
        else:
            break
    resto = palabras[i:]
    return [os.path.basename(resto[0])] + resto[1:] if resto else []


def escribe_en_proyecto(op, destino):
    if destino is None or destino.startswith("/dev/"):
        return False
    if op.endswith("&") and re.fullmatch(r"\d+|-", destino):  # >&2
        return False
    return dentro_del_proyecto(destino)


def analizar(texto, nivel=0):
    if nivel > 5:
        bloquear("comando demasiado anidado para verificarlo: simplifícalo.")
    texto = HEREDOC.sub(lambda m: " " + m.group(3) + "\n", texto)
    limpio, subcomandos = preparar(texto)
    try:
        tokens = tokenizar(limpio)
    except ValueError:
        bloquear("no se pudo analizar el comando (¿comillas sin cerrar?): reescríbelo de forma más simple.")
    for palabras, redirs in ordenes(tokens):
        comprobar_orden(palabras, redirs, nivel)
    for sub in subcomandos:
        analizar(sub, nivel + 1)


def comprobar_orden(palabras, redirs, nivel):
    if ROL in SIN_FICHEROS:
        for op, destino in redirs:
            if escribe_en_proyecto(op, destino):
                bloquear(f"{SIN_FICHEROS[ROL]} (redirección a {destino})")
    p = normalizar(palabras)
    if not p:
        return
    prog, args = p[0], p[1:]
    if prog in SHELLS:
        for i, a in enumerate(args):
            if re.fullmatch(r"-[a-zA-Z]*c[a-zA-Z]*", a):
                resto = [x for x in args[i + 1:] if x != "--"]
                if resto:
                    analizar(resto[0], nivel + 1)
                break
        return
    if prog == "eval":
        analizar(" ".join(args), nivel + 1)
        return
    if ROL in SIN_FICHEROS:
        comprobar_modificacion(prog, args)
    if prog == "git":
        comprobar_git(args)
    elif prog == "gh":
        comprobar_gh(args)


def comprobar_modificacion(prog, args):
    motivo = SIN_FICHEROS[ROL]
    if prog in ("rm", "mv", "cp", "tee", "truncate", "shred", "install", "ln"):
        bloquear(motivo)
    if prog == "sed" and any(re.match(r"-[nErsuz]*i|--in-place", a) for a in args):
        bloquear(motivo)
    if prog == "perl" and any(re.match(r"-[pnlaw0]*i", a) for a in args):
        bloquear(motivo)
    if prog == "dd" and any(a.startswith("of=") for a in args):
        bloquear(motivo)


# --- git ----------------------------------------------------------------------
GIT_OPCIONES_CON_VALOR = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env"}


def comprobar_git(args):
    i, globales = 0, []
    while i < len(args) and args[i].startswith("-"):
        globales.append(args[i])
        if args[i] in GIT_OPCIONES_CON_VALOR and i + 1 < len(args):
            globales.append(args[i + 1])
            i += 1
        i += 1
    sub, resto = (args[i], args[i + 1:]) if i < len(args) else ("", [])

    if any(g.lower().startswith("alias.") or g.startswith(("--exec-path=", "--config-env")) for g in globales):
        bloquear("no se permiten alias ni rutas de ejecución en las opciones globales de git.")

    bloqueados, motivo = BLOQUEO_GIT.get(ROL, (set(), ""))
    if sub in bloqueados:
        bloquear(motivo)

    if sub in ("switch", "checkout"):
        cambia, destino = rama_destino(sub, resto)
        if ROL == "doc-teams" and not (cambia and destino == "main"):
            bloquear("doc-teams trabaja siempre sobre main.")
        if cambia:
            ESTADO["rama"] = destino

    if sub == "push":
        comprobar_push(resto)

    if sub == "commit":
        rama = rama_actual()
        if ROL == "developer-teams":
            if rama is None:
                bloquear("no se puede determinar la rama del commit: cambia de rama y haz el commit en comandos separados.")
            if rama == "main":
                bloquear("estás en main: crea o cambia a la rama de la issue (feat/<N>-<slug>) antes de hacer commit.")
        if ROL == "doc-teams" and rama != "main":
            bloquear("doc-teams solo hace commit y push sobre main: ejecuta antes 'git switch main && git pull --ff-only'.")


def rama_destino(sub, args):
    """Para git switch/checkout devuelve (cambia_de_rama, rama). rama=None si no se puede determinar."""
    if sub == "checkout" and "--" in args:
        return False, None  # restaura rutas, no cambia de rama
    posicionales = []
    for i, a in enumerate(args):
        if a in ("-b", "-B", "-c", "-C", "--create", "--force-create", "--orphan"):
            return True, (args[i + 1] if i + 1 < len(args) else None)
        if a in ("-d", "--detach"):
            return True, "(detached)"
        if a == "-" or not a.startswith("-"):
            posicionales.append(a)
    if not posicionales:
        return False, None
    destino = posicionales[0]
    if destino == "-":
        return True, None
    if sub == "switch":
        return True, destino
    # checkout: es un cambio de rama solo si el destino existe como rama local o remota
    if (destino == "main"
            or run("git", "rev-parse", "--verify", "--quiet", f"refs/heads/{destino}") is not None
            or run("git", "rev-parse", "--verify", "--quiet", f"refs/remotes/origin/{destino}") is not None):
        return True, destino
    return False, None


def comprobar_push(args):
    posicionales, opciones, i = [], [], 0
    while i < len(args):
        a = args[i]
        if a in ("-o", "--push-option", "--repo", "--receive-pack", "--exec"):
            i += 2
            continue
        (opciones if a.startswith("-") else posicionales).append(a)
        i += 1
    refspecs = posicionales[1:]

    if (any(o in ("--force", "--mirror") or o.startswith("--force") or re.fullmatch(r"-[a-zA-Z]*f[a-zA-Z]*", o)
            for o in opciones)
            or any(r.startswith("+") for r in refspecs)):
        bloquear("no se permite push forzado.")

    if ROL == "developer-teams":
        if "--all" in opciones:
            bloquear("haz push solo de la rama de la issue.")
        rama = rama_actual()
        destinos = []
        for r in refspecs or ["HEAD"]:
            d = r.split(":")[-1] or r.split(":")[0]
            d = rama if d == "HEAD" else d
            destinos.append(None if d is None else re.sub(r"^refs/heads/", "", d))
        if any(d is None or d == "main" for d in destinos):
            bloquear("no se hace push directo a main: los cambios entran por PR con squash.")

    if ROL == "doc-teams" and rama_actual() != "main":
        bloquear("doc-teams solo hace commit y push sobre main: ejecuta antes 'git switch main && git pull --ff-only'.")


# --- gh -----------------------------------------------------------------------
def comprobar_gh(args):
    if not args:
        return
    grupo = args[0]
    accion = args[1] if len(args) > 1 else ""
    resto = args[2:]

    if (grupo in ("release", "secret", "workflow", "variable", "alias", "extension", "cache")
            or (grupo == "repo" and accion != "view")
            or (grupo == "label" and accion == "delete")):
        bloquear("operación de administración del repositorio no permitida.")

    if grupo == "api":
        comprobar_gh_api(args[1:])
        return

    acciones, motivo = BLOQUEO_GH.get(ROL, {}).get(grupo, (set(), ""))
    if accion in acciones:
        bloquear(motivo)

    if ROL == "orquestador" and grupo == "issue" and accion == "edit":
        comprobar_edicion_orquestador(resto)
    if ROL == "developer-teams" and grupo == "pr" and accion == "merge":
        comprobar_fusion(resto)


GH_API_CON_VALOR = {"-X", "--method", "-f", "-F", "--field", "--raw-field", "--input", "-H", "--header",
                    "-q", "--jq", "-t", "--template", "--cache", "-p", "--preview", "--hostname"}


def comprobar_gh_api(args):
    """gh api es de solo lectura, salvo cerrar milestones (product-manager)."""
    metodo, campos, valores, endpoint, i = None, False, [], None, 0
    while i < len(args):
        a = args[i]
        opcion, valor = a, None
        if a.startswith("--") and "=" in a:
            opcion, valor = a.split("=", 1)
        elif re.fullmatch(r"-[XfF].+", a):
            opcion, valor = a[:2], a[2:]
        if opcion in GH_API_CON_VALOR:
            if valor is None:
                valor = args[i + 1] if i + 1 < len(args) else ""
                i += 1
            if opcion in ("-X", "--method"):
                metodo = valor.upper()
            elif opcion in ("-f", "-F", "--field", "--raw-field", "--input"):
                campos = True
                valores.append(valor)
        elif not a.startswith("-") and endpoint is None:
            endpoint = a
        i += 1

    escritura = (metodo != "GET") if metodo else campos
    if endpoint == "graphql":
        escritura = any("mutation" in v or v.startswith("@") or "=@" in v for v in valores)
    if not escritura:
        return
    if ROL == "product-manager" and re.fullmatch(r"/?repos/[^/]+/[^/]+/milestones(/\d+)?", endpoint or ""):
        return
    bloquear("gh api solo se usa para consultar: para cambios usa los subcomandos de gh (issue, pr…).")


def comprobar_edicion_orquestador(args):
    posicionales, quitadas, otras, i = [], [], [], 0
    while i < len(args):
        a = args[i]
        if a == "--remove-label" and i + 1 < len(args):
            quitadas.append(args[i + 1])
            i += 2
            continue
        if a.startswith("--remove-label="):
            quitadas.append(a.split("=", 1)[1])
        elif a.startswith("-"):
            otras.append(a)
        else:
            posicionales.append(a)
        i += 1
    if otras or len(posicionales) != 1 or quitadas != ["requiere-decision"]:
        bloquear("el orquestador solo puede usar 'gh issue edit <N> --remove-label requiere-decision' "
                 "tras registrar la decisión del usuario; el resto de cambios los hacen los subagentes.")


GH_MERGE_CON_VALOR = {"-t", "--subject", "-b", "--body", "-F", "--body-file", "-A", "--author-email",
                      "--match-head-commit", "-R", "--repo"}


def comprobar_fusion(args):
    """Solo se fusiona una PR cuyas issues tienen estado:validado."""
    objetivo, repo, i = None, [], 0
    while i < len(args):
        a = args[i]
        if a in GH_MERGE_CON_VALOR:
            if a in ("-R", "--repo") and i + 1 < len(args):
                repo = ["--repo", args[i + 1]]
            i += 2
            continue
        if a.startswith("--repo="):
            repo = ["--repo", a.split("=", 1)[1]]
        elif not a.startswith("-") and objetivo is None:
            objetivo = a
        i += 1
    if objetivo is None:
        # Sin argumento, gh fusiona la PR de la rama actual (contando los cambios de rama previos)
        objetivo = rama_actual()
        if objetivo is None:
            bloquear("no se puede determinar la PR: indica su número explícitamente.")

    salida = run("gh", "pr", "view", objetivo, *repo, "--json", "closingIssuesReferences",
                 "--jq", ".closingIssuesReferences[].number")
    if salida is None:
        bloquear("no se pudo verificar la PR con gh; indica el número de PR explícitamente.")
    issues = salida.split()
    if not issues:
        bloquear("la PR no enlaza ninguna issue con 'Closes #N'; añádelo a la descripción antes de fusionar.")
    for n in issues:
        etiquetas = run("gh", "issue", "view", n, *repo, "--json", "labels", "--jq", ".labels[].name")
        if etiquetas is None:
            bloquear(f"no se pudieron leer las etiquetas de la issue #{n}.")
        if "estado:validado" not in etiquetas.split("\n"):
            bloquear(f"la issue #{n} no tiene estado:validado: solo se fusiona tras la validación de qa-teams.")


analizar(ENTRADA.get("command", ""))
sys.exit(0)
