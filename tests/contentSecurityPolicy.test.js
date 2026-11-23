import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contentSecurityPolicyPlugin, CONTENT_SECURITY_POLICY } from '../vite.config.js';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

test('la CSP contiene las directivas mínimas exigidas', () => {
  const directives = CONTENT_SECURITY_POLICY.split('; ');
  for (const d of [
    "default-src 'self'",
    "script-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ]) {
    assert.ok(directives.includes(d), `falta la directiva ${d}`);
  }
});

test('el plugin inserta la etiqueta meta de CSP en el head, con comillas literales', () => {
  const out = contentSecurityPolicyPlugin().transformIndexHtml(html);
  assert.match(out, /<head>\s*<meta http-equiv="Content-Security-Policy" content="[^"]*default-src 'self'/);
  assert.ok(out.includes(`content="${CONTENT_SECURITY_POLICY}"`));
  assert.equal(out.match(/Content-Security-Policy/g).length, 1);
});

test('la CSP solo se aplica al build, no al servidor de desarrollo', () => {
  assert.equal(contentSecurityPolicyPlugin().apply, 'build');
});

test('src/index.html no tiene scripts ni estilos en línea que la CSP bloquearía', () => {
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/);
  assert.doesNotMatch(html, /<style|\sstyle=|\sonclick=/);
});
