import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  Scene,
  type Light,
  WebGLRenderer,
} from "three";
import {
  ARENA_LEVEL,
  type ArenaZone,
} from "../content/arena-level";
import type { QualityTier } from "../performance/create-quality-controller";

export interface ArenaScene {
  scene: Scene;
  renderer: WebGLRenderer;
  setQuality(quality: QualityTier): void;
  setGateOpen(open: boolean): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  render(camera: PerspectiveCamera): void;
  getDiagnostics(): {
    preserveDrawingBuffer: boolean;
    qualityTier: QualityTier;
    pixelRatio: number;
    drawingBufferWidth: number;
    drawingBufferHeight: number;
    shadowMapEnabled: boolean;
    activeLocalLights: number;
    localLights: Array<{
      id: string;
      emitterId: string;
      attached: boolean;
      emitterVisible: boolean;
    }>;
  };
  dispose(): void;
}

export function createArenaScene(
  canvas: HTMLCanvasElement,
  options: {
    preserveDrawingBuffer?: boolean;
    quality?: QualityTier;
  } = {},
): ArenaScene {
  const preserveDrawingBuffer = options.preserveDrawingBuffer ?? false;
  const scene = new Scene();
  scene.userData.provenance = {
    type: "procedural",
    factoryId: "create-arena-scene",
    source: "project-authored Three.js primitives and explicit level data",
    importedFiles: "none",
  };
  scene.background = new Color(0x121014);
  scene.fog = new Fog(0x121014, 22, 44);
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x121014, 1);
  renderer.shadowMap.enabled = false;
  let qualityTier = options.quality ?? "high";
  let lastWidth = 1;
  let lastHeight = 1;
  let lastDevicePixelRatio = 1;
  const localLights: Light[] = [];

  const ownedGeometry = new Set<BufferGeometry>();
  const ownedMaterial = new Set<MeshBasicMaterial | MeshStandardMaterial>();
  const track = <T extends Mesh>(mesh: T): T => {
    ownedGeometry.add(mesh.geometry);
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) =>
      ownedMaterial.add(material as MeshBasicMaterial | MeshStandardMaterial),
    );
    return mesh;
  };

  const groundMaterial = new MeshStandardMaterial({
    color: 0x30272a,
    roughness: 0.98,
    metalness: 0.02,
  });
  const floor = track(
    new Mesh(
      new PlaneGeometry(
        ARENA_LEVEL.width,
        ARENA_LEVEL.depth,
        12,
        8,
      ),
      groundMaterial,
    ),
  );
  floor.name = "visual-floor";
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ringColors: Record<ArenaZone["id"], number> = {
    training: 0xf0a342,
    wave: 0xaa5149,
    elite: 0xd6b65b,
    boss: 0xb83f52,
  };
  for (const zone of ARENA_LEVEL.zones) {
    const material = new MeshBasicMaterial({
      color: ringColors[zone.id],
      transparent: true,
      opacity: zone.id === "training" ? 0.68 : 0.25,
      depthWrite: false,
    });
    const ring = track(
      new Mesh(new RingGeometry(zone.radius - 0.08, zone.radius, 64), material),
    );
    ring.name = `visual-zone-${zone.id}`;
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(zone.x, 0.018, zone.z);
    scene.add(ring);
  }

  const collisionById = new Map(
    ARENA_LEVEL.collisions.map((collision) => [collision.id, collision]),
  );
  for (const visual of ARENA_LEVEL.collisionVisuals) {
    const collision = collisionById.get(visual.collisionId);
    if (!collision) {
      throw new Error(`Missing collision for visual: ${visual.id}`);
    }
    const material = new MeshStandardMaterial({
      color: visual.color,
      roughness: collision.kind === "interior" ? 0.74 : 0.9,
      metalness: collision.kind === "interior" ? 0.18 : 0.05,
    });
    const mesh = track(
      new Mesh(
        new BoxGeometry(
          collision.halfWidth * 2,
          collision.height,
          collision.halfDepth * 2,
        ),
        material,
      ),
    );
    mesh.name = visual.id;
    mesh.position.set(collision.x, collision.height / 2, collision.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.collisionId = collision.id;
    scene.add(mesh);
  }

  const gateCollision = collisionById.get("boss-gate");
  if (!gateCollision) throw new Error("Missing boss-gate collision");
  const gateMaterial = new MeshStandardMaterial({
    color: 0x805235,
    emissive: 0x35140d,
    emissiveIntensity: 0.45,
    roughness: 0.46,
    metalness: 0.58,
  });
  const gate = new Group();
  gate.name = "visual-boss-gate";
  gate.userData.collisionId = gateCollision.id;
  for (const x of [-2.25, -1.5, -0.75, 0, 0.75, 1.5, 2.25]) {
    const bar = track(
      new Mesh(
        new BoxGeometry(0.14, gateCollision.height, 0.22),
        gateMaterial,
      ),
    );
    bar.position.set(x, gateCollision.height / 2, 0);
    gate.add(bar);
  }
  gate.position.set(gateCollision.x, 0, gateCollision.z);
  scene.add(gate);

  const ambient = new AmbientLight(0x8d8a9b, 1.65);
  ambient.name = "ambient-ash-sky";
  scene.add(ambient);

  const brazierMetal = new MeshStandardMaterial({
    color: 0x3b3032,
    roughness: 0.56,
    metalness: 0.62,
  });
  const flameMaterial = new MeshBasicMaterial({ color: 0xffa24d });
  for (const record of ARENA_LEVEL.localLights) {
    const emitter = new Group();
    emitter.name = record.emitterId;
    emitter.position.set(record.position.x, 0, record.position.z);
    emitter.userData.visibleEmitter = true;
    const stem = track(
      new Mesh(new CylinderGeometry(0.12, 0.18, 1.05, 7), brazierMetal),
    );
    stem.position.y = 0.52;
    const bowl = track(
      new Mesh(new CylinderGeometry(0.42, 0.18, 0.22, 8), brazierMetal),
    );
    bowl.position.y = 1.08;
    const flame = track(
      new Mesh(new CylinderGeometry(0.03, 0.18, 0.42, 7), flameMaterial),
    );
    flame.name = `${record.emitterId}-flame`;
    flame.position.y = 1.38;
    emitter.add(stem, bowl, flame);
    const light = new PointLight(
      record.color,
      record.enabled ? record.intensity : 0,
      record.range,
      2,
    );
    light.name = record.id;
    light.position.y = 1.38;
    light.userData.emitterId = record.emitterId;
    emitter.add(light);
    localLights.push(light);
    scene.add(emitter);
  }

  const qualityProfiles: Record<
    QualityTier,
    {
      renderScale: number;
      maxPixelRatio: number;
      activeLocalLights: number;
    }
  > = {
    high: {
      renderScale: 1,
      maxPixelRatio: 2,
      activeLocalLights: localLights.length,
    },
    medium: {
      renderScale: 0.8,
      maxPixelRatio: 1.25,
      activeLocalLights: Math.ceil(localLights.length / 2),
    },
    low: {
      renderScale: 0.65,
      maxPixelRatio: 0.85,
      activeLocalLights: 0,
    },
  };
  const applyQuality = () => {
    const profile = qualityProfiles[qualityTier];
    renderer.setPixelRatio(
      Math.min(
        profile.maxPixelRatio,
        Math.max(0.5, lastDevicePixelRatio * profile.renderScale),
      ),
    );
    renderer.setSize(lastWidth, lastHeight, false);
    localLights.forEach((light, index) => {
      light.visible = index < profile.activeLocalLights;
    });
  };
  applyQuality();

  let disposed = false;
  return {
    scene,
    renderer,
    setQuality(quality) {
      if (quality === qualityTier) return;
      qualityTier = quality;
      applyQuality();
    },
    setGateOpen(open) {
      gate.position.y = open ? -gateCollision.height - 0.5 : 0;
      gate.visible = !open;
    },
    resize(width, height, pixelRatio = window.devicePixelRatio || 1) {
      lastWidth = Math.max(1, width);
      lastHeight = Math.max(1, height);
      lastDevicePixelRatio = Math.max(0.5, pixelRatio);
      applyQuality();
    },
    render(camera) {
      renderer.render(scene, camera);
    },
    getDiagnostics() {
      return {
        preserveDrawingBuffer,
        qualityTier,
        pixelRatio: renderer.getPixelRatio(),
        drawingBufferWidth: renderer.domElement.width,
        drawingBufferHeight: renderer.domElement.height,
        shadowMapEnabled: renderer.shadowMap.enabled,
        activeLocalLights: localLights.filter(({ visible }) => visible)
          .length,
        localLights: ARENA_LEVEL.localLights.map((record) => {
          const light = scene.getObjectByName(record.id);
          const emitter = scene.getObjectByName(record.emitterId);
          const flame = scene.getObjectByName(`${record.emitterId}-flame`);
          return {
            id: record.id,
            emitterId: record.emitterId,
            attached: light?.parent === emitter,
            emitterVisible: Boolean(emitter?.visible && flame?.visible),
          };
        }),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      ownedGeometry.forEach((geometry) => geometry.dispose());
      ownedMaterial.forEach((material) => material.dispose());
      renderer.dispose();
      scene.clear();
    },
  };
}
