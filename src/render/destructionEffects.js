// Efecto de destrucción (RF-037): piezas que salen despedidas del coche, chispas y humo. Solo dibuja: qué
// coche está destruido y desde cuándo lo decide la lógica (`logic/destruction.js`). No necesita WebGL, así
// que se puede probar en Node.
//
// Las piezas de todas las destrucciones salen de una reserva fija por carrera (un `InstancedMesh` por clase,
// es decir, tres llamadas de dibujo): destruir coches no crea geometrías ni materiales, y nunca se pasa del
// máximo por destrucción ni del máximo total.
//
// La posición de cada elemento es una función del tiempo activo transcurrido desde la destrucción, así que
// el efecto se detiene con la simulación (pausa) y no depende de los FPS.
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { wreckElapsed } from '../logic/destruction.js';

/** Ángulo áureo (rad): reparte las direcciones de salida sin que se alineen. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Número en [0, 1) fijo para cada índice y `salt`, para variar tamaños y velocidades sin azar. */
const spread = (index, salt) => (index * 0.6180339887 + salt) % 1;

/**
 * Elementos que le tocan a cada destrucción: el máximo por destrucción o, si entre todas pasarían del
 * máximo total, una parte igual para cada una (jugador y rivales por igual).
 * @param {{perWreck: number, maxTotal: number}} limits
 * @param {number} wrecks destrucciones que se están mostrando
 */
export function effectShare({ perWreck, maxTotal }, wrecks) {
  return wrecks > 0 ? Math.min(perWreck, Math.floor(maxTotal / wrecks)) : 0;
}

/**
 * Crea la reserva de piezas, chispas y humo de una carrera, sin nada visible.
 * @param {{length: number, width: number}} dimensions dimensiones del coche en metros (`race.car`)
 * @param {object} config sección `render.destructionEffect` de CONFIG
 * @param {{wheelColor: number, ground: number}} look color de las piezas oscuras y altura del suelo en el
 *   que se posan las piezas
 * @returns {{group: Group, disposables: Array<{dispose: () => void}>,
 *   track: (participant: object, appearance: object) => void, draw: () => void}} `group` se añade a la escena
 *   de la carrera; `track` anota si un participante muestra el efecto y `draw` coloca los de todos
 */
export function createDestructionEffects({ length, width }, config, { wheelColor, ground }) {
  const disposables = [];
  const disposable = (resource) => {
    disposables.push(resource);
    return resource;
  };
  const group = new Group();
  group.name = 'destruction';

  // Reserva de una clase de elementos: `maxTotal` instancias, de las que se dibujan las `count` primeras.
  const pool = (name, limits, geometry, material) => {
    const mesh = disposable(new InstancedMesh(disposable(geometry), disposable(material), limits.maxTotal));
    mesh.name = name;
    // Las instancias se mueven por todo el circuito: la caja envolvente inicial no sirve para descartarlas.
    mesh.frustumCulled = false;
    mesh.count = 0;
    group.add(mesh);
    return mesh;
  };

  const fragments = pool(
    'fragments',
    config.fragments,
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ flatShading: true }),
  );
  // El color por instancia se reserva desde el principio, antes del primer dibujo.
  const color = new Color();
  for (let i = 0; i < config.fragments.maxTotal; i++) fragments.setColorAt(i, color);
  const sparks = pool(
    'sparks',
    config.sparks,
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: config.sparks.color }),
  );
  const smoke = pool(
    'smoke',
    config.smoke,
    new SphereGeometry(1, 8, 6),
    new MeshBasicMaterial({ color: config.smoke.color, transparent: true, opacity: config.smoke.opacity, depthWrite: false }),
  );

  // Destrucciones que se están mostrando, por identificador de participante.
  const active = new Map();
  const piece = new Object3D();

  function place(mesh, index) {
    piece.updateMatrix();
    mesh.setMatrixAt(index, piece.matrix);
  }

  // Punto de partida en el contorno del coche y dirección de salida del elemento `i`, en el mundo.
  function launch({ x, z, heading }, i) {
    const angle = i * GOLDEN_ANGLE;
    const across = Math.sin(angle) * (width / 2);
    const along = Math.cos(angle) * (length / 2);
    return {
      x: x + across * Math.cos(heading) + along * Math.sin(heading),
      z: z - across * Math.sin(heading) + along * Math.cos(heading),
      dx: Math.sin(heading + angle),
      dz: Math.cos(heading + angle),
    };
  }

  // Pieza `i`: sale despedida, gira, cae y se queda en el suelo.
  function placeFragment(wreck, i, index) {
    const { minSize, maxSize, thickness, speed, lift, spin } = config.fragments;
    const { gravity } = config;
    const side = minSize + (maxSize - minSize) * spread(i, 0.5);
    const start = launch(wreck, i);
    const height = 0.5 + spread(i, 0.2) / 2;
    const rest = ground + thickness / 2;
    const out = speed * (0.4 + 0.6 * spread(i, 0.7));
    const up = lift * (0.4 + 0.6 * spread(i, 0.1));
    const landing = (up + Math.sqrt(up * up + 2 * gravity * (height - rest))) / gravity;
    const t = Math.min(wreck.elapsed, landing);
    piece.position.set(
      start.x + start.dx * out * t,
      t < landing ? height + up * t - (gravity * t * t) / 2 : rest,
      start.z + start.dz * out * t,
    );
    // Al posarse queda plana, con el giro que lleve respecto a la vertical.
    const tumble = t < landing ? spin * t : 0;
    piece.rotation.set(tumble, i + spin * t * spread(i, 0.3), tumble * spread(i, 0.9));
    piece.scale.set(side, thickness, side * (0.5 + spread(i, 0.4)));
    place(fragments, index);
    fragments.setColorAt(index, color.setHex(wreck.palette[i % wreck.palette.length]));
  }

  // Chispa `i`: estallido que se encoge hasta apagarse.
  function placeSpark(wreck, i, index) {
    const { size, speed, lift, life } = config.sparks;
    const t = wreck.elapsed;
    const start = launch(wreck, i);
    const out = speed * (0.3 + 0.7 * spread(i, 0.6));
    const up = lift * (0.3 + 0.7 * spread(i, 0.2));
    piece.position.set(
      start.x + start.dx * out * t,
      Math.max(ground, 0.8 + up * t - (config.gravity * t * t) / 2),
      start.z + start.dz * out * t,
    );
    piece.rotation.set(i, i, 0);
    piece.scale.setScalar(size * Math.max(0, 1 - t / life));
    place(sparks, index);
  }

  // Bocanada `i` de `count`: sale del coche, sube y crece; al final de su ciclo se encoge y vuelve a salir.
  function placeSmoke(wreck, i, count, index) {
    const { radius, rise, drift, growth, period } = config.smoke;
    const local = wreck.elapsed - (i / count) * period;
    const phase = local < 0 ? 0 : (local % period) / period;
    const angle = i * GOLDEN_ANGLE;
    piece.position.set(
      wreck.x + Math.sin(angle) * drift * phase,
      0.6 + rise * phase,
      wreck.z + Math.cos(angle) * drift * phase,
    );
    piece.rotation.set(0, angle, 0);
    // Las bocanadas que aún no han salido tienen tamaño cero.
    const fade = Math.min(1, (1 - phase) * 4);
    piece.scale.setScalar(local < 0 ? 0 : radius * (1 + growth * phase) * fade);
    place(smoke, index);
  }

  /**
   * Anota el efecto de un participante según su estado: lo muestra mientras está destruido (`wreck`) y no
   * ha pasado `duration`, y lo retira en cuanto reaparece.
   * @param {{id: string, x: number, z: number, heading: number, wreck: object|null}} participant
   * @param {{bodyColor: number, cabinColor: number, accentColor: number}} appearance aspecto de su modelo
   */
  function track({ id, x, z, heading, wreck }, appearance) {
    const elapsed = wreck ? wreckElapsed(wreck) : Infinity;
    if (elapsed >= config.duration) {
      active.delete(id);
      return;
    }
    const { bodyColor, cabinColor, accentColor } = appearance;
    const palette = [bodyColor, accentColor, bodyColor, cabinColor, bodyColor, wheelColor];
    active.set(id, { x, z, heading, elapsed, palette });
  }

  /** Coloca los elementos de todas las destrucciones anotadas, sin pasar de los máximos. */
  function draw() {
    const fragmentShare = effectShare(config.fragments, active.size);
    const sparkShare = effectShare(config.sparks, active.size);
    const smokeShare = effectShare(config.smoke, active.size);
    let fragmentCount = 0;
    let sparkCount = 0;
    let smokeCount = 0;
    for (const wreck of active.values()) {
      for (let i = 0; i < fragmentShare; i++) placeFragment(wreck, i, fragmentCount++);
      if (wreck.elapsed < config.sparks.life) {
        for (let i = 0; i < sparkShare; i++) placeSpark(wreck, i, sparkCount++);
      }
      for (let i = 0; i < smokeShare; i++) placeSmoke(wreck, i, smokeShare, smokeCount++);
    }
    for (const [mesh, count] of [[fragments, fragmentCount], [sparks, sparkCount], [smoke, smokeCount]]) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
    fragments.instanceColor.needsUpdate = true;
  }

  return { group, disposables, track, draw };
}
