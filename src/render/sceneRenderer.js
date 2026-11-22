// Renderizado con Three.js. Solo dibuja; no contiene lógica de competición (RNF-05).
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';

export class SceneRenderer {
  #canvas;
  #config;
  #renderer;
  #scene;
  #camera;
  #disposables = [];
  #onResize = () => this.resize();

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} renderConfig sección `render` de CONFIG
   */
  constructor(canvas, renderConfig) {
    this.#canvas = canvas;
    this.#config = renderConfig;

    this.#renderer = new WebGLRenderer({ canvas, antialias: true });
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, renderConfig.maxPixelRatio));

    this.#scene = new Scene();
    this.#scene.background = new Color(renderConfig.backgroundColor);

    const cam = renderConfig.camera;
    this.#camera = new PerspectiveCamera(cam.fov, 1, cam.near, cam.far);
    this.#camera.position.set(...cam.position);
    this.#camera.lookAt(...cam.lookAt);

    this.#buildTestScene();
    this.resize();
    window.addEventListener('resize', this.#onResize);
  }

  #buildTestScene() {
    const { ground, light } = this.#config;

    const geometry = new PlaneGeometry(ground.size, ground.size);
    const material = new MeshStandardMaterial({ color: ground.color });
    const plane = new Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    this.#scene.add(plane);
    this.#disposables.push(geometry, material);

    const sun = new DirectionalLight(light.sunColor, light.sunIntensity);
    sun.position.set(...light.sunPosition);
    this.#scene.add(sun);
    this.#scene.add(new AmbientLight(light.ambientColor, light.ambientIntensity));
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

  /** Libera geometrías, materiales y el contexto WebGL (RNF-04). */
  dispose() {
    window.removeEventListener('resize', this.#onResize);
    for (const resource of this.#disposables) resource.dispose();
    this.#disposables = [];
    this.#renderer.dispose();
  }
}
