// Malla de un coche con Three.js a partir del aspecto de su modelo (RF-002). Solo dibuja: el
// rendimiento no depende del aspecto (RF-003). No necesita WebGL, así que se puede probar en Node.
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

/**
 * Crea el coche con el morro hacia +Z local: carrocería, cabina, cuatro ruedas y, según el modelo,
 * una franja y un alerón. Todos los modelos usan las mismas dimensiones (`length`, `width`).
 * @param {{length: number, width: number}} dimensions dimensiones del coche en metros (`race.car`)
 * @param {object} carConfig sección `render.car` de CONFIG
 * @param {object} appearance `appearance` del modelo (colores, proporciones y adornos)
 * @returns {{group: Group, disposables: Array<{dispose: () => void}>}} la malla y los recursos a liberar
 */
export function createCarMesh({ length, width }, carConfig, appearance) {
  const disposables = [];
  const track = (resource) => {
    disposables.push(resource);
    return resource;
  };
  const material = (color) => track(new MeshStandardMaterial({ color }));
  const box = (w, h, d, mat) => new Mesh(track(new BoxGeometry(w, h, d)), mat);
  const group = new Group();

  const bodyMaterial = material(appearance.bodyColor);
  const bodyHeight = carConfig.height * appearance.bodyHeightRatio;
  const body = box(width, bodyHeight, length, bodyMaterial);
  body.position.y = carConfig.wheelRadius + bodyHeight / 2;
  group.add(body);
  const bodyTop = body.position.y + bodyHeight / 2;

  const cabinHeight = carConfig.height * appearance.cabinHeightRatio;
  const cabin = box(
    width * appearance.cabinWidthRatio,
    cabinHeight,
    length * appearance.cabinLengthRatio,
    material(appearance.cabinColor),
  );
  cabin.position.set(0, body.position.y + cabinHeight, -length * appearance.cabinOffsetRatio);
  group.add(cabin);

  const accentMaterial = material(appearance.accentColor);
  if (appearance.stripe) {
    // Franja a lo largo del capó y el maletero, por delante y por detrás de la cabina.
    const { widthRatio, thickness } = carConfig.stripe;
    const stripe = box(width * widthRatio, thickness, length, accentMaterial);
    stripe.position.y = bodyTop + thickness / 2;
    group.add(stripe);
  }
  if (appearance.spoiler) {
    const { widthRatio, depth, thickness, lift, postWidth } = carConfig.spoiler;
    const z = -length / 2 + depth / 2;
    const post = box(postWidth, lift, depth / 2, accentMaterial);
    post.position.set(0, bodyTop + lift / 2, z);
    const wing = box(width * widthRatio, thickness, depth, accentMaterial);
    wing.position.set(0, bodyTop + lift + thickness / 2, z);
    group.add(post, wing);
  }

  const wheelMaterial = material(carConfig.wheelColor);
  const wheelGeometry = track(
    new CylinderGeometry(carConfig.wheelRadius, carConfig.wheelRadius, carConfig.wheelWidth, carConfig.wheelSegments),
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new Mesh(wheelGeometry, wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (width / 2), carConfig.wheelRadius, sz * (length / 2 - carConfig.wheelInset));
      group.add(wheel);
    }
  }

  return { group, disposables };
}
