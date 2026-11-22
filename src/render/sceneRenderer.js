// Renderizado con Three.js. Solo dibuja; no contiene lógica de competición (RNF-05).
import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { rightOf } from '../logic/track.js';

export class SceneRenderer {
  #config;
  #renderer;
  #scene;
  #camera;
  // Todo lo que pertenece a la carrera actual y se libera al salir de ella (RNF-04).
  #raceGroup = null;
  #raceDisposables = [];
  #carMeshes = new Map();
  #onResize = () => this.resize();

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} renderConfig sección `render` de CONFIG
   */
  constructor(canvas, renderConfig) {
    this.#config = renderConfig;

    this.#renderer = new WebGLRenderer({ canvas, antialias: true });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, renderConfig.maxPixelRatio));

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
    window.addEventListener('resize', this.#onResize);
  }

  /** Registra un recurso de la carrera para liberarlo después. */
  #track(resource) {
    this.#raceDisposables.push(resource);
    return resource;
  }

  /**
   * Crea la escena de la carrera: suelo, calzada, meta y un coche por participante.
   * Si ya había una, la libera antes.
   * @param {{track: object, participants: object[], car: {length: number, width: number}}} race estado de la carrera (lógica)
   */
  buildRace(race) {
    this.disposeRace();
    const { ground, road } = this.#config;
    this.#raceGroup = new Group();

    const groundGeometry = this.#track(new PlaneGeometry(ground.size, ground.size));
    const groundMaterial = this.#track(new MeshStandardMaterial({ color: ground.color }));
    const groundMesh = new Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.1;
    this.#raceGroup.add(groundMesh);

    // Borde blanco (más ancho y ligeramente más bajo) y calzada encima.
    this.#addRibbon(race.track, race.track.width + road.borderExtra * 2, 0, road.borderColor);
    this.#addRibbon(race.track, race.track.width, 0.05, road.color);
    this.#addFinishLine(race.track);

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
    const geometry = this.#track(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    // Orden de vértices tal que la cara visible mira hacia arriba (Y+).
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = this.#track(new MeshStandardMaterial({ color }));
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
        const value = (row + column) % 2 === 0 ? 255 : 20;
        data.set([value, value, value, 255], (row * columns + column) * 4);
      }
    }
    const texture = this.#track(new DataTexture(data, columns, rows, RGBAFormat));
    texture.colorSpace = SRGBColorSpace;
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.needsUpdate = true;

    const geometry = this.#track(new PlaneGeometry(track.width, finishLine.depth));
    const material = this.#track(new MeshStandardMaterial({ map: texture }));
    const mesh = new Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    // Con rotation.y = rumbo, el ancho del plano (eje X) queda atravesado respecto al avance.
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = track.finish.heading;
    mesh.position.set(track.finish.x, 0.1, track.finish.z);
    this.#raceGroup.add(mesh);
  }

  // Coche simple (carrocería, cabina y cuatro ruedas) con el morro hacia +Z local.
  #addCar(participant, race) {
    const car = this.#config.car;
    const { length, width } = race.car;
    const group = new Group();

    const bodyMaterial = this.#track(new MeshStandardMaterial({ color: car.bodyColor }));
    const cabinMaterial = this.#track(new MeshStandardMaterial({ color: car.cabinColor }));
    const wheelMaterial = this.#track(new MeshStandardMaterial({ color: car.wheelColor }));

    const bodyGeometry = this.#track(new BoxGeometry(width, car.height * 0.5, length));
    const body = new Mesh(bodyGeometry, bodyMaterial);
    body.position.y = car.wheelRadius + (car.height * 0.5) / 2;
    group.add(body);

    const cabinGeometry = this.#track(new BoxGeometry(width * 0.8, car.height * 0.45, length * 0.45));
    const cabin = new Mesh(cabinGeometry, cabinMaterial);
    cabin.position.set(0, body.position.y + car.height * 0.45, -length * 0.08);
    group.add(cabin);

    const wheelGeometry = this.#track(new CylinderGeometry(car.wheelRadius, car.wheelRadius, 0.4, 16));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * (width / 2), car.wheelRadius, sz * (length / 2 - 0.9));
        group.add(wheel);
      }
    }

    this.#carMeshes.set(participant.id, group);
    this.#raceGroup.add(group);
    this.updateCar(participant);
  }

  /** Coloca el coche de un participante en su pose (x, z, rumbo). */
  updateCar(participant) {
    const group = this.#carMeshes.get(participant.id);
    if (!group) return;
    group.position.set(participant.x, 0, participant.z);
    group.rotation.y = participant.heading;
  }

  /** Coloca la cámara con la posición y el punto de mira calculados por la lógica. */
  setCamera({ position, target }) {
    this.#camera.position.set(...position);
    this.#camera.lookAt(...target);
  }

  /** Adapta el lienzo y la cámara al tamaño de la ventana. */
  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
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
    this.#raceGroup = null;
  }

  /** Libera la carrera y el contexto WebGL (RNF-04). */
  dispose() {
    window.removeEventListener('resize', this.#onResize);
    this.disposeRace();
    this.#renderer.dispose();
  }
}
