// Renderizado con Three.js. Solo dibuja; no contiene lógica de competición (RNF-05).
import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
} from 'three';
import { rightOf } from '../logic/track.js';
import { ParticipantStatus } from '../logic/race.js';
import { createCarMesh } from './carMesh.js';
import { createDamageVisuals } from './damageVisuals.js';

export class SceneRenderer {
  #config;
  #carModels;
  #renderer;
  #scene;
  #camera;
  // Todo lo que pertenece a la carrera actual y se libera al salir de ella (RNF-04).
  #raceGroup = null;
  #raceDisposables = [];
  #carMeshes = new Map();
  #carDamage = new Map();
  // Vista previa de la selección: plataforma fija y coche giratorio, con recursos aparte (RNF-04).
  #previewGroup = null;
  #previewDisposables = [];
  #previewCar = null;
  #previewCarDisposables = [];
  #viewport;
  #removeResizeListener;

  /**
   * El renderizador y la ventana llegan por parámetro (los crea `main.js`) para que la escena se pueda
   * construir y probar en Node, con un renderizador falso, sin WebGL ni DOM.
   * @param {object} renderer renderizador de Three.js (`WebGLRenderer`) o uno con `setPixelRatio`, `setSize`, `render` y `dispose`
   * @param {{width: () => number, height: () => number, pixelRatio: () => number, onResize: (listener: () => void) => () => void}} viewport
   *   tamaño y densidad de píxeles de la ventana, y registro del aviso de cambio de tamaño (devuelve la función que lo quita)
   * @param {object} renderConfig sección `render` de CONFIG
   * @param {Array<{id: string, appearance: object}>} carModels catálogo de modelos (`cars.models` de CONFIG)
   */
  constructor(renderer, viewport, renderConfig, carModels) {
    this.#config = renderConfig;
    this.#carModels = carModels;
    this.#viewport = viewport;

    this.#renderer = renderer;
    this.#renderer.setPixelRatio(Math.min(viewport.pixelRatio(), renderConfig.maxPixelRatio));

    this.#scene = new Scene();
    this.#scene.background = new Color(renderConfig.backgroundColor);

    const cam = renderConfig.camera;
    this.#camera = new PerspectiveCamera(cam.fov, 1, cam.near, cam.far);
    this.#camera.position.set(...cam.position);
    this.#camera.lookAt(...cam.lookAt);

    const { light } = renderConfig;
    const sun = new DirectionalLight(light.sunColor, light.sunIntensity);
    sun.position.set(...light.sunPosition);
    this.#scene.add(sun);
    this.#scene.add(new AmbientLight(light.ambientColor, light.ambientIntensity));

    this.resize();
    this.#removeResizeListener = viewport.onResize(() => this.resize());
  }

  /** Registra un recurso de la carrera para liberarlo después. */
  #disposable(resource) {
    this.#raceDisposables.push(resource);
    return resource;
  }

  /**
   * Crea la escena de la carrera: suelo, calzada, meta, límites, obstáculos y un coche por participante,
   * con su daño visual.
   * Si ya había una, la libera antes.
   * @param {{track: object, scenery: object, participants: object[], car: {length: number, width: number}}} race
   *   estado de la carrera (lógica)
   */
  buildRace(race) {
    this.disposeRace();
    const { ground, road, layers } = this.#config;
    this.#raceGroup = new Group();

    const groundGeometry = this.#disposable(new PlaneGeometry(ground.size, ground.size));
    const groundMaterial = this.#disposable(new MeshStandardMaterial({ color: ground.color }));
    const groundMesh = new Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = layers.ground;
    this.#raceGroup.add(groundMesh);

    // Borde blanco (más ancho y ligeramente más bajo) y calzada encima.
    this.#addRibbon(race.track, race.track.width + road.borderExtra * 2, layers.border, road.borderColor);
    this.#addRibbon(race.track, race.track.width, layers.road, road.color);
    this.#addFinishLine(race.track);
    this.#addScenery(race.scenery);

    for (const participant of race.participants) this.#addCar(participant, race);
    this.#scene.add(this.#raceGroup);
  }

  // Cinta plana siguiendo la línea central, con la anchura indicada y a la altura `y`.
  #addRibbon(track, width, y, color) {
    const count = track.points.length;
    const positions = new Float32Array(count * 2 * 3);
    const indices = [];
    for (let i = 0; i < count; i++) {
      const heading = track.headings[i];
      // La normal de un vértice es la media de los rumbos de sus dos tramos vecinos.
      const previous = track.headings[(i - 1 + count) % count];
      const mean = Math.atan2(Math.sin(heading) + Math.sin(previous), Math.cos(heading) + Math.cos(previous));
      const right = rightOf(mean);
      const point = track.points[i];
      const half = width / 2;
      positions.set([point.x - right.x * half, y, point.z - right.z * half], i * 6);
      positions.set([point.x + right.x * half, y, point.z + right.z * half], i * 6 + 3);
      const next = (i + 1) % count; // el último tramo cierra la cinta con el primero
      indices.push(i * 2, i * 2 + 1, next * 2, i * 2 + 1, next * 2 + 1, next * 2);
    }
    const geometry = this.#disposable(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    // Orden de vértices tal que la cara visible mira hacia arriba (Y+).
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = this.#disposable(new MeshStandardMaterial({ color }));
    this.#raceGroup.add(new Mesh(geometry, material));
  }

  // Línea de meta a cuadros, atravesada en la calzada en el punto de meta.
  #addFinishLine(track) {
    const { finishLine } = this.#config.road;
    const columns = finishLine.checkerColumns;
    const rows = finishLine.checkerRows;
    const data = new Uint8Array(columns * rows * 4);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const value = (row + column) % 2 === 0 ? finishLine.lightShade : finishLine.darkShade;
        data.set([value, value, value, 255], (row * columns + column) * 4);
      }
    }
    const texture = this.#disposable(new DataTexture(data, columns, rows, RGBAFormat));
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.needsUpdate = true;

    const geometry = this.#disposable(new PlaneGeometry(track.width, finishLine.depth));
    const material = this.#disposable(new MeshStandardMaterial({ map: texture }));
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    // Con rotation.y = rumbo, el ancho del plano (eje X) queda atravesado respecto al avance.
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = track.finish.heading;
    mesh.position.set(track.finish.x, this.#config.layers.finishLine, track.finish.z);
    this.#raceGroup.add(mesh);
  }

  // Límite exterior y obstáculos (RF-015), tal y como los da la lógica; comparten geometrías y materiales.
  #addScenery({ bounds, obstacles }) {
    const group = new Group();
    group.name = 'scenery';
    this.#addLimits(group, bounds);

    const { tyres, rock } = this.#config.obstacles;
    const layerHeight = tyres.height / tyres.layers;
    const layerGeometry = this.#disposable(
      new CylinderGeometry(1, 1, layerHeight * (1 - tyres.layerGapRatio), tyres.segments),
    );
    const tyreMaterials = tyres.colors.map((color) => this.#disposable(new MeshStandardMaterial({ color })));
    const rockGeometry = this.#disposable(new DodecahedronGeometry(1));
    const rockMaterial = this.#disposable(new MeshStandardMaterial({ color: rock.color, flatShading: true }));

    obstacles.forEach((obstacle, index) => {
      if (obstacle.type === 'rock') {
        const mesh = new Mesh(rockGeometry, rockMaterial);
        mesh.scale.set(obstacle.radius, obstacle.radius * rock.heightRatio, obstacle.radius);
        mesh.position.set(obstacle.x, (obstacle.radius * rock.heightRatio) / 2, obstacle.z);
        mesh.rotation.y = index; // giro distinto en cada roca para que no parezcan iguales
        group.add(mesh);
        return;
      }
      for (let layer = 0; layer < tyres.layers; layer++) {
        const mesh = new Mesh(layerGeometry, tyreMaterials[index % tyreMaterials.length]);
        mesh.scale.set(obstacle.radius, 1, obstacle.radius);
        mesh.position.set(obstacle.x, layerHeight * (layer + 0.5), obstacle.z);
        group.add(mesh);
      }
    });
    this.#raceGroup.add(group);
  }

  // Muro exterior: cuatro tramos con la cara interior justo en el límite.
  #addLimits(group, { minX, maxX, minZ, maxZ }) {
    const { color, height, thickness } = this.#config.limits;
    const material = this.#disposable(new MeshStandardMaterial({ color }));
    const wall = (width, depth, x, z) => {
      const mesh = new Mesh(this.#disposable(new BoxGeometry(width, height, depth)), material);
      mesh.position.set(x, height / 2, z);
      group.add(mesh);
    };
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const spanX = maxX - minX + 2 * thickness;
    wall(spanX, thickness, centerX, minZ - thickness / 2);
    wall(spanX, thickness, centerX, maxZ + thickness / 2);
    wall(thickness, maxZ - minZ, minX - thickness / 2, centerZ);
    wall(thickness, maxZ - minZ, maxX + thickness / 2, centerZ);
  }

  // Coche del participante con el aspecto de su modelo (RF-002) y su daño visual (RF-034); sus recursos
  // se liberan con la carrera.
  #addCar(participant, race) {
    const appearance = this.#carModels.find((model) => model.id === participant.carModelId).appearance;
    const { group, disposables, body } = createCarMesh(race.car, this.#config.car, appearance);
    const damage = createDamageVisuals(race.car, this.#config.damage, body);
    group.add(damage.group);
    this.#raceDisposables.push(...disposables, ...damage.disposables);
    this.#carMeshes.set(participant.id, group);
    this.#carDamage.set(participant.id, damage);
    this.#raceGroup.add(group);
    this.updateCar(participant);
  }

  /** Coloca el coche de un participante en su pose (x, z, rumbo), muestra su daño y, si está destruido, lo aplasta. */
  updateCar(participant) {
    const group = this.#carMeshes.get(participant.id);
    if (!group) return;
    group.position.set(participant.x, 0, participant.z);
    group.rotation.y = participant.heading;
    const destroyed = participant.status === ParticipantStatus.DESTRUIDO;
    group.scale.y = destroyed ? this.#config.damage.wreck.heightScale : 1;
    this.#carDamage.get(participant.id).update(participant.damage, destroyed);
  }

  /**
   * Muestra en una plataforma el coche del modelo indicado, con su aspecto, y coloca la cámara de la
   * vista previa. Si ya había otro modelo, libera antes su geometría y sus materiales (RNF-04).
   * @param {{length: number, width: number}} dimensions dimensiones del coche (`race.car`)
   * @param {string} modelId identificador del modelo
   */
  showCarPreview(dimensions, modelId) {
    const preview = this.#config.carPreview;
    if (!this.#previewGroup) {
      this.#previewGroup = new Group();
      const { ground } = this.#config;
      const groundMesh = new Mesh(
        this.#previewResource(new PlaneGeometry(ground.size, ground.size)),
        this.#previewResource(new MeshStandardMaterial({ color: ground.color })),
      );
      groundMesh.rotation.x = -Math.PI / 2;
      groundMesh.position.y = this.#config.layers.ground;
      const platform = new Mesh(
        this.#previewResource(new CylinderGeometry(preview.platformRadius, preview.platformRadius, preview.platformHeight, preview.platformSegments)),
        this.#previewResource(new MeshStandardMaterial({ color: preview.platformColor })),
      );
      platform.position.y = -preview.platformHeight / 2; // la cara superior queda a y = 0
      this.#previewGroup.add(groundMesh, platform);
      this.#scene.add(this.#previewGroup);
    }
    this.#disposePreviewCar();
    const appearance = this.#carModels.find((model) => model.id === modelId).appearance;
    const { group, disposables } = createCarMesh(dimensions, this.#config.car, appearance);
    this.#previewCarDisposables = disposables;
    this.#previewCar = group;
    this.#previewGroup.add(group);
    this.setCamera({ position: preview.cameraPosition, target: preview.cameraTarget });
  }

  #previewResource(resource) {
    this.#previewDisposables.push(resource);
    return resource;
  }

  /** Gira el coche de la vista previa `dt` segundos. */
  spinCarPreview(dt) {
    if (this.#previewCar) this.#previewCar.rotation.y += this.#config.carPreview.spinSpeed * dt;
  }

  #disposePreviewCar() {
    if (this.#previewCar) this.#previewGroup.remove(this.#previewCar);
    for (const resource of this.#previewCarDisposables) resource.dispose();
    this.#previewCarDisposables = [];
    this.#previewCar = null;
  }

  /** Libera la vista previa: coche, plataforma y suelo (RNF-04). */
  disposePreview() {
    this.#disposePreviewCar();
    if (this.#previewGroup) this.#scene.remove(this.#previewGroup);
    for (const resource of this.#previewDisposables) resource.dispose();
    this.#previewDisposables = [];
    this.#previewGroup = null;
  }

  /** Coloca la cámara con la posición y el punto de mira calculados por la lógica. */
  setCamera({ position, target }) {
    this.#camera.position.set(...position);
    this.#camera.lookAt(...target);
  }

  /** Adapta el lienzo y la cámara al tamaño de la ventana. */
  resize() {
    const width = this.#viewport.width();
    const height = this.#viewport.height();
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  render() {
    this.#renderer.render(this.#scene, this.#camera);
  }

  /** Libera geometrías, materiales y texturas de la carrera y la quita de la escena (RNF-04). */
  disposeRace() {
    if (this.#raceGroup) this.#scene.remove(this.#raceGroup);
    for (const resource of this.#raceDisposables) resource.dispose();
    this.#raceDisposables = [];
    this.#carMeshes.clear();
    this.#carDamage.clear();
    this.#raceGroup = null;
  }

  /** Libera la carrera, la vista previa y el contexto WebGL (RNF-04). */
  dispose() {
    this.#removeResizeListener();
    this.disposeRace();
    this.disposePreview();
    this.#renderer.dispose();
  }
}
