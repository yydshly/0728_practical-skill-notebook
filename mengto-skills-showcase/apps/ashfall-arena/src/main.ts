import { createVesperKnight } from "@showcase/game-assets";
import { PerspectiveCamera, Vector3 } from "three";
import { arenaContent } from "./content/arena-content";
import { createInputAdapter } from "./input/create-input-adapter";
import { FixedStepAccumulator } from "./main-loop";
import { createArenaScene } from "./scene/create-arena-scene";
import { createGameCamera } from "./scene/create-game-camera";
import { resolveCameraOcclusion } from "./scene/resolve-camera-occlusion";
import { createEntitySynchronizer } from "./scene/sync-entities";
import { createInitialState } from "./simulation/create-initial-state";
import { stepGame } from "./simulation/step-game";
import type {
  GameEvent,
  GameIntent,
  GameState,
} from "./simulation/types";
import "./styles.css";

interface AshfallSnapshot {
  player: { x: number; z: number };
  cameraTarget: { x: number; z: number };
  canvasCount: number;
  playerRootCount: number;
  frameCount: number;
  tick: number;
  droppedSeconds: number;
  paused: boolean;
  preserveDrawingBuffer: boolean;
  input: GameIntent;
  lockTargetId: string | null;
  camera: {
    target: { x: number; y: number; z: number };
    desiredDistance: number;
    resolvedDistance: number;
    occlusionLimited: boolean;
    occluderId: string | null;
    lockFraming: boolean;
    reducedMotion: boolean;
    shakeAmplitude: number;
  };
  localLights: Array<{
    id: string;
    emitterId: string;
    attached: boolean;
    emitterVisible: boolean;
  }>;
}

interface AshfallReviewApi {
  snapshot(): AshfallSnapshot;
  triggerCameraShake(): void;
}

declare global {
  interface Window {
    __ashfallDiagnostics?: AshfallReviewApi;
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Ashfall Arena requires #app");

const query = new URLSearchParams(window.location.search);
const fixture = query.get("fixture") ?? "fresh";
const reviewControls = query.get("reviewControls") === "1";
const captureMode = query.get("capture") === "1";
document.documentElement.dataset.reviewControls = reviewControls ? "on" : "off";
if (fixture !== "fresh") {
  console.warn(`Unknown Task 2 fixture "${fixture}", using fresh.`);
}

app.innerHTML = `
  <main class="arena-shell">
    <header class="arena-header">
      <div>
        <p class="eyebrow">VESPER ORDER · FLAT ARENA TRIAL</p>
        <h1>灰烬竞技场</h1>
      </div>
      <p class="device-legend">键鼠 · 触控 · 标准手柄</p>
    </header>
    <section class="game-stage" aria-label="灰烬竞技场游戏画面">
      <canvas data-game-canvas aria-label="灰烬竞技场实时三维画面"></canvas>
      <aside class="hud" aria-label="玩家状态">
        <div class="hud__vitals">
          <span class="hud__label">生命</span>
          <strong data-health>105 / 105</strong>
          <span class="hud__meter"><i data-health-meter></i></span>
        </div>
        <div class="hud__vitals">
          <span class="hud__label">精力</span>
          <strong data-stamina>100 / 100</strong>
          <span class="hud__meter hud__meter--stamina"><i data-stamina-meter></i></span>
        </div>
        <div class="hud__loadout">
          <span>誓约刃</span>
          <span>治疗瓶 × 3</span>
        </div>
      </aside>
      <section class="objective-card" aria-live="polite">
        <p class="objective-card__kicker">当前目标</p>
        <h2>进入第一个琥珀训练环</h2>
        <p>使用 WASD 或左侧摇杆移动。攻击、格挡与闪避将在训练环内依次解锁。</p>
      </section>
      <div class="arena-status" role="status" aria-live="polite">训练阶段 · 闸门关闭</div>
    </section>
  </main>`;

const canvas = app.querySelector<HTMLCanvasElement>("[data-game-canvas]")!;
const stage = app.querySelector<HTMLElement>(".game-stage")!;
const health = app.querySelector<HTMLElement>("[data-health]")!;
const stamina = app.querySelector<HTMLElement>("[data-stamina]")!;
const healthMeter = app.querySelector<HTMLElement>("[data-health-meter]")!;
const staminaMeter = app.querySelector<HTMLElement>("[data-stamina-meter]")!;

let state: GameState = createInitialState(7481);
const arena = createArenaScene(canvas, {
  preserveDrawingBuffer: reviewControls || captureMode,
});
const player = createVesperKnight();
arena.scene.add(player.root);
const synchronizer = createEntitySynchronizer(player);
const camera = new PerspectiveCamera(42, 1, 0.1, 80);
let cameraOccluderId: string | null = null;
const cameraController = createGameCamera(camera, {
  bounds: {
    minX: arenaContent.arena.min.x,
    maxX: arenaContent.arena.max.x,
    minZ: arenaContent.arena.min.y,
    maxZ: arenaContent.arena.max.y,
  },
  resolveDistance(target, desiredPosition) {
    const result = resolveCameraOcclusion(
      target,
      desiredPosition,
      arenaContent.arena.collisions,
      state.encounter.gateOpen,
    );
    cameraOccluderId = result.occluderId;
    return result.distance;
  },
});
const input = createInputAdapter(canvas, stage);
const accumulator = new FixedStepAccumulator(1 / 60, 5, 0.25);
const playerTarget = new Vector3();
const trainingLockTarget = new Vector3(
  arenaContent.arena.trainingCenter.x,
  0.8,
  arenaContent.arena.trainingCenter.y,
);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
cameraController.setReducedMotion(reducedMotion.matches);

type PresentationEvent = {
  type: "camera-shake";
  amplitude: number;
  duration: number;
};
const presentationEvents: PresentationEvent[] = [];
let previousTimestamp: number | null = null;
let frameRequest = 0;
let frameCount = 0;
let disposed = false;

const dispatchPresentationEvent = (event: PresentationEvent) => {
  presentationEvents.push(event);
};

const routeGameplayEvents = (events: readonly GameEvent[]) => {
  if (
    events.some(
      (event) => event.type === "damage" && event.targetId === state.player.id,
    )
  ) {
    dispatchPresentationEvent({
      type: "camera-shake",
      amplitude: 0.16,
      duration: 0.22,
    });
  }
};

const lockCandidates = () => {
  const enemies = Object.values(state.enemies)
    .filter(({ health }) => health > 0)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((enemy) => ({
      id: enemy.id,
      target: new Vector3(enemy.position.x, 0.8, enemy.position.y),
    }));
  return enemies.length > 0
    ? enemies
    : [{ id: "training-lock-target", target: trainingLockTarget }];
};

const currentLockTarget = () => {
  if (state.player.lockTargetId === null) return null;
  return (
    lockCandidates().find(({ id }) => id === state.player.lockTargetId)
      ?.target ?? null
  );
};

const resize = () => {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  arena.resize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
};
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(stage);
resize();

playerTarget.set(state.player.position.x, 0, state.player.position.y);
cameraController.snapTo(playerTarget);
synchronizer.sync(state);
arena.setGateOpen(state.encounter.gateOpen);
arena.render(camera);

const step = (fixedDelta: number) => {
  const intent = input.sample();
  const result = stepGame(state, intent, fixedDelta, arenaContent);
  state = result.state;
  routeGameplayEvents(result.events);
};

const updateHud = () => {
  health.textContent = `${state.player.health} / ${state.player.maxHealth}`;
  stamina.textContent = `${Math.round(state.player.stamina)} / ${state.player.maxStamina}`;
  healthMeter.style.width = `${100 * state.player.health / state.player.maxHealth}%`;
  staminaMeter.style.width = `${100 * state.player.stamina / state.player.maxStamina}%`;
  document.documentElement.dataset.paused = state.paused ? "true" : "false";
};

const consumePresentationEvents = () => {
  for (const event of presentationEvents.splice(0)) {
    if (event.type === "camera-shake") {
      cameraController.shake(event.amplitude, event.duration);
    }
  }
};

const frame = (timestamp: number) => {
  if (disposed) return;
  const frameDelta =
    previousTimestamp === null
      ? 0
      : Math.max(0, (timestamp - previousTimestamp) / 1000);
  previousTimestamp = timestamp;
  accumulator.advance(frameDelta, step);
  synchronizer.sync(state);
  arena.setGateOpen(state.encounter.gateOpen);
  playerTarget.set(state.player.position.x, 0, state.player.position.y);
  cameraController.setLockTarget(currentLockTarget());
  consumePresentationEvents();
  cameraController.update(playerTarget, frameDelta);
  updateHud();
  arena.render(camera);
  frameCount += 1;
  frameRequest = requestAnimationFrame(frame);
};
frameRequest = requestAnimationFrame(frame);

const onVisibility = () => {
  previousTimestamp = null;
  accumulator.reset();
  input.clear();
};
const onReducedMotion = (event: MediaQueryListEvent) => {
  cameraController.setReducedMotion(event.matches);
};
document.addEventListener("visibilitychange", onVisibility);
reducedMotion.addEventListener("change", onReducedMotion);

if (reviewControls) {
  window.__ashfallDiagnostics = {
    snapshot() {
      const cameraDiagnostics = cameraController.getDiagnostics();
      const arenaDiagnostics = arena.getDiagnostics();
      return {
        player: {
          x: state.player.position.x,
          z: state.player.position.y,
        },
        cameraTarget: {
          x: cameraDiagnostics.target.x,
          z: cameraDiagnostics.target.z,
        },
        canvasCount: document.querySelectorAll("[data-game-canvas]").length,
        playerRootCount: arena.scene.children.filter(
          ({ name }) => name === "vesper-knight",
        ).length,
        frameCount,
        tick: state.tick,
        droppedSeconds: accumulator.getDiagnostics().droppedSeconds,
        paused: state.paused,
        preserveDrawingBuffer: arenaDiagnostics.preserveDrawingBuffer,
        input: input.getDiagnostics(),
        lockTargetId: state.player.lockTargetId,
        camera: {
          target: {
            x: cameraDiagnostics.target.x,
            y: cameraDiagnostics.target.y,
            z: cameraDiagnostics.target.z,
          },
          desiredDistance: cameraDiagnostics.desiredDistance,
          resolvedDistance: cameraDiagnostics.resolvedDistance,
          occlusionLimited: cameraDiagnostics.occlusionLimited,
          occluderId: cameraOccluderId,
          lockFraming: cameraDiagnostics.lockFraming,
          reducedMotion: cameraDiagnostics.reducedMotion,
          shakeAmplitude: cameraDiagnostics.shakeAmplitude,
        },
        localLights: arenaDiagnostics.localLights,
      };
    },
    triggerCameraShake() {
      dispatchPresentationEvent({
        type: "camera-shake",
        amplitude: 0.2,
        duration: 0.45,
      });
    },
  };
}

const dispose = () => {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frameRequest);
  resizeObserver.disconnect();
  document.removeEventListener("visibilitychange", onVisibility);
  reducedMotion.removeEventListener("change", onReducedMotion);
  input.dispose();
  synchronizer.dispose();
  cameraController.dispose();
  player.dispose();
  arena.dispose();
  delete window.__ashfallDiagnostics;
  document.documentElement.dataset.runtimeDisposed = "true";
};
window.addEventListener("pagehide", dispose, { once: true });
