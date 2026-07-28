import { createVesperKnight } from "@showcase/game-assets";
import { PerspectiveCamera, Vector3 } from "three";
import { arenaContent } from "./content/arena-content";
import { createInputAdapter } from "./input/create-input-adapter";
import { FixedStepAccumulator } from "./main-loop";
import {
  createArenaScene,
  resolveArenaMovement,
} from "./scene/create-arena-scene";
import { createGameCamera } from "./scene/create-game-camera";
import { createEntitySynchronizer } from "./scene/sync-entities";
import { createInitialState } from "./simulation/create-initial-state";
import { stepGame } from "./simulation/step-game";
import type { GameState } from "./simulation/types";
import "./styles.css";

declare global {
  interface Window {
    __ashfallDiagnostics: {
      snapshot(): {
        player: { x: number; z: number };
        cameraTarget: { x: number; z: number };
        canvasCount: number;
        tick: number;
        droppedSeconds: number;
        paused: boolean;
        localLights: Array<{
          id: string;
          emitterId: string;
          attached: boolean;
          emitterVisible: boolean;
        }>;
      };
    };
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Ashfall Arena requires #app");

const query = new URLSearchParams(window.location.search);
const fixture = query.get("fixture") ?? "fresh";
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

const arena = createArenaScene(canvas);
const player = createVesperKnight();
arena.scene.add(player.root);
const synchronizer = createEntitySynchronizer(player);
const camera = new PerspectiveCamera(42, 1, 0.1, 80);
const cameraController = createGameCamera(camera);
const input = createInputAdapter(canvas, stage);
const accumulator = new FixedStepAccumulator(1 / 60, 5, 0.25);
const playerTarget = new Vector3();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
cameraController.setReducedMotion(reducedMotion.matches);

let state: GameState = createInitialState(7481);
let previousTimestamp: number | null = null;
let frameRequest = 0;
let disposed = false;

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
  const previousPosition = state.player.position;
  const result = stepGame(state, input.sample(), fixedDelta, arenaContent);
  const candidate = result.state.player.position;
  const resolved = resolveArenaMovement(
    { x: previousPosition.x, z: previousPosition.y },
    { x: candidate.x, z: candidate.y },
    0.35,
    result.state.encounter.gateOpen,
  );
  state =
    resolved.x === candidate.x && resolved.z === candidate.y
      ? result.state
      : {
          ...result.state,
          player: {
            ...result.state.player,
            position: { x: resolved.x, y: resolved.z },
          },
        };
};

const updateHud = () => {
  health.textContent = `${state.player.health} / ${state.player.maxHealth}`;
  stamina.textContent = `${Math.round(state.player.stamina)} / ${state.player.maxStamina}`;
  healthMeter.style.width = `${100 * state.player.health / state.player.maxHealth}%`;
  staminaMeter.style.width = `${100 * state.player.stamina / state.player.maxStamina}%`;
  document.documentElement.dataset.paused = state.paused ? "true" : "false";
};

const frame = (timestamp: number) => {
  if (disposed) return;
  const frameDelta =
    previousTimestamp === null ? 0 : Math.max(0, (timestamp - previousTimestamp) / 1000);
  previousTimestamp = timestamp;
  accumulator.advance(frameDelta, step);
  synchronizer.sync(state);
  arena.setGateOpen(state.encounter.gateOpen);
  playerTarget.set(state.player.position.x, 0, state.player.position.y);
  cameraController.update(playerTarget, frameDelta);
  updateHud();
  arena.render(camera);
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

window.__ashfallDiagnostics = {
  snapshot() {
    const cameraDiagnostics = cameraController.getDiagnostics();
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
      tick: state.tick,
      droppedSeconds: accumulator.getDiagnostics().droppedSeconds,
      paused: state.paused,
      localLights: arena.getDiagnostics().localLights,
    };
  },
};

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
  delete (window as Partial<Window>).__ashfallDiagnostics;
  document.documentElement.dataset.runtimeDisposed = "true";
};
window.addEventListener("pagehide", dispose, { once: true });
