import {
  createProceduralMonster,
  type InspectorState,
  type MonsterActionState,
  type MonsterDefinition,
  type MonsterInstance,
} from "@showcase/game-assets";
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  Group,
  HemisphereLight,
  type Material,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { createReviewOverlays, type ReviewOverlays } from "./create-overlays";

export type InspectorActionStatus = Readonly<MonsterActionState & { paused: boolean }>;

export interface InspectorSceneDiagnostics {
  readonly frameCount: number;
  readonly hasRendered: boolean;
  readonly rootCount: number;
  readonly selectedMonsterId: string | null;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly radius: number;
  readonly lastError: string | null;
  readonly action: InspectorActionStatus | null;
  readonly overlayNodeCount: number;
}

export interface InspectorScene {
  setMonster(monster: MonsterDefinition): void;
  setState(state: InspectorState): void;
  getDiagnostics(): InspectorSceneDiagnostics;
  dispose(): void;
}

export type InspectorUnavailableKind = "renderer-init-failed" | "model-creation-failed";

interface InspectorSceneOptions {
  onReady(): void;
  onUnavailable(error: unknown, kind: InspectorUnavailableKind): void;
  onActionState?(state: InspectorActionStatus): void;
  capture?: boolean;
}

export function getFrameDelta(
  previousTimestamp: number | undefined,
  timestamp: number,
): { delta: number; timestamp: number } {
  if (previousTimestamp === undefined) return { delta: 0, timestamp };
  return {
    delta: Math.max(0, Math.min((timestamp - previousTimestamp) / 1000, 0.05)),
    timestamp,
  };
}

export function runFrameStep(
  update: () => void,
  render: () => void,
  onFailure: (error: unknown) => void,
): boolean {
  try {
    update();
    render();
    return true;
  } catch (error) {
    onFailure(error);
    return false;
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function createInspectorScene(
  canvas: HTMLCanvasElement,
  options: InspectorSceneOptions,
): InspectorScene {
  let renderer: WebGLRenderer;
  try {
    // Review screenshots and deterministic pixel checks need the completed frame
    // to remain readable. This is intentionally limited to one inspector canvas;
    // catalog cards never create WebGL contexts and DPR remains capped at 2.
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: Boolean(options.capture),
      preserveDrawingBuffer: true,
    });
  } catch (error) {
    options.onUnavailable(error, "renderer-init-failed");
    return createUnavailableScene(error);
  }
  if (options.capture) renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  scene.background = options.capture ? null : new Color("#17171a");
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  const orbit = new Group();
  scene.add(orbit);
  scene.add(new AmbientLight(0xffffff, 0.45));
  scene.add(new HemisphereLight(0xcbd4df, 0x2d2927, 1.15));
  const key = new DirectionalLight(0xfff0dd, 2.2);
  key.position.set(4, 6, 4);
  scene.add(key);
  const rim = new DirectionalLight(0xc4d9ff, 1.25);
  rim.position.set(-4, 3, -5);
  scene.add(rim);
  const grid = options.capture ? undefined : new GridHelper(8, 16, 0x756858, 0x38333a);
  if (grid) scene.add(grid);
  let current: MonsterInstance | undefined;
  let overlays: ReviewOverlays | undefined;
  let selectedMonsterId: string | null = null;
  let animationFrame = 0;
  let previousTimestamp: number | undefined;
  let disposed = false;
  let failed = false;
  let hasRendered = false;
  let readyForCurrent = false;
  let frameCount = 0;
  let lastError: string | null = null;
  let radius = 4;
  let currentPaused = false;
  let actionRevision = -1;
  let yaw = -0.48;
  let pitch = 0.13;
  const target = new Vector3(0, 1, 0);
  const activePointers = new Map<number, { x: number; y: number }>();
  let previousPinchDistance = 0;

  const diagnostics = (): InspectorSceneDiagnostics =>
    Object.freeze({
      frameCount,
      hasRendered,
      rootCount: orbit.children.length,
      selectedMonsterId,
      target: Object.freeze({ x: target.x, y: target.y, z: target.z }),
      radius,
      lastError,
      action: current
        ? Object.freeze({ ...current.getActionState(), paused: currentPaused })
        : null,
      overlayNodeCount: current?.root.getObjectByName("review-overlays") ? 1 : 0,
    });

  const placeCamera = () => {
    const horizontal = Math.cos(pitch) * radius;
    camera.position.set(
      target.x + Math.sin(yaw) * horizontal,
      target.y + Math.sin(pitch) * radius,
      target.z + Math.cos(yaw) * horizontal,
    );
    camera.lookAt(target);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  const fail = (error: unknown) => {
    if (failed || disposed) return;
    failed = true;
    lastError = errorMessage(error);
    cancelAnimationFrame(animationFrame);
    options.onUnavailable(error, "model-creation-failed");
  };

  const frame = (timestamp: number) => {
    if (disposed || failed) return;
    const timing = getFrameDelta(previousTimestamp, timestamp);
    previousTimestamp = timing.timestamp;
    const succeeded = runFrameStep(
      () => {
        current?.update(timing.delta);
        overlays?.update();
        if (current) options.onActionState?.({ ...current.getActionState(), paused: currentPaused });
      },
      () => renderer.render(scene, camera),
      fail,
    );
    if (!succeeded) return;
    frameCount += 1;
    hasRendered = true;
    if (current && !readyForCurrent) {
      readyForCurrent = true;
      options.onReady();
      if (options.capture) document.documentElement.dataset.captureReady = "true";
    }
    animationFrame = requestAnimationFrame(frame);
  };

  const pointerDown = (event: PointerEvent) => {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent) => {
    const previous = activePointers.get(event.pointerId);
    if (!previous) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1) {
      yaw += (event.clientX - previous.x) * 0.012;
      pitch = Math.max(
        -0.55,
        Math.min(0.55, pitch + (event.clientY - previous.y) * 0.008),
      );
      placeCamera();
      return;
    }
    const points = [...activePointers.values()];
    const distance = Math.hypot(
      points[0]!.x - points[1]!.x,
      points[0]!.y - points[1]!.y,
    );
    if (previousPinchDistance) {
      radius = Math.max(
        1.2,
        Math.min(10, (radius * previousPinchDistance) / distance),
      );
      placeCamera();
    }
    previousPinchDistance = distance;
  };
  const pointerUp = (event: PointerEvent) => {
    activePointers.delete(event.pointerId);
    previousPinchDistance = 0;
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    radius = Math.max(
      1.2,
      Math.min(10, radius * (event.deltaY > 0 ? 1.1 : 0.9)),
    );
    placeCamera();
  };

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });
  resize();
  placeCamera();
  animationFrame = requestAnimationFrame(frame);

  const removeCurrent = () => {
    if (!current) return;
    overlays?.dispose();
    overlays = undefined;
    orbit.remove(current.root);
    current.dispose();
    current = undefined;
    selectedMonsterId = null;
  };

  return {
    setMonster(monster) {
      if (disposed || failed) return;
      try {
        removeCurrent();
        current = createProceduralMonster(monster);
        overlays = createReviewOverlays(current);
        selectedMonsterId = monster.id;
        current.root.position.y = -monster.bounds.groundOffset;
        orbit.add(current.root);
        const measured = new Box3().setFromObject(current.root);
        const size = measured.getSize(new Vector3());
        measured.getCenter(target);
        const verticalFov = (camera.fov * Math.PI) / 180;
        const horizontalFov =
          2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
        const verticalFit = size.y / (2 * Math.tan(verticalFov / 2));
        const horizontalFit =
          Math.max(size.x, size.z) / (2 * Math.tan(horizontalFov / 2));
        radius = Math.max(2.2, Math.max(verticalFit, horizontalFit) * 1.45);
        readyForCurrent = false;
        actionRevision = -1;
        currentPaused = false;
        placeCamera();
      } catch (error) {
        fail(error);
      }
    },
    setState(state) {
      if (disposed || failed) return;
      try {
        if (!current) return;
        if (state.actionRevision !== actionRevision) {
          current.playAction(state.action);
          actionRevision = state.actionRevision;
        }
        currentPaused = state.paused;
        current.setPaused(currentPaused);
        overlays?.setVisible("skeleton", state.overlays.skeleton);
        overlays?.setVisible("colliders", state.overlays.colliders);
        overlays?.setVisible("sockets", state.overlays.sockets);
        options.onActionState?.({ ...current.getActionState(), paused: currentPaused });
      } catch (error) {
        fail(error);
      }
    },
    getDiagnostics: diagnostics,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("wheel", wheel);
      removeCurrent();
      if (grid) {
        grid.geometry.dispose();
        const gridMaterials = Array.isArray(grid.material)
          ? grid.material
          : [grid.material];
        for (const material of gridMaterials as Material[]) material.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

function createUnavailableScene(error: unknown): InspectorScene {
  const lastError = errorMessage(error);
  return {
    setMonster() {},
    setState() {},
    getDiagnostics: () =>
      Object.freeze({
        frameCount: 0,
        hasRendered: false,
        rootCount: 0,
        selectedMonsterId: null,
        target: Object.freeze({ x: 0, y: 0, z: 0 }),
        radius: 0,
        lastError,
        action: null,
        overlayNodeCount: 0,
      }),
    dispose() {},
  };
}
