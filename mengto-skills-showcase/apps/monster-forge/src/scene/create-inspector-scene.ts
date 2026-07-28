import { createProceduralMonster, type InspectorState, type MonsterDefinition, type MonsterInstance } from "@showcase/game-assets";
import { AmbientLight, Box3, Color, DirectionalLight, GridHelper, Group, HemisphereLight, type Material, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry, Vector3, WebGLRenderer } from "three";

export interface InspectorScene {
  setMonster(monster: MonsterDefinition): void;
  setState(state: InspectorState): void;
  dispose(): void;
}

interface InspectorSceneOptions { onUnavailable(): void; }

export function createInspectorScene(canvas: HTMLCanvasElement, options: InspectorSceneOptions): InspectorScene {
  let renderer: WebGLRenderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false }); }
  catch { options.onUnavailable(); return { setMonster() {}, setState() {}, dispose() {} }; }
  const scene = new Scene();
  scene.background = new Color("#17171a");
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  const orbit = new Group();
  scene.add(orbit);
  scene.add(new AmbientLight(0xffffff, 0.45));
  scene.add(new HemisphereLight(0xcbd4df, 0x2d2927, 1.15));
  const key = new DirectionalLight(0xfff0dd, 2.2); key.position.set(4, 6, 4); scene.add(key);
  const rim = new DirectionalLight(0xc4d9ff, 1.25); rim.position.set(-4, 3, -5); scene.add(rim);
  const grid = new GridHelper(8, 16, 0x756858, 0x38333a); scene.add(grid);
  const debug = new Group(); scene.add(debug);
  let current: MonsterInstance | undefined;
  let animationFrame = 0;
  let previousTime = performance.now();
  let disposed = false;
  let radius = 4;
  let yaw = -0.48;
  let pitch = 0.13;
  const activePointers = new Map<number, { x: number; y: number }>();
  let previousPinchDistance = 0;

  const placeCamera = () => {
    const horizontal = Math.cos(pitch) * radius;
    camera.position.set(Math.sin(yaw) * horizontal, Math.sin(pitch) * radius + 1, Math.cos(yaw) * horizontal);
    camera.lookAt(0, 1, 0);
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
  const clearDebug = () => { while (debug.children.length) { const child = debug.children.pop()!; child.traverse((node) => { if (node instanceof Mesh) { node.geometry.dispose(); (node.material as MeshBasicMaterial).dispose(); } }); } };
  const updateDebug = (state: InspectorState) => {
    clearDebug();
    if (!current) return;
    if (state.overlays.sockets) for (const socket of current.sockets.values()) { const marker = new Mesh(new SphereGeometry(0.045, 8, 6), new MeshBasicMaterial({ color: 0x90f3d3 })); socket.add(marker); debug.attach(marker); }
    if (state.overlays.colliders) { const marker = new Mesh(new SphereGeometry(current.collider.radius, 16, 10), new MeshBasicMaterial({ color: 0xff9b6c, wireframe: true })); marker.scale.y = current.collider.height / (current.collider.radius * 2); marker.position.y = current.collider.height / 2; debug.add(marker); }
    if (state.overlays.skeleton) for (const joint of current.joints.values()) { const marker = new Mesh(new SphereGeometry(0.025, 6, 4), new MeshBasicMaterial({ color: 0xf5d45e })); joint.add(marker); debug.attach(marker); }
  };
  const frame = (time: number) => {
    if (disposed) return;
    const delta = Math.min((time - previousTime) / 1000, 0.05); previousTime = time;
    current?.update(delta); renderer.render(scene, camera); animationFrame = requestAnimationFrame(frame);
  };
  const pointerDown = (event: PointerEvent) => { activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); canvas.setPointerCapture(event.pointerId); };
  const pointerMove = (event: PointerEvent) => {
    const previous = activePointers.get(event.pointerId); if (!previous) return;
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointers.size === 1) { yaw += (event.clientX - previous.x) * 0.012; pitch = Math.max(-0.55, Math.min(0.55, pitch + (event.clientY - previous.y) * 0.008)); placeCamera(); return; }
    const points = [...activePointers.values()]; const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
    if (previousPinchDistance) { radius = Math.max(1.2, Math.min(10, radius * previousPinchDistance / distance)); placeCamera(); }
    previousPinchDistance = distance;
  };
  const pointerUp = (event: PointerEvent) => { activePointers.delete(event.pointerId); previousPinchDistance = 0; };
  const wheel = (event: WheelEvent) => { event.preventDefault(); radius = Math.max(1.2, Math.min(10, radius * (event.deltaY > 0 ? 1.1 : 0.9))); placeCamera(); };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("wheel", wheel, { passive: false });
  resize(); placeCamera(); animationFrame = requestAnimationFrame(frame);

  return {
    setMonster(monster) {
      current?.dispose();
      current = createProceduralMonster(monster);
      current.root.position.y = -monster.bounds.groundOffset;
      orbit.add(current.root);
      const measured = new Box3().setFromObject(current.root);
      const size = measured.getSize(new Vector3());
      const center = measured.getCenter(new Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z, monster.bounds.height);
      radius = Math.max(2.2, maxDimension / (2 * Math.tan((camera.fov * Math.PI) / 360)) * 1.55);
      orbit.position.set(-center.x, -monster.bounds.groundOffset, -center.z);
      camera.lookAt(0, Math.max(0.5, size.y / 2), 0);
      previousTime = performance.now();
    },
    setState(state) { current?.playAction(state.action); current?.setPaused(state.paused); updateDebug(state); },
    dispose() {
      if (disposed) return; disposed = true; cancelAnimationFrame(animationFrame); resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown); canvas.removeEventListener("pointermove", pointerMove); canvas.removeEventListener("pointerup", pointerUp); canvas.removeEventListener("pointercancel", pointerUp); canvas.removeEventListener("wheel", wheel);
      clearDebug(); current?.dispose(); grid.geometry.dispose();
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      for (const material of gridMaterials as Material[]) material.dispose();
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
