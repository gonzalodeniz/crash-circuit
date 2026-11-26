// Daño visual de un coche (RF-034). Solo dibuja el daño que decide la lógica (`logic/impact.js`): marcas
// y carrocería ennegrecida, que se quedan hasta el final de la carrera, y chispas y humo que duran lo que
// la reacción al golpe. No necesita WebGL, así que se puede probar en Node.
import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry } from 'three';
import { ImpactSeverity } from '../logic/impact.js';

/** Ángulo áureo (rad): reparte las chispas alrededor del coche sin que se alineen. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Crea las piezas del daño de un coche, ocultas hasta que haya golpes.
 * @param {{length: number, width: number}} dimensions dimensiones del coche en metros (`race.car`)
 * @param {object} config sección `render.damage` de CONFIG
 * @param {{material: {color: Color}, bottom: number, height: number}} body carrocería (`createCarMesh`)
 * @returns {{group: Group, disposables: Array<{dispose: () => void}>, update: (damage: object) => void}}
 *   `group` se añade a la malla del coche; `update` recibe el `damage` del participante
 */
export function createDamageVisuals({ length, width }, config, body) {
  const disposables = [];
  const disposable = (resource) => {
    disposables.push(resource);
    return resource;
  };
  const group = new Group();
  group.name = 'damage';

  const cleanColor = body.material.color.clone();
  const sootColor = new Color(config.sootColor);

  const markMaterial = disposable(new MeshStandardMaterial({ color: config.markColor }));
  const marks = {};
  for (const severity of Object.values(ImpactSeverity)) {
    marks[severity] = new Group();
    marks[severity].name = `marks-${severity}`;
    for (const { at: [x, y, z], size, turn } of config.marks[severity]) {
      const mesh = new Mesh(disposable(new BoxGeometry(...size)), markMaterial);
      mesh.position.set(x * width, body.bottom + y * body.height, z * length);
      mesh.rotation.y = turn;
      marks[severity].add(mesh);
    }
    group.add(marks[severity]);
  }

  const { sparks, smoke } = config;
  const sparkGeometry = disposable(new BoxGeometry(1, 1, 1));
  const sparkMaterial = disposable(new MeshBasicMaterial({ color: sparks.color }));
  const sparkGroup = new Group();
  sparkGroup.name = 'sparks';
  const sparkCount = Math.max(...Object.values(ImpactSeverity).map((severity) => sparks[severity].count));
  for (let i = 0; i < sparkCount; i++) sparkGroup.add(new Mesh(sparkGeometry, sparkMaterial));

  const smokeGeometry = disposable(new SphereGeometry(smoke.radius, 8, 6));
  const smokeMaterial = disposable(
    new MeshBasicMaterial({ color: smoke.color, transparent: true, opacity: smoke.opacity, depthWrite: false }),
  );
  const smokeGroup = new Group();
  smokeGroup.name = 'smoke';
  for (let i = 0; i < smoke.count; i++) smokeGroup.add(new Mesh(smokeGeometry, smokeMaterial));
  group.add(sparkGroup, smokeGroup);

  const top = body.bottom + body.height;

  // Chispas que saltan desde el contorno del coche y vuelven a caer; `progress` va de 0 a 1.
  function placeSparks({ count, size, spread }, progress) {
    sparkGroup.children.forEach((spark, i) => {
      spark.visible = i < count;
      if (!spark.visible) return;
      const angle = i * GOLDEN_ANGLE;
      const reach = spread * progress * (0.5 + (i % 3) / 4);
      spark.position.set(
        Math.sin(angle) * (width / 2 + reach),
        top * 0.7 + sparks.rise * Math.sin(Math.PI * progress) * ((i % 4) + 1) / 4,
        Math.cos(angle) * (length / 2 + reach),
      );
      spark.scale.setScalar(size * (1 - progress / 2));
      spark.rotation.set(angle, angle, 0);
    });
  }

  // Humo que sale del capó, sube y crece.
  function placeSmoke(progress) {
    smokeGroup.children.forEach((puff, i) => {
      const delay = i / smoke.count; // cada bocanada va algo por detrás de la anterior
      const age = Math.max(0, progress - delay / 2);
      puff.position.set(((i % 2) - 0.5) * width * 0.4, top + age * smoke.rise, length * (0.3 - delay * 0.2));
      puff.scale.setScalar(1 + age * smoke.growth);
    });
  }

  let shown = null;
  function update(damage) {
    if (damage === shown) return; // el estado de daño es inmutable: si es el mismo, no hay nada que cambiar
    shown = damage;
    marks[ImpactSeverity.LIGHT].visible = damage.worst !== null;
    marks[ImpactSeverity.STRONG].visible = damage.worst === ImpactSeverity.STRONG;
    body.material.color.copy(cleanColor).lerp(sootColor, damage.level * config.maxDarkening);

    sparkGroup.visible = damage.effect !== null;
    smokeGroup.visible = damage.effect === ImpactSeverity.STRONG;
    if (damage.effect === null) return;
    const progress = 1 - damage.effectTime / damage.effectDuration;
    placeSparks(sparks[damage.effect], progress);
    if (smokeGroup.visible) placeSmoke(progress);
  }
  update({ level: 0, worst: null, effect: null });

  return { group, disposables, update };
}
