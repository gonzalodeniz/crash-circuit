import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Prueba del hook `.claude/hooks/guard.py` con el flujo de ramas develop/main:
// las issues se integran en `develop` y `main` solo recibe la PR de cada entrega
// aceptada. Se ejecuta el hook real con un `gh` falso en el PATH que responde
// según las variables FAKE_HEAD, FAKE_BASE, FAKE_TITLE y FAKE_ACEPTACION.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUARD = join(ROOT, '.claude', 'hooks', 'guard.py');

const FAKE_GH = `#!/bin/sh
case "$*" in
  *isCrossRepository*) echo false ;;
  *headRefName*) printf '%s\\t%s\\t%s\\n' "$FAKE_HEAD" "$FAKE_BASE" "$FAKE_TITLE" ;;
  *baseRefName*) echo "$FAKE_BASE" ;;
  *closingIssuesReferences*) echo 60 ;;
  *"issue list"*) [ -n "$FAKE_ACEPTACION" ] && echo "$FAKE_ACEPTACION" ;;
  *"issue view"*) echo "estado:validado" ;;
esac
exit 0
`;

const binDir = mkdtempSync(join(tmpdir(), 'fake-gh-ramas-'));
writeFileSync(join(binDir, 'gh'), FAKE_GH);
chmodSync(join(binDir, 'gh'), 0o755);

const hasPython = spawnSync('python3', ['--version']).status === 0;
const opts = { skip: !hasPython && 'python3 no disponible' };

// Devuelve el código de salida del hook (0 permite, 2 bloquea) y su stderr.
function guard(role, command, fake = {}) {
  const r = spawnSync('python3', ['-I', GUARD, role], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: ROOT }),
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      FAKE_HEAD: fake.head ?? 'develop',
      FAKE_BASE: fake.base ?? 'main',
      FAKE_TITLE: fake.title ?? 'E3 · Entrega',
      FAKE_ACEPTACION: fake.aceptacion ?? 'etiquetas=',
    },
    encoding: 'utf8',
  });
  return { code: r.status, stderr: r.stderr };
}

test('developer-teams no hace commit ni push en develop ni en main', opts, () => {
  for (const rama of ['develop', 'main']) {
    assert.equal(guard('developer-teams', `git switch ${rama} && git commit -m x`).code, 2, rama);
    assert.equal(guard('developer-teams', `git push origin ${rama}`).code, 2, rama);
  }
  assert.equal(guard('developer-teams', 'git switch -c feat/1-x && git commit -m x').code, 0);
});

test('developer-teams abre sus PR solo contra develop', opts, () => {
  assert.equal(guard('developer-teams', 'gh pr create --draft --base develop --title t --body "Closes #1"').code, 0);
  assert.equal(guard('developer-teams', 'gh pr create --draft --base=develop --title t').code, 0);
  assert.equal(guard('developer-teams', 'gh pr create --draft --base main --title t').code, 2);
  assert.equal(guard('developer-teams', 'gh pr create --draft --title t').code, 2);
});

test('developer-teams solo fusiona PR que van contra develop', opts, () => {
  assert.equal(guard('developer-teams', 'gh pr merge 5 --squash --delete-branch', { base: 'develop' }).code, 0);
  const r = guard('developer-teams', 'gh pr merge 5 --squash --delete-branch', { base: 'main' });
  assert.equal(r.code, 2);
  assert.match(r.stderr, /develop/);
});

test('doc-teams trabaja solo en develop', opts, () => {
  assert.equal(guard('doc-teams', 'git switch develop && git commit -m x').code, 0);
  assert.equal(guard('doc-teams', 'git switch develop && git push').code, 0);
  assert.equal(guard('doc-teams', 'git switch main').code, 2);
});

test('product-manager solo crea la PR de la entrega develop → main', opts, () => {
  assert.equal(guard('product-manager', 'gh pr create --base main --head develop --title "E3 · Entrega" --body x').code, 0);
  assert.equal(guard('product-manager', 'gh pr create --base develop --head feat/1-x --title "E3 · Entrega"').code, 2);
  assert.equal(guard('product-manager', 'gh pr create --base main --head develop --title "Otra cosa"').code, 2);
});

test('product-manager fusiona la PR de la entrega con merge commit si la aceptación no espera decisión', opts, () => {
  assert.equal(guard('product-manager', 'gh pr merge 9 --merge').code, 0);
  assert.equal(guard('product-manager', 'gh pr merge 9 --merge', { aceptacion: 'etiquetas=otra' }).code, 0);
});

test('product-manager no fusiona la entrega con squash, rebase ni borrando develop', opts, () => {
  for (const flags of ['--squash', '--rebase', '--merge --delete-branch', '--merge --admin', '']) {
    assert.equal(guard('product-manager', `gh pr merge 9 ${flags}`).code, 2, flags);
  }
});

test('product-manager no fusiona sin aceptación o con requiere-decision', opts, () => {
  assert.match(guard('product-manager', 'gh pr merge 9 --merge', { aceptacion: '' }).stderr, /no existe/);
  assert.equal(
    guard('product-manager', 'gh pr merge 9 --merge', { aceptacion: 'etiquetas=requiere-decision' }).code, 2);
});

test('product-manager no fusiona PR que no sean la de la entrega', opts, () => {
  assert.equal(guard('product-manager', 'gh pr merge 9 --merge', { head: 'feat/1-x', base: 'develop' }).code, 2);
  assert.equal(guard('product-manager', 'gh pr merge 9 --merge', { title: 'E3 · Otra' }).code, 2);
});

test.after(() => rmSync(binDir, { recursive: true, force: true }));
