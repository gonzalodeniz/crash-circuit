import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Prueba del hook `.claude/hooks/guard.py` (issue #62): ninguna orden de Bash puede
// leer o modificar un fichero `.env` o `.env.*` (salvo `.env.example`), para ningún
// rol. Las reglas `deny` de los permisos solo cubren `cat` y la herramienta Read.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUARD = join(ROOT, '.claude', 'hooks', 'guard.py');
const ROLES = ['orquestador', 'product-manager', 'developer-teams', 'qa-teams', 'doc-teams',
  'security-auditor', 'quality-auditor'];

const hasPython = spawnSync('python3', ['--version']).status === 0;
const opts = { skip: !hasPython && 'python3 no disponible' };

// Devuelve el código de salida del hook (0 permite, 2 bloquea) y su stderr.
function guard(role, command) {
  const r = spawnSync('python3', ['-I', GUARD, role], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: ROOT }),
    encoding: 'utf8',
  });
  return { code: r.status, stderr: r.stderr };
}

test('bloquea leer .env con órdenes distintas de cat, para todos los roles', opts, () => {
  const comandos = [
    'head .env',
    'tail -n 5 .env',
    'less .env',
    'grep -r . .env',
    'grep TOKEN .env',
    'awk 1 .env',
    'sed -n 1p .env',
    'python3 -c "print(1)" .env',
    'cat .env',
    'source .env',
    '. .env',
    'cp .env /tmp/copia',
  ];
  for (const role of ROLES) {
    for (const c of comandos) {
      const r = guard(role, c);
      assert.equal(r.code, 2, `${role}: ${c}`);
      assert.match(r.stderr, /\.env/);
    }
  }
});

test('bloquea variantes: .env.*, rutas, opciones con valor, redirecciones y subórdenes', opts, () => {
  const comandos = [
    'head .env.local',
    'head .env.production',
    'head ./.env',
    'head sub/dir/.env',
    'head "$PWD/.env"',
    'head .env*',
    'grep --file=.env x',
    'wc -l < .env',
    'echo hola > .env',
    'echo $(head .env)',
    'bash -c "head .env"',
    'eval "head .env"',
    'echo x | tee .env',
    'ls && head .env',
  ];
  for (const c of comandos) {
    assert.equal(guard('developer-teams', c).code, 2, c);
  }
});

test('permite .env.example y las órdenes que no tocan ficheros .env', opts, () => {
  const comandos = [
    'head .env.example',
    'cat ./.env.example',
    'git ls-files -ci --exclude-standard',
    'grep -n "\\.env" .gitignore',
    'git status --short',
    'ls -a',
    'gh issue comment 62 --body "no se lee el .env"',
    'npm test',
  ];
  for (const c of comandos) {
    assert.equal(guard('developer-teams', c).code, 0, c);
  }
});
