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
  Raycaster,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  type Object3D,
} from "three";
import {
  createMechAssembly,
  type MechAssembly,
  type MechEnvironment,
  type MechModuleSlot,
  type MechVisualConfiguration,
} from "@showcase/game-assets";
import type { MechConfiguration } from "../configuration/types";
import {
  createExplodedView,
  type ExplodedViewSnapshot,
} from "./create-exploded-view";

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
  exploded: ExplodedViewSnapshot;
}

export interface ConfiguratorSceneDiagnostics {
  /** Time between browser animation-frame callbacks; scheduler evidence only. */
  readonly rafIntervals: readonly number[];
  /** CPU duration spent in renderer.render for each callback. */
  readonly renderDurations: readonly number[];
  readonly renderer: {
    readonly calls: number;
    readonly triangles: number;
    readonly geometries: number;
    readonly textures: number;
  };
  readonly listeners: number;
  readonly resources: { readonly geometries: number; readonly textures: number };
  readonly quality: "full" | "no-shadows" | "key-light" | "control" | "empty";
  readonly pixelRatio: number;
}

export interface ConfiguratorSceneOptions {
  readonly quality?: "full" | "no-shadows" | "key-light" | "control" | "empty";
  readonly maxPixelRatio?: number;
}

export interface HotspotProjection {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
  readonly hiddenReason:
    | "visible"
    | "behind-camera"
    | "offscreen"
    | "occluded"
    | "invalid";
}

export interface ProductCapture {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
}

export interface ConfiguratorSceneController {
  readonly canvas: HTMLCanvasElement;
  readonly assembly: MechAssembly;
  updateConfiguration(config: MechConfiguration): void;
  setExploded(exploded: boolean): void;
  projectHotspot(slot: MechModuleSlot): HotspotProjection;
  onFrame(listener: () => void): () => void;
  captureProduct(width: number, height: number): Promise<ProductCapture>;
  resetView(): void;
  snapshot(): ConfiguratorSceneSnapshot;
  nonEmptyPixelCount(): number;
  diagnostics(): ConfiguratorSceneDiagnostics;
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
  options: ConfiguratorSceneOptions = {},
): ConfiguratorSceneController {
  const quality = options.quality ?? "full";
  const maxPixelRatio = options.maxPixelRatio ?? 1.5;
  const renderer = new WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = quality === "full";

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  const assembly = createMechAssembly(toVisualConfiguration(initial));
  scene.add(assembly.root);
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const explodedView = createExplodedView(assembly, {
    reducedMotion: reducedMotionQuery.matches,
  });

  const stage = createStage();
  scene.add(stage.root);

  const lights = createLights();
  if (quality === "key-light" || quality === "control") {
    lights.rim.visible = false;
    lights.accent.visible = false;
  }
  if (quality === "control") lights.key.visible = false;
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
  let previousFrameTime = performance.now();
  let previousExplodedProgress = 0;
  const frameListeners = new Set<() => void>();
  const rafIntervals: number[] = [];
  const renderDurations: number[] = [];
  const hotspotWorld = new Vector3();
  const hotspotView = new Vector3();
  const hotspotNdc = new Vector3();
  const hotspotDirection = new Vector3();
  const hotspotRaycaster = new Raycaster();
  const hotspotIntersections: ReturnType<Raycaster["intersectObject"]> = [];

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
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

  const reducedMotionChanged = (event: MediaQueryListEvent): void => {
    explodedView.setReducedMotion(event.matches);
    computeFit();
  };
  reducedMotionQuery.addEventListener("change", reducedMotionChanged);

  function renderFrame(timestamp: number): void {
    if (disposed) return;
    const frameMilliseconds = Math.min(Math.max(timestamp - previousFrameTime, 0), 100);
    if (frameMilliseconds > 0) {
      rafIntervals.push(frameMilliseconds);
      if (rafIntervals.length > 120) rafIntervals.shift();
    }
    const deltaSeconds = Math.min(
      frameMilliseconds / 1000,
      0.1,
    );
    previousFrameTime = timestamp;
    explodedView.update(deltaSeconds);
    const explodedProgress = explodedView.snapshot().progress;
    if (explodedProgress !== previousExplodedProgress) {
      previousExplodedProgress = explodedProgress;
      computeFit();
    }
    const renderStarted = performance.now();
    if (quality !== "empty") renderer.render(scene, camera);
    const renderDuration = performance.now() - renderStarted;
    renderDurations.push(renderDuration);
    if (renderDurations.length > 120) renderDurations.shift();
    for (const listener of frameListeners) listener();
    raf = requestAnimationFrame(renderFrame);
  }

  applyEnvironment(environment);
  resize();
  computeFit();
  renderFrame(performance.now());

  return {
    canvas,
    assembly,
    updateConfiguration(config) {
      assembly.updateConfiguration(toVisualConfiguration(config));
      explodedView.rebind();
      applyEnvironment(config.finish.environment);
      computeFit();
    },
    setExploded(exploded) {
      explodedView.setExploded(exploded);
      if (reducedMotionQuery.matches) computeFit();
    },
    projectHotspot(slot) {
      const hotspot = assembly.hotspots.get(slot);
      if (!hotspot || disposed) {
        return {
          x: 0,
          y: 0,
          visible: false,
          hiddenReason: "invalid",
        };
      }
      assembly.root.updateWorldMatrix(true, true);
      hotspot.getWorldPosition(hotspotWorld);
      hotspotView.copy(hotspotWorld).applyMatrix4(camera.matrixWorldInverse);
      hotspotNdc.copy(hotspotWorld).project(camera);
      if (
        !Number.isFinite(hotspotNdc.x) ||
        !Number.isFinite(hotspotNdc.y) ||
        !Number.isFinite(hotspotNdc.z)
      ) {
        return {
          x: 0,
          y: 0,
          visible: false,
          hiddenReason: "invalid",
        };
      }
      const x = (hotspotNdc.x * 0.5 + 0.5) * renderWidth;
      const y = (-hotspotNdc.y * 0.5 + 0.5) * renderHeight;
      const behindCamera = hotspotView.z >= 0;
      const offscreen =
        hotspotNdc.x < -1 ||
        hotspotNdc.x > 1 ||
        hotspotNdc.y < -1 ||
        hotspotNdc.y > 1 ||
        hotspotNdc.z < -1 ||
        hotspotNdc.z > 1;
      let occluded = false;
      if (!behindCamera && !offscreen) {
        const targetPart = assembly.parts.get(slot);
        const hotspotDistance = hotspotDirection
          .copy(hotspotWorld)
          .sub(camera.position)
          .length();
        if (targetPart && hotspotDistance > 0.001) {
          hotspotRaycaster.set(
            camera.position,
            hotspotDirection.multiplyScalar(1 / hotspotDistance),
          );
          hotspotRaycaster.near = 0;
          hotspotRaycaster.far = hotspotDistance + 0.08;
          hotspotIntersections.length = 0;
          hotspotRaycaster.intersectObject(
            assembly.root,
            true,
            hotspotIntersections,
          );
          const nearest = hotspotIntersections[0];
          occluded =
            nearest !== undefined &&
            !isDescendantOf(nearest.object, targetPart);
        }
      }
      return {
        x: MathUtils.clamp(x, 0, renderWidth),
        y: MathUtils.clamp(y, 0, renderHeight),
        visible: !behindCamera && !offscreen && !occluded,
        hiddenReason: behindCamera
          ? "behind-camera"
          : offscreen
            ? "offscreen"
            : occluded
              ? "occluded"
            : "visible",
      };
    },
    onFrame(listener) {
      if (disposed) return () => undefined;
      frameListeners.add(listener);
      listener();
      return () => frameListeners.delete(listener);
    },
    async captureProduct(width, height) {
      if (disposed) throw new Error("三维预览已关闭，请刷新页面后重试。");
      if (
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width < 1 ||
        height < 1 ||
        width > 2048 ||
        height > 2048
      ) {
        throw new Error("海报渲染尺寸无效，请刷新页面后重试。");
      }

      const renderTarget = new WebGLRenderTarget(width, height);
      renderTarget.texture.colorSpace = SRGBColorSpace;
      const captureCamera = camera.clone();
      const captureBounds = new Box3().setFromObject(assembly.root);
      const captureSize = captureBounds.getSize(new Vector3());
      const captureCenter = captureBounds.getCenter(new Vector3());
      const radius = Math.max(captureSize.length() / 2, 1);
      captureCamera.aspect = width / height;
      const verticalHalfAngle = MathUtils.degToRad(captureCamera.fov / 2);
      const horizontalHalfAngle = Math.atan(
        Math.tan(verticalHalfAngle) * captureCamera.aspect,
      );
      const captureDistance =
        (radius / Math.sin(Math.min(verticalHalfAngle, horizontalHalfAngle))) *
        1.16;
      const horizontal = Math.cos(pitch) * captureDistance;
      captureCamera.position.set(
        captureCenter.x + Math.sin(yaw) * horizontal,
        captureCenter.y + Math.sin(pitch) * captureDistance,
        captureCenter.z + Math.cos(yaw) * horizontal,
      );
      captureCamera.near = Math.max(0.05, captureDistance - radius * 2.5);
      captureCamera.far = captureDistance + radius * 6;
      captureCamera.lookAt(captureCenter);
      captureCamera.updateProjectionMatrix();

      const previousTarget = renderer.getRenderTarget();
      const previousBackground = scene.background;
      const previousFog = scene.fog;
      const previousStageVisibility = stage.root.visible;
      const previousClearColor = renderer.getClearColor(new Color()).clone();
      const previousClearAlpha = renderer.getClearAlpha();
      const source = new Uint8Array(width * height * 4);
      try {
        stage.root.visible = false;
        scene.background = null;
        scene.fog = null;
        renderer.setRenderTarget(renderTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(scene, captureCamera);
        renderer.readRenderTargetPixels(
          renderTarget,
          0,
          0,
          width,
          height,
          source,
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`无法读取当前机甲画面：${detail}`);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setClearColor(previousClearColor, previousClearAlpha);
        stage.root.visible = previousStageVisibility;
        scene.background = previousBackground;
        scene.fog = previousFog;
        renderTarget.dispose();
      }

      const pixels = new Uint8ClampedArray(source.length);
      const rowSize = width * 4;
      for (let y = 0; y < height; y += 1) {
        const sourceStart = (height - 1 - y) * rowSize;
        pixels.set(
          source.subarray(sourceStart, sourceStart + rowSize),
          y * rowSize,
        );
      }
      return { width, height, pixels };
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
        exploded: explodedView.snapshot(),
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
    diagnostics() {
      const render = renderer.info.render;
      const memory = renderer.info.memory;
      return {
        rafIntervals: [...rafIntervals],
        renderDurations: [...renderDurations],
        renderer: {
          calls: render.calls,
          triangles: render.triangles,
          geometries: memory.geometries,
          textures: memory.textures,
        },
        // Five canvas pointer/wheel handlers, one media-query listener, and
        // the active frame subscriber(s); ResizeObserver is tracked separately
        // by the browser and does not add a DOM listener.
        listeners: 6 + frameListeners.size,
        resources: {
          geometries: memory.geometries,
          textures: memory.textures,
        },
        quality,
        pixelRatio: renderer.getPixelRatio(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      frameListeners.clear();
      reducedMotionQuery.removeEventListener("change", reducedMotionChanged);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      explodedView.dispose();
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

function isDescendantOf(object: Object3D, root: Object3D): boolean {
  let current: Object3D | null = object;
  while (current) {
    if (current === root) return true;
    current = current.parent;
  }
  return false;
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
