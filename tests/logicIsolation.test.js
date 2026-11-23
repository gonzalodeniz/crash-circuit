import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

// Prueba única de la separación lógica/renderizado (RNF-05): ningún fichero de
// `src/logic/` puede depender de Three.js, del DOM, de `render/`, de `ui/` ni de
// relojes del navegador. Los ficheros se leen de la carpeta, así que uno nuevo
// queda cubierto sin tocar esta prueba.

const LOGIC_DIR = new URL('../src/logic/', import.meta.url);

// Cada regla tiene un nombre legible y un patrón.
const FORBIDDEN = [
  { name: 'import de Three.js (con from)', pattern: /from\s+['"]three(\/[^'"]*)?['"]/ },
  { name: 'import de Three.js (sin from)', pattern: /import\s+['"]three(\/[^'"]*)?['"]/ },
  { name: 'import de render/', pattern: /from\s+['"]\.\.\/render\// },
  { name: 'import de ui/', pattern: /from\s+['"]\.\.\/ui\// },
  { name: 'DOM (document)', pattern: /\bdocument\b/ },
  { name: 'DOM (window)', pattern: /\bwindow\b/ },
  { name: 'requestAnimationFrame', pattern: /requestAnimationFrame/ },
  { name: 'Date.now', pattern: /Date\.now/ },
  { name: 'performance.now', pattern: /performance\.now/ },
  { name: 'setTimeout', pattern: /setTimeout/ },
  { name: 'setInterval', pattern: /setInterval/ },
];

function violations(source) {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name);
}

test('ningún fichero de src/logic/ depende de Three.js, del DOM, de render/, de ui/ ni de relojes del navegador', async () => {
  const files = (await readdir(LOGIC_DIR)).filter((file) => file.endsWith('.js'));
  assert.ok(files.length > 0, 'no se ha encontrado ningún fichero de lógica');
  for (const file of files) {
    const source = await readFile(new URL(file, LOGIC_DIR), 'utf8');
    assert.deepEqual(violations(source), [], `src/logic/${file} tiene dependencias prohibidas`);
  }
});

test('el patrón detecta cada forma de dependencia prohibida', () => {
  const examples = [
    "import 'three';",
    "import * as THREE from 'three';",
    "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';",
    "import { SceneRenderer } from '../render/sceneRenderer.js';",
    "import { MainMenu } from '../ui/mainMenu.js';",
    'document.getElementById("x");',
    'window.innerWidth;',
    'globalThis.document',
    'requestAnimationFrame(step);',
    'const t = Date.now();',
    'const t = performance.now();',
    'setTimeout(fn, 10);',
    'setInterval(fn, 10);',
  ];
  for (const example of examples) {
    assert.notDeepEqual(violations(example), [], `no detecta: ${example}`);
  }
});

test('el patrón no marca imports válidos ni código de lógica normal', () => {
  const valid = [
    "import { CONFIG } from '../config/config.js';",
    "import { buildTrack } from './track.js';",
    'const elapsed = state.time + dt;',
  ];
  for (const example of valid) {
    assert.deepEqual(violations(example), [], `falso positivo: ${example}`);
  }
});
