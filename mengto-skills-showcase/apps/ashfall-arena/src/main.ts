import {
  createProceduralMonster,
  createVesperKnight,
} from "@showcase/game-assets";
import {
  createProductGuide,
  type ProductGuideController,
} from "@showcase/showcase-guide";
import { PerspectiveCamera, Vector3 } from "three";
import { arenaContent } from "./content/arena-content";
import { createAudioFeedback } from "./feedback/create-audio";
import { createVfx } from "./feedback/create-vfx";
import { createInputAdapter } from "./input/create-input-adapter";
import { FixedStepAccumulator } from "./main-loop";
import {
  createQualityController,
  type QualityDiagnostics,
  type QualityMode,
  type QualityTier,
} from "./performance/create-quality-controller";
import {
  clearSave,
  createStateFromSave,
  getSafeStorage,
  readSave,
  writeSave,
} from "./persistence/save-game";
import { installReviewApi } from "./review/create-review-api";
import {
  createPerformanceSampler,
  type FramePerformanceSnapshot,
} from "./review/create-performance-sampler";
import { createArenaScene } from "./scene/create-arena-scene";
import { createGameCamera } from "./scene/create-game-camera";
import { resolveCameraOcclusion } from "./scene/resolve-camera-occlusion";
import { createEntitySynchronizer } from "./scene/sync-entities";
import {
  createEncounterFixture,
  type EncounterFixture,
} from "./simulation/encounters";
import { requestEnemyMove } from "./simulation/enemy-ai";
import { applyUpgrade, type UpgradeId } from "./simulation/inventory";
import {
  settleAuthoritativeResult,
  stepGame,
} from "./simulation/step-game";
import type {
  EnemyMoveId,
  GameEvent,
  GameIntent,
  GameState,
  StepGameResult,
} from "./simulation/types";
import {
  createHudController,
  type HudController,
} from "./ui/render-hud";
import { ASHFALL_GUIDE } from "./showcase/guide-content";
import { resolveAshfallHubHref } from "./showcase/resolve-hub-href";
import "@showcase/showcase-guide/styles.css";
import "./styles.css";

interface AshfallSnapshot {
  runtimeMode: "live" | "information-fallback";
  status: GameState["status"];
  encounterPhase: GameState["encounter"]["phase"];
  gateOpen: boolean;
  playerHealth: number;
  player: { x: number; z: number };
  cameraTarget: { x: number; z: number };
  canvasCount: number;
  playerRootCount: number;
  frameCount: number;
  tick: number;
  droppedSeconds: number;
  manualReviewClock: boolean;
  guideGateOpen: boolean;
  guideOpen: boolean;
  inputSampleCount: number;
  presentationSeconds: {
    entitySync: number;
    vfx: number;
    hud: number;
    camera: number;
  };
  audio: {
    paused: boolean;
    contextState: AudioContextState | "not-created" | "unavailable";
    contextCreateCount: number;
    playedCueCount: number;
  };
  paused: boolean;
  preserveDrawingBuffer: boolean;
  input: GameIntent;
  lockTargetId: string | null;
  weaponId: GameState["player"]["weaponId"];
  action: GameState["player"]["action"];
  activeAttackId: string | null;
  projectileCount: number;
  enemyModelRootCount: number;
  enemyFallbackRootCount: number;
  enemies: Array<{
    id: string;
    kind: GameState["enemies"][string]["kind"];
    health: number;
    action: GameState["enemies"][string]["action"];
    intent: GameState["enemies"][string]["intent"];
    currentMoveId: EnemyMoveId | null;
    movePhase: GameState["enemies"][string]["movePhase"];
    moveElapsedTicks: number;
    cooldownTicks: number;
  }>;
  recentEvents: Array<{ tick: number; event: GameEvent }>;
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
  performance: AshfallPerformanceSnapshot;
}

interface AshfallPerformanceSnapshot {
  performanceControl: "live" | "empty" | "information-fallback";
  qualityMode: QualityMode;
  qualityTier: QualityTier;
  quality: QualityDiagnostics;
  frame: FramePerformanceSnapshot;
  work: FramePerformanceSnapshot;
  renderer: {
    submittedFrames: number;
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
    pixelRatio: number;
    drawingBufferWidth: number;
    drawingBufferHeight: number;
    shadowMapEnabled: boolean;
    activeLocalLights: number;
  };
  heap:
    | {
        supported: true;
        usedBytes: number;
        totalBytes: number;
        limitBytes: number;
      }
    | { supported: false };
  lifecycle: {
    disposed: boolean;
    sceneChildren: number;
    entityRoots: number;
    listenerRegistrations: number;
    pooledObjects: number;
    activePooledObjects: number;
  };
}

interface AshfallReviewApi {
  snapshot(): AshfallSnapshot;
  resetPerformanceSamples(): void;
  setManualReviewClock(enabled: boolean): void;
  advanceInput(intent: Partial<GameIntent>, ticks?: number): void;
  triggerCameraShake(): void;
  getSerializableState(): GameState;
  queueEnemyMove(enemyId: string, moveId: EnemyMoveId): string;
  drivePlayerDodge(enemyId: string, moveId: EnemyMoveId): string;
  drivePlayerStrike(enemyId: string): void;
  drivePlayerDefeat(enemyId: string): void;
  retryLatestCheckpoint(): boolean;
}

declare global {
  interface Window {
    __ashfallDiagnostics?: AshfallReviewApi;
    __ashfallReleaseDisposalSnapshot?: AshfallPerformanceSnapshot;
  }
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Ashfall Arena requires #app");

const query = new URLSearchParams(window.location.search);
const fixtureParameter = query.get("fixture");
const requestedFixture = fixtureParameter ?? "fresh";
const allowedFixtures = new Set<EncounterFixture>([
  "fresh",
  "wave-one",
  "elite",
  "boss",
  "complete",
]);
if (!allowedFixtures.has(requestedFixture as EncounterFixture)) {
  throw new Error(`Unknown encounter fixture: ${requestedFixture}`);
}
const fixture = requestedFixture as EncounterFixture;
const reviewControls = query.get("reviewControls") === "1";
const safeTraining = query.get("safeTraining") === "1";
const manualEnemyAi = query.get("manualEnemyAi") === "1";
const captureMode = query.get("capture") === "1";
const performanceControl =
  reviewControls && query.get("reviewPerformance") === "empty"
    ? "empty"
    : "live";
const forcedMonsterFailure = query.get("forceEnemyModelFailure");
const qualityParameter = query.get("quality");
const qualityMode: QualityMode =
  qualityParameter === "low" ||
  qualityParameter === "medium" ||
  qualityParameter === "high"
    ? qualityParameter
    : "auto";
const qualityController = createQualityController(qualityMode);
let qualityTier = qualityController.getDiagnostics().tier;
const acceleratedReviewFixture =
  reviewControls && fixtureParameter !== null;
const reviewEnemyHealthCap = fixture === "fresh" ? 1 : 18;
document.documentElement.dataset.reviewControls = reviewControls ? "on" : "off";
const saveStorage = getSafeStorage(() => window.localStorage);

let saveNoticeMessage = "";
const applyReviewEnemyHealthCap = (candidate: GameState): GameState => {
  if (!acceleratedReviewFixture) return candidate;
  let changed = false;
  const enemies = Object.fromEntries(
    Object.entries(candidate.enemies).map(([id, enemy]) => {
      const health = Math.min(enemy.health, reviewEnemyHealthCap);
      if (health !== enemy.health) changed = true;
      return [id, health === enemy.health ? enemy : { ...enemy, health }];
    }),
  );
  return changed ? { ...candidate, enemies } : candidate;
};
const createFixtureState = () =>
  applyReviewEnemyHealthCap(createEncounterFixture(
    7481,
    fixture,
    {
      accelerated: acceleratedReviewFixture,
      trainingAiEnabled: !safeTraining,
      ...(manualEnemyAi ? { enemyAiEnabled: false } : {}),
    },
  ));
const savedContinuation =
  fixtureParameter === null ? readSave(saveStorage) : null;
let state: GameState =
  savedContinuation?.ok
    ? createStateFromSave(savedContinuation.save, "continue")
    : createFixtureState();
if (savedContinuation && !savedContinuation.ok) {
  if (
    savedContinuation.reason === "malformed-json" ||
    savedContinuation.reason === "unsupported-version" ||
    savedContinuation.reason === "invalid-schema"
  ) {
    saveNoticeMessage = "存档损坏，已安全回到全新开局。";
  } else if (savedContinuation.reason === "storage-unavailable") {
    saveNoticeMessage = "本次会话无法保存，但游戏仍可继续。";
  }
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
      <canvas data-game-canvas aria-label="灰烬竞技场实时三维画面" tabindex="0"></canvas>
      <aside class="hud" aria-label="玩家状态">
        <div class="hud__vitals">
          <span class="hud__label">生命</span>
          <strong data-health>105 / 105</strong>
          <span class="hud__meter" role="progressbar" aria-label="生命值" aria-valuemin="0" aria-valuemax="105" aria-valuenow="105"><i data-health-meter></i></span>
        </div>
        <div class="hud__vitals">
          <span class="hud__label">精力</span>
          <strong data-stamina>100 / 100</strong>
          <span class="hud__meter hud__meter--stamina" role="progressbar" aria-label="精力值" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><i data-stamina-meter></i></span>
        </div>
        <div class="hud__loadout">
          <span data-weapon>誓约刃</span>
          <span data-action>待机</span>
          <span data-healing>治疗瓶 × 3</span>
        </div>
        <div class="hud__progression">
          <span data-souls>灵魂 0</span>
          <span data-upgrade>升级：未选择</span>
        </div>
      </aside>
      <aside class="target-panel" data-target-panel aria-label="锁定目标" hidden>
        <span data-target-name>目标</span>
        <strong data-target-health>0 / 0</strong>
        <span class="target-panel__meter" role="progressbar" aria-label="目标生命值" aria-valuemin="0" aria-valuenow="0"><i data-target-meter></i></span>
      </aside>
      <div class="enemy-telegraph-banner" data-enemy-telegraph hidden>
        敌人正在蓄力——准备格挡或闪避
      </div>
      <p class="device-prompt" data-device-prompt>键鼠：WASD 移动，鼠标攻击/格挡</p>
      <p class="feedback-caption" data-feedback-caption role="status" aria-live="polite" aria-atomic="true" hidden></p>
      <div class="damage-flash" data-damage-flash aria-hidden="true" hidden></div>
      <section class="objective-card" data-objective aria-live="polite">
        <p class="objective-card__kicker">当前目标</p>
        <h2>进入第一个琥珀训练环</h2>
        <p>使用 WASD 或左侧摇杆移动。攻击、格挡与闪避将在训练环内依次解锁。</p>
      </section>
      <div class="arena-status" role="status" aria-live="polite">训练阶段 · 闸门关闭</div>
      <p class="save-notice" data-save-notice role="status" aria-live="polite" hidden></p>
      <fieldset class="audio-settings" aria-label="声音设置">
        <legend>声音</legend>
        <label><input type="checkbox" data-audio-mute aria-label="静音所有声音"> 静音</label>
        <label>总音量 <input type="range" min="0" max="1" step="0.05" data-audio-master aria-label="总音量"></label>
        <label>效果音 <input type="range" min="0" max="1" step="0.05" data-audio-effects aria-label="效果音音量"></label>
        <label>环境音 <input type="range" min="0" max="1" step="0.05" data-audio-ambience aria-label="环境音音量"></label>
      </fieldset>
      <button class="new-run-button" type="button" data-new-run>新开一局</button>
      <dialog class="progression-dialog" data-upgrade-modal aria-label="选择一次升级" tabindex="-1">
        <p class="progression-dialog__kicker">第一波奖励</p>
        <h2>选择一次升级</h2>
        <p>本局只能选择一项，确认后进入精英战。</p>
        <div class="progression-dialog__actions">
          <button type="button" data-upgrade-id="vitality">活力：生命上限提升至 125，并恢复 20</button>
          <button type="button" data-upgrade-id="power">力量：武器伤害提升 20%</button>
        </div>
      </dialog>
      <dialog class="progression-dialog" data-pause-modal aria-label="游戏已暂停" tabindex="-1">
        <p class="progression-dialog__kicker">模拟与反馈时钟已暂停</p>
        <h2>游戏已暂停</h2>
        <p>继续后从同一权威状态恢复，不会补算后台时间。</p>
        <div class="progression-dialog__actions">
          <button type="button" data-resume>继续战斗</button>
          <button type="button" data-new-run>新开一局</button>
        </div>
      </dialog>
      <dialog class="progression-dialog" data-defeat-modal aria-label="本轮挑战失败" tabindex="-1">
        <p class="progression-dialog__kicker">检查点仍然安全</p>
        <h2>本轮挑战失败</h2>
        <p>重试会恢复最近阶段、完整生命与精力，并保留升级和已保存奖励。</p>
        <div class="progression-dialog__actions">
          <button type="button" data-retry>从检查点重试</button>
          <button type="button" data-new-run>新开一局</button>
        </div>
      </dialog>
      <dialog class="progression-dialog" data-complete-modal aria-label="挑战完成记录" tabindex="-1">
        <p class="progression-dialog__kicker">本地完成记录</p>
        <h2>挑战完成记录</h2>
        <p>钟鸣君主已被击败；重新载入仍会保留这份完成记录。</p>
        <div class="progression-dialog__actions">
          <button type="button" data-new-run>新开一局</button>
        </div>
      </dialog>
    </section>
  </main>`;

const canvas = app.querySelector<HTMLCanvasElement>("[data-game-canvas]")!;
const stage = app.querySelector<HTMLElement>(".game-stage")!;
let hud: HudController | null = null;

const showArenaFallback = (error: unknown) => {
  canvas.hidden = true;
  canvas.tabIndex = -1;
  canvas.setAttribute("aria-hidden", "true");
  document.documentElement.dataset.renderMode = "information-fallback";
  const phaseLabel = ({
    training: "训练阶段",
    "wave-one": "第一波",
    elite: "精英战",
    boss: "首领战",
    complete: "挑战完成",
  } as const)[state.encounter.phase] ?? "未知阶段";
  const fallback = document.createElement("section");
  fallback.className = "runtime-fallback";
  fallback.dataset.runtimeFallback = "";
  fallback.setAttribute("role", "status");
  fallback.setAttribute("aria-live", "polite");
  const heading = document.createElement("h2");
  heading.textContent = "3D 画面不可用";
  const message = document.createElement("p");
  message.textContent =
    "当前浏览器未能创建 WebGL 渲染器，实时战斗画面没有启动。你仍可阅读本次开局的目标与核心状态。";
  const summary = document.createElement("dl");
  const summaryEntries: Array<readonly [string, string]> = [
    ["阶段", phaseLabel],
    ["生命", `${state.player.health} / ${state.player.maxHealth}`],
    ["武器", state.player.weaponId === "oathblade" ? "誓约刃" : "余烬弓"],
  ];
  for (const [label, value] of summaryEntries) {
    const term = document.createElement("dt");
    term.textContent = label;
    const detail = document.createElement("dd");
    detail.textContent = value;
    summary.append(term, detail);
  }
  const technical = document.createElement("details");
  const technicalLabel = document.createElement("summary");
  technicalLabel.textContent = "技术原因";
  const technicalDetail = document.createElement("p");
  technicalDetail.textContent =
    error instanceof Error ? error.message : String(error);
  technical.append(technicalLabel, technicalDetail);
  fallback.append(heading, message, summary, technical);
  canvas.after(fallback);

  const setStaticText = (selector: string, value: string) => {
    const element = app.querySelector<HTMLElement>(selector);
    if (element) element.textContent = value;
  };
  setStaticText(
    "[data-health]",
    `${state.player.health} / ${state.player.maxHealth}`,
  );
  setStaticText(
    "[data-stamina]",
    `${Math.round(state.player.stamina)} / ${state.player.maxStamina}`,
  );
  setStaticText(
    "[data-weapon]",
    state.player.weaponId === "oathblade" ? "誓约刃" : "余烬弓",
  );
  setStaticText("[data-action]", "静态信息");
  setStaticText("[data-healing]", `治疗瓶 × ${state.player.healingCharges}`);
  setStaticText("[data-souls]", `灵魂 ${state.player.souls}`);
  setStaticText(
    "[data-upgrade]",
    state.player.upgradeId === null
      ? "升级：未选择"
      : state.player.upgradeId === "vitality"
        ? "升级：活力"
        : "升级：力量",
  );
  setStaticText(
    ".objective-card h2",
    ({
      training: state.encounter.trainingSpawned
        ? "完成攻击与格挡训练"
        : "进入第一个琥珀训练环",
      "wave-one": "击败第一波敌人",
      elite: "击败钟甲精英并开启王庭闸门",
      boss: "击败钟鸣君主",
      complete: "竞技场挑战完成",
    } as const)[state.encounter.phase],
  );
  setStaticText(
    ".objective-card p:last-child",
    "静态信息模式不会接收游戏输入、播放音频或推进战斗状态。",
  );
  setStaticText(
    ".arena-status",
    `${phaseLabel} · 静态信息模式`,
  );
  setStaticText(
    "[data-device-prompt]",
    "3D 不可用：游戏输入与音频均未启动",
  );
  const audioSettings =
    app.querySelector<HTMLFieldSetElement>(".audio-settings");
  if (audioSettings) audioSettings.disabled = true;
  for (const control of app.querySelectorAll<
    HTMLButtonElement | HTMLInputElement
  >("button, input")) {
    control.disabled = true;
  }
};

const arena = createArenaScene(canvas, {
  preserveDrawingBuffer: captureMode,
  quality: qualityTier,
  onUnavailable: showArenaFallback,
});

if (arena.renderer === null) {
  const neutralInput: GameIntent = {
    moveX: 0,
    moveY: 0,
    attackPressed: false,
    guardHeld: false,
    dodgePressed: false,
    lockPressed: false,
    healPressed: false,
    switchWeaponPressed: false,
    pausePressed: false,
  };
  const emptyFrameSnapshot = (): FramePerformanceSnapshot => ({
    sampleCount: 0,
    averageMs: 0,
    medianMs: 0,
    p95Ms: 0,
    maxMs: 0,
  });
  const informationPerformanceSnapshot = (
    runtimeDisposed = false,
  ): AshfallPerformanceSnapshot => ({
    performanceControl: "information-fallback",
    qualityMode,
    qualityTier,
    quality: qualityController.getDiagnostics(),
    frame: emptyFrameSnapshot(),
    work: emptyFrameSnapshot(),
    renderer: {
      submittedFrames: 0,
      calls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      pixelRatio: 0,
      drawingBufferWidth: 0,
      drawingBufferHeight: 0,
      shadowMapEnabled: false,
      activeLocalLights: 0,
    },
    heap: { supported: false },
    lifecycle: {
      disposed: runtimeDisposed,
      sceneChildren: runtimeDisposed ? 0 : arena.scene.children.length,
      entityRoots: 0,
      listenerRegistrations: runtimeDisposed ? 0 : 1,
      pooledObjects: 0,
      activePooledObjects: 0,
    },
  });
  const informationSnapshot = (): AshfallSnapshot => ({
    runtimeMode: "information-fallback",
    status: state.status,
    encounterPhase: state.encounter.phase,
    gateOpen: state.encounter.gateOpen,
    playerHealth: state.player.health,
    player: {
      x: state.player.position.x,
      z: state.player.position.y,
    },
    cameraTarget: {
      x: state.player.position.x,
      z: state.player.position.y,
    },
    canvasCount: document.querySelectorAll("[data-game-canvas]").length,
    playerRootCount: 0,
    frameCount: 0,
    tick: state.tick,
    droppedSeconds: 0,
    manualReviewClock: false,
    guideGateOpen: false,
    guideOpen: false,
    inputSampleCount: 0,
    presentationSeconds: {
      entitySync: 0,
      vfx: 0,
      hud: 0,
      camera: 0,
    },
    audio: {
      paused: true,
      contextState: "unavailable",
      contextCreateCount: 0,
      playedCueCount: 0,
    },
    paused: state.paused,
    preserveDrawingBuffer: arena.getDiagnostics().preserveDrawingBuffer,
    input: { ...neutralInput },
    lockTargetId: state.player.lockTargetId,
    weaponId: state.player.weaponId,
    action: state.player.action,
    activeAttackId: state.combat.activeAttack?.id ?? null,
    projectileCount: state.combat.projectiles.length,
    enemyModelRootCount: 0,
    enemyFallbackRootCount: 0,
    enemies: Object.values(state.enemies)
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((enemy) => ({
        id: enemy.id,
        kind: enemy.kind,
        health: enemy.health,
        action: enemy.action,
        intent: enemy.intent,
        currentMoveId: enemy.currentMoveId,
        movePhase: enemy.movePhase,
        moveElapsedTicks: enemy.moveElapsedTicks,
        cooldownTicks: enemy.cooldownTicks,
      })),
    recentEvents: [],
    camera: {
      target: {
        x: state.player.position.x,
        y: 0,
        z: state.player.position.y,
      },
      desiredDistance: 0,
      resolvedDistance: 0,
      occlusionLimited: false,
      occluderId: null,
      lockFraming: false,
      reducedMotion: window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches,
      shakeAmplitude: 0,
    },
    localLights: [],
    performance: informationPerformanceSnapshot(),
  });
  const rejectInformationInput = (): never => {
    throw new Error("3D 不可用：静态信息模式不接受游戏输入。");
  };
  if (reviewControls) {
    window.__ashfallDiagnostics = {
      snapshot: informationSnapshot,
      resetPerformanceSamples() {},
      setManualReviewClock: rejectInformationInput,
      advanceInput: rejectInformationInput,
      triggerCameraShake: rejectInformationInput,
      getSerializableState: () =>
        JSON.parse(JSON.stringify(state)) as GameState,
      queueEnemyMove: rejectInformationInput,
      drivePlayerDodge: rejectInformationInput,
      drivePlayerStrike: rejectInformationInput,
      drivePlayerDefeat: rejectInformationInput,
      retryLatestCheckpoint: rejectInformationInput,
    };
  }

  const fallbackResize = () => {
    const rect = stage.getBoundingClientRect();
    arena.resize(
      Math.max(1, Math.round(rect.width)),
      Math.max(1, Math.round(rect.height)),
    );
  };
  const fallbackResizeObserver = new ResizeObserver(fallbackResize);
  fallbackResizeObserver.observe(stage);
  fallbackResize();
  let fallbackDisposed = false;
  const disposeInformationFallback = () => {
    if (fallbackDisposed) return;
    fallbackDisposed = true;
    fallbackResizeObserver.disconnect();
    arena.dispose();
    if (reviewControls) {
      window.__ashfallReleaseDisposalSnapshot =
        informationPerformanceSnapshot(true);
    }
    delete window.__ashfallDiagnostics;
    document.documentElement.dataset.runtimeDisposed = "true";
  };
  window.addEventListener(
    "pagehide",
    disposeInformationFallback,
    { once: true },
  );
} else {
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const vfx = createVfx(arena.scene, {
  reducedMotion: reducedMotion.matches,
  quality: qualityTier,
});
const player = createVesperKnight();
arena.scene.add(player.root);
const synchronizer = createEntitySynchronizer(player, arena.scene, {
  createMonster(definition) {
    if (forcedMonsterFailure === definition.id) {
      throw new Error(
        `forced shared model failure for ${definition.id}`,
      );
    }
    return createProceduralMonster(definition);
  },
});
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
let guideGateOpen = false;
let inputSampleCount = 0;
let guide: ProductGuideController | null = null;
const presentationSeconds = {
  entitySync: 0,
  vfx: 0,
  hud: 0,
  camera: 0,
};
const guideEnabled =
  !reviewControls || query.get("guideReview") === "1";
const input = createInputAdapter(canvas, stage);
const audio = createAudioFeedback({
  storage: saveStorage,
  gestureTarget: window,
  visibilityDocument: document,
  canUnlock: () => !guideGateOpen,
});
const accumulator = new FixedStepAccumulator(1 / 60, 5, 0.25);
const performanceSampler = reviewControls
  ? createPerformanceSampler()
  : null;
const workSampler = reviewControls
  ? createPerformanceSampler()
  : null;
const playerTarget = new Vector3();
const trainingLockTarget = new Vector3(
  arenaContent.arena.trainingCenter.x,
  0.8,
  arenaContent.arena.trainingCenter.y,
);
cameraController.setReducedMotion(reducedMotion.matches);

type PresentationEvent = {
  type: "camera-shake";
  amplitude: number;
  duration: number;
};
const presentationEvents: PresentationEvent[] = [];
const recentEvents: Array<{ tick: number; event: GameEvent }> = [];
let previousTimestamp: number | null = null;
let frameRequest = 0;
let frameCount = 0;
let renderSubmissionCount = 0;
let disposed = false;
let manualReviewClock = false;
let focusGameOnNextFrame = false;
let menuAxisLatch = 0;

const setSaveNotice = (message: string) => {
  saveNoticeMessage = message;
  hud?.setSaveNotice(message);
};

const persistCheckpoint = (): boolean => {
  const result = writeSave(state, saveStorage);
  if (!result.ok) {
    setSaveNotice(
      saveStorage === null
        ? "本次会话无法保存，但游戏仍可继续。"
        : result.reason === "invalid-schema"
        ? "当前阶段无法安全保存，但本次游戏仍可继续。"
        : "无法写入存档，但本次游戏仍可继续。",
    );
    return false;
  }
  setSaveNotice("检查点已保存。");
  return true;
};

const replaceRunState = (next: GameState) => {
  state = applyReviewEnemyHealthCap(next);
  input.clear();
  accumulator.reset();
  previousTimestamp = null;
  presentationEvents.length = 0;
  recentEvents.length = 0;
  vfx.reset();
  audio.setPaused(false);
  focusGameOnNextFrame = true;
};

const retryLatestCheckpoint = (): boolean => {
  if (state.status !== "defeated") return false;
  const saved = readSave(saveStorage);
  if (saved.ok) {
    replaceRunState(createStateFromSave(saved.save, "retry"));
    setSaveNotice("已恢复最近检查点。");
  } else {
    replaceRunState(createEncounterFixture(state.seed, "fresh"));
    setSaveNotice(
      saved.reason === "missing-save"
        ? "没有可用检查点，已回到全新开局。"
        : "存档不可用，已安全回到全新开局。",
    );
  }
  return true;
};

const onUpgrade = (upgradeId: UpgradeId) => {
  if (
    state.status !== "upgrade" ||
    state.player.upgradeId !== null
  ) {
    return;
  }
  state = applyReviewEnemyHealthCap(applyUpgrade(state, upgradeId));
  persistCheckpoint();
};

const onRetry = () => {
  retryLatestCheckpoint();
};

const onNewRun = () => {
  if (!window.confirm("确认清除灰烬竞技场存档并新开一局？")) return;
  const cleared = clearSave(saveStorage);
  replaceRunState(createEncounterFixture(7481, "fresh"));
  setSaveNotice(
    cleared.ok
      ? "已清除本产品存档，开始全新一局。"
      : "无法清除浏览器存档；当前画面已开始全新一局。",
  );
};

const PAUSE_INTENT: GameIntent = {
  moveX: 0,
  moveY: 0,
  attackPressed: false,
  guardHeld: false,
  dodgePressed: false,
  lockPressed: false,
  healPressed: false,
  switchWeaponPressed: false,
  pausePressed: true,
};

const onResume = () => {
  if (!state.paused || state.status !== "playing") return;
  state = stepGame(state, PAUSE_INTENT, 1 / 60, arenaContent).state;
  focusGameOnNextFrame = true;
};

hud = createHudController(app, {
  onUpgrade,
  onRetry,
  onNewRun,
  onResume,
  onAudioSettings(settings) {
    audio.setSettings(settings);
  },
}, audio.getSettings());
hud.setSaveNotice(saveNoticeMessage);

if (guideEnabled) {
  guide = createProductGuide(app, {
    ...ASHFALL_GUIDE,
    hubHref: resolveAshfallHubHref(import.meta.env, window.location.href),
    canOpen: () =>
      state.status === "playing" &&
      !state.paused &&
      !hud?.hasOpenDialog(),
    onOpen() {
      guideGateOpen = true;
      input.clear();
      accumulator.reset();
      previousTimestamp = null;
      audio.setPaused(true);
    },
    onClose() {
      guideGateOpen = false;
      input.clear();
      accumulator.reset();
      previousTimestamp = null;
      audio.setPaused(state.paused || state.status === "upgrade");
    },
  });
}

const dispatchPresentationEvent = (event: PresentationEvent) => {
  presentationEvents.push(event);
};

const routeGameplayEvents = (events: readonly GameEvent[]) => {
  if (events.length === 0) return;
  for (const event of events) {
    recentEvents.push({ tick: state.tick, event });
  }
  if (recentEvents.length > 256) {
    recentEvents.splice(0, recentEvents.length - 256);
  }
  if (
    events.some(
      (event) => event.type === "damage" && event.targetId === state.player.id,
    )
  ) {
    dispatchPresentationEvent({
      type: "camera-shake",
      amplitude: 0.16,
      duration: 0.5,
    });
  }
  vfx.consume(events, state);
  audio.consume(events, state);
  hud?.consume(events, state);
};

const persistFromEvents = (events: readonly GameEvent[]) => {
  if (
    events.some(
      (event) =>
        event.type === "encounter-complete" ||
        event.type === "upgrade-offered" ||
        (event.type === "encounter-phase" &&
          (event.phase === "wave-one" || event.phase === "boss")),
    )
  ) {
    persistCheckpoint();
  }
};

const commitAuthoritativeResult = (result: StepGameResult) => {
  const settled = settleAuthoritativeResult(result);
  state = applyReviewEnemyHealthCap(settled.state);
  routeGameplayEvents(settled.events);
  persistFromEvents(settled.events);
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

const routeDialogInput = (intent: GameIntent): boolean => {
  const axis =
    Math.abs(intent.moveY) >= Math.abs(intent.moveX)
      ? intent.moveY
      : intent.moveX;
  const nextLatch = axis > 0.55 ? -1 : axis < -0.55 ? 1 : 0;
  if (nextLatch !== 0 && menuAxisLatch === 0) {
    hud?.moveDialogFocus(nextLatch);
  }
  menuAxisLatch = nextLatch;
  if (intent.attackPressed) {
    hud?.activateFocusedAction();
    input.clear();
    return false;
  }
  return state.paused && intent.pausePressed;
};

const step = (fixedDelta: number) => {
  if (guideGateOpen) return;
  inputSampleCount += 1;
  const intent = input.sample();
  if (hud?.hasOpenDialog()) {
    if (!routeDialogInput(intent)) return;
  } else {
    menuAxisLatch = 0;
  }
  const result = stepGame(state, intent, fixedDelta, arenaContent);
  state = applyReviewEnemyHealthCap(result.state);
  routeGameplayEvents(result.events);
  persistFromEvents(result.events);
  audio.setPaused(state.paused || state.status === "upgrade");
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
  guide?.retryAutoOpen();
  if (guideGateOpen) {
    previousTimestamp = null;
    arena.render(camera);
    renderSubmissionCount += 1;
    frameCount += 1;
    frameRequest = requestAnimationFrame(frame);
    return;
  }
  const frameDelta =
    previousTimestamp === null
      ? 0
      : Math.max(0, (timestamp - previousTimestamp) / 1000);
  previousTimestamp = timestamp;
  const frameMs = frameDelta * 1_000;
  performanceSampler?.recordFrame(frameMs);
  if (qualityController.recordFrame(frameMs)) {
    qualityTier = qualityController.getDiagnostics().tier;
    arena.setQuality(qualityTier);
    vfx.setQuality(qualityTier);
    performanceSampler?.reset();
    workSampler?.reset();
  }
  const workStartedAt = performance.now();
  if (performanceControl === "live") {
    if (!manualReviewClock) {
      accumulator.advance(frameDelta, step);
    }
    synchronizer.sync(state, frameDelta);
    presentationSeconds.entitySync += frameDelta;
    vfx.sync(state);
    const presentationPaused =
      state.paused || state.status === "upgrade";
    vfx.update(frameDelta, presentationPaused);
    presentationSeconds.vfx += frameDelta;
    hud?.updatePresentation(frameDelta, presentationPaused);
    presentationSeconds.hud += frameDelta;
    arena.setGateOpen(state.encounter.gateOpen);
    playerTarget.set(state.player.position.x, 0, state.player.position.y);
    cameraController.setLockTarget(currentLockTarget());
    consumePresentationEvents();
    cameraController.update(playerTarget, frameDelta);
    presentationSeconds.camera += frameDelta;
    const entityDiagnostics = synchronizer.getDiagnostics();
    hud?.render(state, {
      deviceMode: input.getDeviceMode(),
      telegraphs: entityDiagnostics.telegraphs,
      damageFlashActive: vfx.getDiagnostics().damageFlashActive,
    });
    const cameraDiagnostics = cameraController.getDiagnostics();
    document.documentElement.dataset.cameraShake =
      cameraDiagnostics.reducedMotion ? "off" : "on";
    if (
      state.status === "playing" &&
      !state.paused &&
      (focusGameOnNextFrame || hud?.consumeFocusGameRequest())
    ) {
      canvas.focus();
      focusGameOnNextFrame = false;
    }
    arena.render(camera);
    renderSubmissionCount += 1;
  }
  workSampler?.recordFrame(
    Math.max(Number.EPSILON, performance.now() - workStartedAt),
  );
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
  vfx.setReducedMotion(event.matches);
};
document.addEventListener("visibilitychange", onVisibility);
reducedMotion.addEventListener("change", onReducedMotion);

const getPerformanceSnapshot = (
  runtimeDisposed = false,
): AshfallPerformanceSnapshot => {
  const rendererInfo = arena.renderer?.info;
  const arenaDiagnostics = arena.getDiagnostics();
  const effects = vfx.getDiagnostics();
  const entityDiagnostics = synchronizer.getDiagnostics();
  const poolDiagnostics = Object.values(effects.pools);
  const memory = (
    performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }
  ).memory;
  const heap =
    memory &&
      Number.isFinite(memory.usedJSHeapSize) &&
      Number.isFinite(memory.totalJSHeapSize) &&
      Number.isFinite(memory.jsHeapSizeLimit)
      ? {
          supported: true as const,
          usedBytes: memory.usedJSHeapSize,
          totalBytes: memory.totalJSHeapSize,
          limitBytes: memory.jsHeapSizeLimit,
        }
      : { supported: false as const };
  const playerRoots = arena.scene.children.filter(
    ({ name }) => name === "vesper-knight",
  ).length;
  const controllerListeners =
    input.getLifecycleDiagnostics().listenerRegistrations +
    (hud?.getLifecycleDiagnostics().listenerRegistrations ?? 0) +
    audio.getDiagnostics().listenerRegistrations;

  return {
    performanceControl,
    qualityMode,
    qualityTier,
    quality: qualityController.getDiagnostics(),
    frame: performanceSampler?.getFrameSnapshot() ?? {
      sampleCount: 0,
      averageMs: 0,
      medianMs: 0,
      p95Ms: 0,
      maxMs: 0,
    },
    work: workSampler?.getFrameSnapshot() ?? {
      sampleCount: 0,
      averageMs: 0,
      medianMs: 0,
      p95Ms: 0,
      maxMs: 0,
    },
    renderer: runtimeDisposed
      ? {
          submittedFrames: 0,
          calls: 0,
          triangles: 0,
          geometries: 0,
          textures: 0,
          pixelRatio: 0,
          drawingBufferWidth: 0,
          drawingBufferHeight: 0,
          shadowMapEnabled: false,
          activeLocalLights: 0,
        }
      : {
          submittedFrames: renderSubmissionCount,
          calls: rendererInfo?.render.calls ?? 0,
          triangles: rendererInfo?.render.triangles ?? 0,
          geometries: rendererInfo?.memory.geometries ?? 0,
          textures: rendererInfo?.memory.textures ?? 0,
          pixelRatio: arenaDiagnostics.pixelRatio,
          drawingBufferWidth: arenaDiagnostics.drawingBufferWidth,
          drawingBufferHeight: arenaDiagnostics.drawingBufferHeight,
          shadowMapEnabled: arenaDiagnostics.shadowMapEnabled,
          activeLocalLights: arenaDiagnostics.activeLocalLights,
        },
    heap,
    lifecycle: {
      disposed: runtimeDisposed,
      sceneChildren: arena.scene.children.length,
      entityRoots:
        playerRoots +
        entityDiagnostics.modelRootCount +
        entityDiagnostics.fallbackRootCount +
        entityDiagnostics.enemyProjectileTraceCount,
      listenerRegistrations:
        controllerListeners + (runtimeDisposed ? 0 : 4),
      pooledObjects: poolDiagnostics.reduce(
        (total, pool) => total + pool.capacity,
        0,
      ),
      activePooledObjects: poolDiagnostics.reduce(
        (total, pool) => total + pool.active,
        0,
      ),
    },
  };
};

const reviewApi = installReviewApi(reviewControls, {
  readState: () => state,
  commit: commitAuthoritativeResult,
  readDiagnostics() {
    const cameraDiagnostics = cameraController.getDiagnostics();
    return {
      effects: vfx.getDiagnostics(),
      audio: audio.getDiagnostics(),
      camera: {
        reducedMotion: cameraDiagnostics.reducedMotion,
        shakeAmplitude: cameraDiagnostics.shakeAmplitude,
      },
      input: input.getDiagnostics(),
      recentEvents: recentEvents.map(({ tick, event }) => ({
        tick,
        event: { ...event },
      })),
      frameCount,
      canvasCount: document.querySelectorAll("[data-game-canvas]").length,
    };
  },
});

if (reviewControls) {
  window.__ashfallDiagnostics = {
    resetPerformanceSamples() {
      performanceSampler?.reset();
      workSampler?.reset();
      renderSubmissionCount = 0;
    },
    setManualReviewClock(enabled) {
      manualReviewClock = enabled;
      accumulator.reset();
      previousTimestamp = null;
      input.clear();
    },
    advanceInput(intent, ticks = 1) {
      if (guideGateOpen) {
        throw new Error("guide gate is open");
      }
      if (!manualReviewClock) {
        throw new Error(
          "review input requires the manual review clock",
        );
      }
      if (!Number.isInteger(ticks) || ticks < 1 || ticks > 600) {
        throw new RangeError("review input ticks must be between 1 and 600");
      }
      const base: GameIntent = {
        moveX: 0,
        moveY: 0,
        attackPressed: false,
        guardHeld: false,
        dodgePressed: false,
        lockPressed: false,
        healPressed: false,
        switchWeaponPressed: false,
        pausePressed: false,
      };
      for (let index = 0; index < ticks; index += 1) {
        const edge = index === 0;
        const stepIntent: GameIntent = {
          ...base,
          ...intent,
          attackPressed: edge && Boolean(intent.attackPressed),
          dodgePressed: edge && Boolean(intent.dodgePressed),
          lockPressed: edge && Boolean(intent.lockPressed),
          healPressed: edge && Boolean(intent.healPressed),
          switchWeaponPressed:
            edge && Boolean(intent.switchWeaponPressed),
          pausePressed: edge && Boolean(intent.pausePressed),
        };
        const result = stepGame(
          state,
          stepIntent,
          1 / 60,
          arenaContent,
        );
        state = applyReviewEnemyHealthCap(result.state);
        routeGameplayEvents(result.events);
        persistFromEvents(result.events);
      }
      audio.setPaused(state.paused || state.status === "upgrade");
    },
    snapshot() {
      const cameraDiagnostics = cameraController.getDiagnostics();
      const arenaDiagnostics = arena.getDiagnostics();
      const entityDiagnostics = synchronizer.getDiagnostics();
      return {
        runtimeMode: "live",
        status: state.status,
        encounterPhase: state.encounter.phase,
        gateOpen: state.encounter.gateOpen,
        playerHealth: state.player.health,
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
        manualReviewClock,
        guideGateOpen,
        guideOpen: guide?.isOpen() ?? false,
        inputSampleCount,
        presentationSeconds: { ...presentationSeconds },
        audio: {
          paused: audio.getDiagnostics().paused,
          contextState: audio.getDiagnostics().contextState,
          contextCreateCount: audio.getDiagnostics().contextCreateCount,
          playedCueCount: audio.getDiagnostics().playedCueCount,
        },
        paused: state.paused,
        preserveDrawingBuffer: arenaDiagnostics.preserveDrawingBuffer,
        input: input.getDiagnostics(),
        lockTargetId: state.player.lockTargetId,
        weaponId: state.player.weaponId,
        action: state.player.action,
        activeAttackId: state.combat.activeAttack?.id ?? null,
        projectileCount: state.combat.projectiles.length,
        enemyModelRootCount: entityDiagnostics.modelRootCount,
        enemyFallbackRootCount: entityDiagnostics.fallbackRootCount,
        enemies: Object.values(state.enemies)
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((enemy) => ({
            id: enemy.id,
            kind: enemy.kind,
            health: enemy.health,
            action: enemy.action,
            intent: enemy.intent,
            currentMoveId: enemy.currentMoveId,
            movePhase: enemy.movePhase,
            moveElapsedTicks: enemy.moveElapsedTicks,
            cooldownTicks: enemy.cooldownTicks,
          })),
        recentEvents: recentEvents.map(({ tick, event }) => ({
          tick,
          event: { ...event },
        })),
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
        performance: getPerformanceSnapshot(),
      };
    },
    triggerCameraShake() {
      dispatchPresentationEvent({
        type: "camera-shake",
        amplitude: 0.2,
        duration: 0.45,
      });
    },
    getSerializableState() {
      return JSON.parse(JSON.stringify(state)) as GameState;
    },
    queueEnemyMove(enemyId, moveId) {
      const enemy = state.enemies[enemyId];
      if (!enemy) throw new Error(`Unknown enemy: ${enemyId}`);
      if (enemy.currentMoveId !== null || enemy.cooldownTicks !== 0) {
        throw new Error(`${enemyId} is not ready for a move`);
      }
      const contactDistance =
        moveId === "warden-bolt"
          ? 7.5
          : moveId === "sovereign-shockwave"
            ? 3.4
            : 1.25;
      const forward = {
        x: Math.sin(state.player.facingRadians),
        y: Math.cos(state.player.facingRadians),
      };
      const position = {
        x: state.player.position.x + forward.x * contactDistance,
        y: state.player.position.y + forward.y * contactDistance,
      };
      const facingRadians = Math.atan2(
        state.player.position.x - position.x,
        state.player.position.y - position.y,
      );
      const requested = requestEnemyMove(
        {
          ...enemy,
          position,
          facingRadians,
          lockedFacingRadians: facingRadians,
          aiEnabled: false,
          targetId: state.player.id,
          action: "idle",
          actionTime: 0,
        },
        moveId,
        state.tick,
      );
      state = {
        ...state,
        enemies: {
          ...state.enemies,
          [enemyId]: requested,
        },
      };
      return `${enemyId}:${moveId}:${requested.attackSequence}`;
    },
    drivePlayerDodge(enemyId, moveId) {
      const enemy = state.enemies[enemyId];
      if (!enemy) throw new Error(`Unknown enemy: ${enemyId}`);
      if (state.status !== "playing") {
        throw new Error("Player dodge requires a playing simulation");
      }
      const forward = {
        x: Math.sin(state.player.facingRadians),
        y: Math.cos(state.player.facingRadians),
      };
      const position = {
        x: state.player.position.x + forward.x * 1.25,
        y: state.player.position.y + forward.y * 1.25,
      };
      const facingRadians = Math.atan2(
        state.player.position.x - position.x,
        state.player.position.y - position.y,
      );
      const requested = requestEnemyMove(
        {
          ...enemy,
          position,
          facingRadians,
          lockedFacingRadians: facingRadians,
          aiEnabled: false,
          targetId: state.player.id,
          action: "idle",
          actionTime: 0,
          currentMoveId: null,
          movePhase: "none",
          moveElapsedTicks: 0,
          cooldownTicks: 0,
        },
        moveId,
        state.tick,
      );
      state = {
        ...state,
        player: {
          ...state.player,
          action: "idle",
          actionTime: 0,
          stamina: state.player.maxStamina,
        },
        enemies: {
          ...state.enemies,
          [enemyId]: requested,
        },
      };
      const attackId =
        `${enemyId}:${moveId}:${requested.attackSequence}`;
      const neutral: GameIntent = {
        moveX: 0,
        moveY: 0,
        attackPressed: false,
        guardHeld: false,
        dodgePressed: false,
        lockPressed: false,
        healPressed: false,
        switchWeaponPressed: false,
        pausePressed: false,
      };
      let dodgeIssued = false;
      for (let tick = 0; tick < 180; tick += 1) {
        const current = state.enemies[enemyId];
        const dodgePressed =
          !dodgeIssued &&
          current?.movePhase === "telegraph" &&
          current.moveElapsedTicks >= 14;
        if (dodgePressed) dodgeIssued = true;
        const result = stepGame(
          state,
          { ...neutral, dodgePressed },
          1 / 60,
          arenaContent,
        );
        state = result.state;
        routeGameplayEvents(result.events);
        persistFromEvents(result.events);
        if (dodgeIssued && state.enemies[enemyId]?.currentMoveId === null) {
          break;
        }
      }
      if (!dodgeIssued) {
        throw new Error(`${enemyId} never reached its dodge window`);
      }
      return attackId;
    },
    drivePlayerStrike(enemyId) {
      window.__review!.defeatEnemy(enemyId);
    },
    drivePlayerDefeat(enemyId) {
      const enemy = state.enemies[enemyId];
      if (!enemy) throw new Error(`Unknown enemy: ${enemyId}`);
      if (state.status !== "playing") {
        throw new Error("Player defeat requires a playing simulation");
      }
      const moveId: EnemyMoveId =
        enemy.kind === "ash-warden"
          ? "warden-bolt"
          : enemy.kind === "bell-elite"
            ? "elite-sweep"
            : enemy.kind === "bell-sovereign"
              ? "sovereign-sweep"
              : "crawler-lunge";
      const distance = moveId === "warden-bolt" ? 4.5 : 1.25;
      const forward = {
        x: Math.sin(state.player.facingRadians),
        y: Math.cos(state.player.facingRadians),
      };
      const position = {
        x: state.player.position.x + forward.x * distance,
        y: state.player.position.y + forward.y * distance,
      };
      const facingRadians = Math.atan2(
        state.player.position.x - position.x,
        state.player.position.y - position.y,
      );
      const requested = requestEnemyMove(
        {
          ...enemy,
          position,
          facingRadians,
          lockedFacingRadians: facingRadians,
          aiEnabled: false,
          targetId: state.player.id,
          action: "idle",
          actionTime: 0,
          currentMoveId: null,
          movePhase: "none",
          moveElapsedTicks: 0,
          cooldownTicks: 0,
          hitTargetIds: [],
        },
        moveId,
        state.tick,
      );
      state = {
        ...state,
        player: {
          ...state.player,
          health: 1,
          action: "idle",
          actionTime: 0,
        },
        enemies: {
          ...state.enemies,
          [enemyId]: requested,
        },
      };
      const neutral: GameIntent = {
        moveX: 0,
        moveY: 0,
        attackPressed: false,
        guardHeld: false,
        dodgePressed: false,
        lockPressed: false,
        healPressed: false,
        switchWeaponPressed: false,
        pausePressed: false,
      };
      for (let tick = 0; tick < 240; tick += 1) {
        const result = stepGame(
          state,
          neutral,
          1 / 60,
          arenaContent,
        );
        state = result.state;
        routeGameplayEvents(result.events);
        if (state.status === "defeated") return;
      }
      throw new Error(`${enemyId} did not defeat the player`);
    },
    retryLatestCheckpoint,
  };
}

const dispose = () => {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(frameRequest);
  resizeObserver.disconnect();
  document.removeEventListener("visibilitychange", onVisibility);
  reducedMotion.removeEventListener("change", onReducedMotion);
  reviewApi.dispose();
  guide?.destroy();
  guide = null;
  guideGateOpen = false;
  hud?.dispose();
  audio.dispose();
  vfx.dispose();
  input.dispose();
  synchronizer.dispose();
  cameraController.dispose();
  player.dispose();
  arena.dispose();
  if (reviewControls) {
    window.__ashfallReleaseDisposalSnapshot =
      getPerformanceSnapshot(true);
  }
  delete window.__ashfallDiagnostics;
  document.documentElement.dataset.runtimeDisposed = "true";
};
window.addEventListener("pagehide", dispose, { once: true });
}
