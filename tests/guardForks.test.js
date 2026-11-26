import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Prueba del hook `.claude/hooks/guard.py` (issue #60): ni `gh pr checkout` ni
// `gh pr merge` pueden actuar sobre una PR abierta desde un fork. Se ejecuta el
// hook real con un `gh` falso en el PATH, que responde según FAKE_CROSS:
// `true`/`false` para isCrossRepository o `error` para simular un fallo de gh.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUARD = join(ROOT, '.claude', 'hooks', 'guard.py');

const FAKE_GH = `#!/bin/sh
case "$*" in
  *isCrossRepository*) [ "$FAKE_CROSS" = error ] && exit 1; echo "$FAKE_CROSS" ;;
  *closingIssuesReferences*) echo 60 ;;
  *baseRefName*) echo develop ;;
  *"issue view"*) echo "estado:validado" ;;
esac
`;

const binDir = mkdtempSync(join(tmpdir(), 'fake-gh-'));
writeFileSync(join(binDir, 'gh'), FAKE_GH);
chmodSync(join(binDir, 'gh'), 0o755);

const hasPython = spawnSync('python3', ['--version']).status === 0;

// Devuelve el código de salida del hook (0 permite, 2 bloquea) y su stderr.
function guard(role, command, cross) {
  const r = spawnSync('python3', ['-I', GUARD, role], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: ROOT }),
    env: { ...process.env, PATH: `${binDir}:${process.env.PATH}`, FAKE_CROSS: cross },
    encoding: 'utf8',
  });
  return { code: r.status, stderr: r.stderr };
}

const opts = { skip: !hasPython && 'python3 no disponible' };

test('bloquea gh pr checkout de una PR de fork (qa-teams y developer-teams)', opts, () => {
  for (const role of ['qa-teams', 'developer-teams']) {
    const r = guard(role, 'gh pr checkout 5', 'true');
    assert.equal(r.code, 2, role);
    assert.match(r.stderr, /fork/);
  }
});

test('bloquea gh pr checkout de un fork aunque lleve opciones antes del número', opts, () => {
  assert.equal(guard('qa-teams', 'gh pr checkout --detach -b rama-x 5', 'true').code, 2);
  assert.equal(guard('qa-teams', 'gh pr checkout -R owner/repo 5', 'true').code, 2);
});

test('bloquea gh pr merge de una PR de fork', opts, () => {
  const r = guard('developer-teams', 'gh pr merge 5 --squash --delete-branch', 'true');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /fork/);
});

test('permite gh pr checkout y gh pr merge de una PR del propio repositorio', opts, () => {
  assert.equal(guard('qa-teams', 'gh pr checkout 5', 'false').code, 0);
  assert.equal(guard('developer-teams', 'gh pr merge 5 --squash --delete-branch', 'false').code, 0);
});

test('bloquea si no se puede comprobar el origen de la PR', opts, () => {
  assert.equal(guard('qa-teams', 'gh pr checkout 5', 'error').code, 2);
  assert.equal(guard('developer-teams', 'gh pr merge 5 --squash', 'error').code, 2);
});

test('no afecta a gh pr view ni a gh pr list', opts, () => {
  assert.equal(guard('qa-teams', 'gh pr view 5 --comments', 'true').code, 0);
  assert.equal(guard('qa-teams', 'gh pr list --search "Closes #60" --json number', 'true').code, 0);
});

test.after(() => rmSync(binDir, { recursive: true, force: true }));
