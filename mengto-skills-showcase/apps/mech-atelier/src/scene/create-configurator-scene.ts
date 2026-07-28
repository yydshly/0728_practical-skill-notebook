import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three";
import {
  createMechAssembly,
  type MechAssembly,
  type MechEnvironment,
  type MechVisualConfiguration,
} from "@showcase/game-assets";
import type { MechConfiguration } from "../configuration/types";

export interface CameraDebugSnapshot {
  yaw: number;
  pitch: number;
  distance: number;
  boundsHeight: number;
  boundsWidth: number;
  boundsDepth: number;
  groundMinY: number;
  fitsBounds: boolean;
}

export interface ConfiguratorSceneSnapshot {
  rendererId: number;
  canvasId: number;
  sceneId: number;
  assemblyId: number;
  parts: Record<string, number>;
  environment: MechEnvironment;
  camera: CameraDebugSnapshot;
  rendererSize: { width: number; height: number };
}

export interface ConfiguratorSceneController {
  readonly canvas: HTMLCanvasElement;
  readonly assembly: MechAssembly;
  updateConfiguration(config: MechConfiguration): void;
  resetView(): void;
  snapshot(): ConfiguratorSceneSnapshot;
  nonEmptyPixelCount(): number;
  dispose(): void;
}

interface EnvironmentPreset {
  background: number;
  fog: number;
  hemisphereSky: number;
  hemisphereGround: number;
  ambient: number;
  key: number;
  rim: number;
  accent: number;
  platform: number;
  exposure: number;
}

const environmentPresets: Record<MechEnvironment, EnvironmentPreset> = {
  foundry: {
    background: 0x090908,
    fog: 0x17110e,
    hemisphereSky: 0x6d5542,
    hemisphereGround: 0x120e0b,
    ambient: 0xffd7b0,
    key: 0xff9a4b,
    rim: 0x74a9ff,
    accent: 0xff5a2e,
    platform: 0x24201d,
    exposure: 1.08,
  },
  hangar: {
    background: 0x080d13,
    fog: 0x111c28,
    hemisphereSky: 0xb9dcff,
    hemisphereGround: 0x10151d,
    ambient: 0xd9ecff,
    key: 0xdff2ff,
    rim: 0x4ab7ff,
    accent: 0x6ad1ff,
    platform: 0x1c2730,
    exposure: 1,
  },
  dusk: {
    background: 0x100b18,
    fog: 0x21142e,
    hemisphereSky: 0xd6a1ff,
    hemisphereGround: 0x17101c,
    ambient: 0xffd2c2,
    key: 0xffad81,
    rim: 0x9f7cff,
    accent: 0xff6a91,
    platform: 0x2b1e30,
    exposure: 1.03,
  },
};

const defaultYaw = 0.52;
const defaultPitch = 0.2;

export function createConfiguratorScene(
  canvas: HTMLCanvasElement,
  initial: MechConfiguration,
): ConfiguratorSceneController {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  const assembly = createMechAssembly(toVisualConfiguration(initial));
  scene.add(assembly.root);

  const stage = createStage();
  scene.add(stage.root);

  const lights = createLights();
  scene.add(lights.root);

  const target = new Vector3();
  const bounds = new Box3();
  const boundsSize = new Vector3();
  let environment: MechEnvironment = initial.finish.environment;
  let yaw = defaultYaw;
  let pitch = defaultPitch;
  let distance = 7;
  let baseDistance = 7;
  let minDistance = 4;
  let maxDistance = 12;
  let fitsBounds = false;
  let disposed = false;
  let raf = 0;
  let renderWidth = 1;
  let renderHeight = 1;

  const ids = new WeakMap<object, number>();
  let nextId = 1;
  const objectId = (object: object): number => {
    const existing = ids.get(object);
    if (existing !== undefined) return existing;
    const id = nextId;
    nextId += 1;
    ids.set(object, id);
    return id;
  };

  function applyEnvironment(next: MechEnvironment): void {
    environment = next;
    const preset = environmentPresets[next];
    scene.background = new Color(preset.background);
    scene.fog = new Fog(preset.fog, 11, 24);
    lights.hemisphere.color.setHex(preset.hemisphereSky);
    lights.hemisphere.groundColor.setHex(preset.hemisphereGround);
    lights.ambient.color.setHex(preset.ambient);
    lights.key.color.setHex(preset.key);
    lights.rim.color.setHex(preset.rim);
    lights.accent.color.setHex(preset.accent);
    stage.platformMaterial.color.setHex(preset.platform);
    stage.ringMaterial.color.setHex(preset.accent);
    renderer.toneMappingExposure = preset.exposure;
  }

  function updateCamera(): void {
    const horizontal = Math.cos(pitch) * distance;
    camera.position.set(
      target.x + Math.sin(yaw) * horizontal,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * horizontal,
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function computeFit(): void {
    assembly.root.updateWorldMatrix(true, true);
    bounds.setFromObject(assembly.root);
    bounds.getSize(boundsSize);
    bounds.getCenter(target);

    const radius = Math.max(boundsSize.length() / 2, 1);
    const verticalHalfAngle = MathUtils.degToRad(camera.fov / 2);
    const horizontalHalfAngle = Math.atan(
      Math.tan(verticalHalfAngle) * Math.max(camera.aspect, 0.5),
    );
    const limitingAngle = Math.min(verticalHalfAngle, horizontalHalfAngle);
    const previousRatio = baseDistance > 0 ? distance / baseDistance : 1;
    baseDistance = (radius / Math.sin(limitingAngle)) * 1.18;
    minDistance = baseDistance * 0.62;
    maxDistance = baseDistance * 1.65;
    distance = MathUtils.clamp(
      baseDistance * previousRatio,
      minDistance,
      maxDistance,
    );
    camera.near = Math.max(0.05, baseDistance - radius * 2.5);
    camera.far = baseDistance + radius * 6;

    const verticalCapacity =
      Math.tan(verticalHalfAngle) * baseDistance * 2;
    const horizontalCapacity = verticalCapacity * camera.aspect;
    fitsBounds =
      boundsSize.y <= verticalCapacity / 1.08 &&
      boundsSize.x <= horizontalCapacity / 1.08;
    updateCamera();
  }

  function resize(): void {
    const parent = canvas.parentElement;
    const width = Math.max(1, Math.round(parent?.clientWidth ?? canvas.clientWidth));
    const height = Math.max(
      1,
      Math.round(parent?.clientHeight ?? canvas.clientHeight),
    );
    if (width === renderWidth && height === renderHeight) return;
    renderWidth = width;
    renderHeight = height;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    computeFit();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas.parentElement ?? canvas);

  const pointers = new Map<number, Vector2>();
  let lastSingle: Vector2 | null = null;
  let pinchSpan = 0;

  const pointerDown = (event: PointerEvent): void => {
    canvas.focus({ preventScroll: true });
    pointers.set(event.pointerId, new Vector2(event.clientX, event.clientY));
    if (pointers.size === 1) {
      lastSingle = new Vector2(event.clientX, event.clientY);
    } else if (pointers.size === 2) {
      pinchSpan = pointerSpan(pointers);
      lastSingle = null;
    }
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic touch evidence can omit native capture state.
    }
  };

  const pointerMove = (event: PointerEvent): void => {
    if (!pointers.has(event.pointerId)) return;
    const current = new Vector2(event.clientX, event.clientY);
    pointers.set(event.pointerId, current);
    if (pointers.size >= 2) {
      const nextSpan = pointerSpan(pointers);
      if (pinchSpan > 0 && nextSpan > 0) {
        distance = MathUtils.clamp(
          distance * (pinchSpan / nextSpan),
          minDistance,
          maxDistance,
        );
      }
      pinchSpan = nextSpan;
      event.preventDefault();
      updateCamera();
      return;
    }
    if (lastSingle) {
      const deltaX = current.x - lastSingle.x;
      const deltaY = current.y - lastSingle.y;
      yaw -= deltaX * 0.008;
      pitch = MathUtils.clamp(pitch + deltaY * 0.006, -0.08, 0.58);
      lastSingle.copy(current);
      event.preventDefault();
      updateCamera();
    }
  };

  const pointerUp = (event: PointerEvent): void => {
    pointers.delete(event.pointerId);
    pinchSpan = pointers.size >= 2 ? pointerSpan(pointers) : 0;
    const remaining = [...pointers.values()][0];
    lastSingle = remaining?.clone() ?? null;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Capture may already be released by the browser.
    }
  };

  const wheel = (event: WheelEvent): void => {
    event.preventDefault();
    distance = MathUtils.clamp(
      distance * Math.exp(event.deltaY * 0.001),
      minDistance,
      maxDistance,
    );
    updateCamera();
  };

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });

  function renderFrame(): void {
    if (disposed) return;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(renderFrame);
  }

  applyEnvironment(environment);
  resize();
  computeFit();
  renderFrame();

  return {
    canvas,
    assembly,
    updateConfiguration(config) {
      assembly.updateConfiguration(toVisualConfiguration(config));
      applyEnvironment(config.finish.environment);
      computeFit();
    },
    resetView() {
      yaw = defaultYaw;
      pitch = defaultPitch;
      distance = baseDistance;
      updateCamera();
    },
    snapshot() {
      return {
        rendererId: objectId(renderer),
        canvasId: objectId(canvas),
        sceneId: objectId(scene),
        assemblyId: objectId(assembly),
        parts: Object.fromEntries(
          [...assembly.parts].map(([slot, part]) => [
            slot,
            objectId(part),
          ]),
        ),
        environment,
        camera: {
          yaw,
          pitch,
          distance,
          boundsHeight: boundsSize.y,
          boundsWidth: boundsSize.x,
          boundsDepth: boundsSize.z,
          groundMinY: bounds.min.y,
          fitsBounds,
        },
        rendererSize: {
          width: renderWidth,
          height: renderHeight,
        },
      };
    },
    nonEmptyPixelCount() {
      renderer.render(scene, camera);
      const drawingSize = renderer.getDrawingBufferSize(new Vector2());
      const width = Math.max(1, Math.floor(drawingSize.x));
      const height = Math.max(1, Math.floor(drawingSize.y));
      const pixels = new Uint8Array(width * height * 4);
      renderer.getContext().readPixels(
        0,
        0,
        width,
        height,
        renderer.getContext().RGBA,
        renderer.getContext().UNSIGNED_BYTE,
        pixels,
      );
      let count = 0;
      const stride = Math.max(4, Math.floor((width * height) / 12_000) * 4);
      for (let offset = 0; offset < pixels.length; offset += stride) {
        const red = pixels[offset] ?? 0;
        const green = pixels[offset + 1] ?? 0;
        const blue = pixels[offset + 2] ?? 0;
        if (red + green + blue > 88) count += 1;
      }
      return count;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      assembly.dispose();
      stage.dispose();
      lights.root.clear();
      renderer.dispose();
      scene.clear();
    },
  };
}

function pointerSpan(pointers: ReadonlyMap<number, Vector2>): number {
  const [first, second] = [...pointers.values()];
  return first && second ? first.distanceTo(second) : 0;
}

function toVisualConfiguration(
  config: MechConfiguration,
): MechVisualConfiguration {
  return {
    chassisId: config.chassisId,
    headId: config.headId,
    armorId: config.armorId,
    leftWeaponId: config.leftWeaponId,
    rightWeaponId: config.rightWeaponId,
    rearModuleId: config.rearModuleId,
    finish: {
      primary: config.finish.primary,
      secondary: config.finish.secondary,
      metalness: config.finish.metalness,
      roughness: config.finish.roughness,
    },
  };
}

function createLights(): {
  root: Group;
  hemisphere: HemisphereLight;
  ambient: AmbientLight;
  key: DirectionalLight;
  rim: DirectionalLight;
  accent: PointLight;
} {
  const root = new Group();
  root.name = "product-lighting";
  const hemisphere = new HemisphereLight(0xffffff, 0x111111, 1.2);
  const ambient = new AmbientLight(0xffffff, 0.55);
  const key = new DirectionalLight(0xffffff, 4.2);
  key.position.set(4.5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -2;
  const rim = new DirectionalLight(0x7aa7ff, 3);
  rim.position.set(-5, 4, -4);
  const accent = new PointLight(0xff6633, 18, 9, 2);
  accent.position.set(-3.5, 1.4, 2);
  root.add(hemisphere, ambient, key, rim, accent);
  return { root, hemisphere, ambient, key, rim, accent };
}

function createStage(): {
  root: Group;
  platformMaterial: MeshStandardMaterial;
  ringMaterial: MeshBasicMaterial;
  dispose(): void;
} {
  const root = new Group();
  root.name = "inspection-stage";
  const platformMaterial = new MeshStandardMaterial({
    color: 0x24201d,
    metalness: 0.72,
    roughness: 0.62,
  });
  const platformGeometry = new CylinderGeometry(3.35, 3.7, 0.18, 64);
  const platform = new Mesh(platformGeometry, platformMaterial);
  platform.name = "grounded-display-platform";
  platform.position.y = -0.09;
  platform.receiveShadow = true;
  platform.castShadow = true;
  root.add(platform);

  const shadowMaterial = new MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const shadowGeometry = new CircleGeometry(1.75, 48);
  const contact = new Mesh(shadowGeometry, shadowMaterial);
  contact.name = "contact-shadow";
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.008;
  contact.renderOrder = 2;
  root.add(contact);

  const floorMaterial = new MeshStandardMaterial({
    color: 0x0c0d0f,
    metalness: 0.18,
    roughness: 0.94,
    side: DoubleSide,
  });
  const floorGeometry = new PlaneGeometry(36, 36);
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.2;
  floor.receiveShadow = true;
  root.add(floor);

  const ringMaterial = new MeshBasicMaterial({
    color: 0xff6a35,
    transparent: true,
    opacity: 0.35,
  });
  const ringGeometries: TorusGeometry[] = [];
  for (const radius of [3.1, 4.15, 5.2]) {
    const geometry = new TorusGeometry(radius, 0.018, 5, 96);
    ringGeometries.push(geometry);
    const ring = new Mesh(geometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.185;
    root.add(ring);
  }

  return {
    root,
    platformMaterial,
    ringMaterial,
    dispose() {
      root.removeFromParent();
      platformGeometry.dispose();
      platformMaterial.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      ringGeometries.forEach((geometry) => geometry.dispose());
      ringMaterial.dispose();
      root.clear();
    },
  };
}
