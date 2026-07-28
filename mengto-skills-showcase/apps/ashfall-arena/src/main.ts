import {
  createProceduralMonster,
  createVesperKnight,
} from "@showcase/game-assets";
import { PerspectiveCamera, Vector3 } from "three";
import { arenaContent } from "./content/arena-content";
import { createInputAdapter } from "./input/create-input-adapter";
import { FixedStepAccumulator } from "./main-loop";
import {
  clearSave,
  createStateFromSave,
  readSave,
  writeSave,
} from "./persistence/save-game";
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
import { stepGame } from "./simulation/step-game";
import type {
  EnemyMoveId,
  GameEvent,
  GameIntent,
  GameState,
} from "./simulation/types";
import "./styles.css";

interface AshfallSnapshot {
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
}

interface AshfallReviewApi {
  snapshot(): AshfallSnapshot;
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
const forcedMonsterFailure = query.get("forceEnemyModelFailure");
document.documentElement.dataset.reviewControls = reviewControls ? "on" : "off";

let saveNoticeMessage = "";
const createFixtureState = () =>
  createEncounterFixture(
    7481,
    fixture,
    {
      accelerated: reviewControls && fixture !== "fresh",
      trainingAiEnabled: !safeTraining,
      ...(manualEnemyAi ? { enemyAiEnabled: false } : {}),
    },
  );
const savedContinuation =
  fixtureParameter === null ? readSave(window.localStorage) : null;
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
    saveNoticeMessage = "当前浏览器无法读取存档，已继续本次游戏。";
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
          <span data-weapon>誓约刃</span>
          <span data-action>待机</span>
          <span data-healing>治疗瓶 × 3</span>
        </div>
      </aside>
      <div class="enemy-telegraph-banner" data-enemy-telegraph hidden>
        敌人正在蓄力——准备格挡或闪避
      </div>
      <section class="objective-card" data-objective aria-live="polite">
        <p class="objective-card__kicker">当前目标</p>
        <h2>进入第一个琥珀训练环</h2>
        <p>使用 WASD 或左侧摇杆移动。攻击、格挡与闪避将在训练环内依次解锁。</p>
      </section>
      <div class="arena-status" role="status" aria-live="polite">训练阶段 · 闸门关闭</div>
      <p class="save-notice" data-save-notice role="status" aria-live="polite" hidden></p>
      <button class="new-run-button" type="button" data-new-run>新开一局</button>
      <section class="progression-dialog" data-upgrade-modal role="dialog" aria-modal="true" aria-label="选择一次升级" tabindex="-1" hidden>
        <p class="progression-dialog__kicker">第一波奖励</p>
        <h2>选择一次升级</h2>
        <p>本局只能选择一项，确认后进入精英战。</p>
        <div class="progression-dialog__actions">
          <button type="button" data-upgrade-id="vitality">活力：生命上限提升至 125，并恢复 20</button>
          <button type="button" data-upgrade-id="power">力量：武器伤害提升 20%</button>
        </div>
      </section>
      <section class="progression-dialog" data-defeat-modal role="dialog" aria-modal="true" aria-label="本轮挑战失败" tabindex="-1" hidden>
        <p class="progression-dialog__kicker">检查点仍然安全</p>
        <h2>本轮挑战失败</h2>
        <p>重试会恢复最近阶段、完整生命与精力，并保留升级和已保存奖励。</p>
        <div class="progression-dialog__actions">
          <button type="button" data-retry>从检查点重试</button>
        </div>
      </section>
      <section class="progression-dialog" data-complete-modal role="dialog" aria-modal="true" aria-label="挑战完成记录" tabindex="-1" hidden>
        <p class="progression-dialog__kicker">本地完成记录</p>
        <h2>挑战完成记录</h2>
        <p>钟鸣君主已被击败；重新载入仍会保留这份完成记录。</p>
      </section>
    </section>
  </main>`;

const canvas = app.querySelector<HTMLCanvasElement>("[data-game-canvas]")!;
const stage = app.querySelector<HTMLElement>(".game-stage")!;
const health = app.querySelector<HTMLElement>("[data-health]")!;
const stamina = app.querySelector<HTMLElement>("[data-stamina]")!;
const healthMeter = app.querySelector<HTMLElement>("[data-health-meter]")!;
const staminaMeter = app.querySelector<HTMLElement>("[data-stamina-meter]")!;
const weapon = app.querySelector<HTMLElement>("[data-weapon]")!;
const action = app.querySelector<HTMLElement>("[data-action]")!;
const healing = app.querySelector<HTMLElement>("[data-healing]")!;
const objectiveTitle = app.querySelector<HTMLElement>(".objective-card h2")!;
const arenaStatus = app.querySelector<HTMLElement>(".arena-status")!;
const telegraphBanner = app.querySelector<HTMLElement>(
  "[data-enemy-telegraph]",
)!;
const saveNotice = app.querySelector<HTMLElement>("[data-save-notice]")!;
const upgradeModal = app.querySelector<HTMLElement>("[data-upgrade-modal]")!;
const defeatModal = app.querySelector<HTMLElement>("[data-defeat-modal]")!;
const completeModal = app.querySelector<HTMLElement>("[data-complete-modal]")!;
const upgradeButtons = [
  ...upgradeModal.querySelectorAll<HTMLButtonElement>("[data-upgrade-id]"),
];
const retryButton = app.querySelector<HTMLButtonElement>("[data-retry]")!;
const newRunButtons = [
  ...app.querySelectorAll<HTMLButtonElement>("[data-new-run]"),
];

const arena = createArenaScene(canvas, {
  preserveDrawingBuffer: reviewControls || captureMode,
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
const recentEvents: Array<{ tick: number; event: GameEvent }> = [];
let previousTimestamp: number | null = null;
let frameRequest = 0;
let frameCount = 0;
let disposed = false;
let focusedStatus: GameState["status"] | null = null;

const setSaveNotice = (message: string) => {
  saveNoticeMessage = message;
  saveNotice.textContent = message;
  saveNotice.hidden = message.length === 0;
};
setSaveNotice(saveNoticeMessage);

const persistCheckpoint = (): boolean => {
  const result = writeSave(state, window.localStorage);
  if (!result.ok) {
    setSaveNotice(
      result.reason === "invalid-schema"
        ? "当前阶段无法安全保存，但本次游戏仍可继续。"
        : "无法写入存档，但本次游戏仍可继续。",
    );
    return false;
  }
  setSaveNotice("检查点已保存。");
  return true;
};

const replaceRunState = (next: GameState) => {
  state = next;
  input.clear();
  accumulator.reset();
  previousTimestamp = null;
  presentationEvents.length = 0;
  recentEvents.length = 0;
  focusedStatus = null;
};

const retryLatestCheckpoint = (): boolean => {
  if (state.status !== "defeated") return false;
  const saved = readSave(window.localStorage);
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

const onUpgradeClick = (event: Event) => {
  if (
    state.status !== "upgrade" ||
    state.player.upgradeId !== null
  ) {
    return;
  }
  const button = event.currentTarget as HTMLButtonElement;
  const upgradeId = button.dataset.upgradeId as UpgradeId;
  state = applyUpgrade(state, upgradeId);
  focusedStatus = null;
  persistCheckpoint();
};
upgradeButtons.forEach((button) =>
  button.addEventListener("click", onUpgradeClick));

const onRetry = () => {
  retryLatestCheckpoint();
};
retryButton.addEventListener("click", onRetry);

const onNewRun = () => {
  if (!window.confirm("确认清除灰烬竞技场存档并新开一局？")) return;
  const cleared = clearSave(window.localStorage);
  replaceRunState(createEncounterFixture(7481, "fresh"));
  setSaveNotice(
    cleared.ok
      ? "已清除本产品存档，开始全新一局。"
      : "无法清除浏览器存档；当前画面已开始全新一局。",
  );
};
newRunButtons.forEach((button) =>
  button.addEventListener("click", onNewRun));

const dispatchPresentationEvent = (event: PresentationEvent) => {
  presentationEvents.push(event);
};

const routeGameplayEvents = (events: readonly GameEvent[]) => {
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
      duration: 0.22,
    });
  }
};

const persistFromEvents = (events: readonly GameEvent[]) => {
  if (
    events.some(
      (event) =>
        event.type === "encounter-complete" ||
        (event.type === "encounter-phase" &&
          (event.phase === "wave-one" || event.phase === "boss")),
    )
  ) {
    persistCheckpoint();
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
  persistFromEvents(result.events);
};

const updateHud = () => {
  const actionLabels: Record<GameState["player"]["action"], string> = {
    idle: "待机",
    move: "移动",
    attack: "攻击",
    guard: "格挡",
    dodge: "闪避",
    hit: "受击",
    dead: "倒下",
  };
  health.textContent = `${state.player.health} / ${state.player.maxHealth}`;
  stamina.textContent = `${Math.round(state.player.stamina)} / ${state.player.maxStamina}`;
  weapon.textContent =
    state.player.weaponId === "oathblade" ? "誓约刃" : "余烬弓";
  action.textContent = actionLabels[state.player.action];
  healing.textContent = `治疗瓶 × ${state.player.healingCharges}`;
  weapon.dataset.weaponId = state.player.weaponId;
  action.dataset.actionId = state.player.action;
  healthMeter.style.width = `${100 * state.player.health / state.player.maxHealth}%`;
  staminaMeter.style.width = `${100 * state.player.stamina / state.player.maxStamina}%`;
  document.documentElement.dataset.paused = state.paused ? "true" : "false";
  const objectiveLabels: Record<
    GameState["encounter"]["phase"],
    string
  > = {
    training: state.encounter.trainingSpawned
      ? "完成攻击与格挡训练"
      : "进入第一个琥珀训练环",
    "wave-one": "击败第一波敌人",
    elite:
      state.status === "upgrade"
        ? "选择升级后进入精英战"
        : "击败钟甲精英并开启王庭闸门",
    boss: "击败钟鸣君主",
    complete: "竞技场挑战完成",
  };
  objectiveTitle.textContent = objectiveLabels[state.encounter.phase];
  arenaStatus.textContent =
    `${state.encounter.phase} · 闸门${state.encounter.gateOpen ? "开启" : "关闭"}`;
  const entityDiagnostics = synchronizer.getDiagnostics();
  telegraphBanner.hidden = entityDiagnostics.telegraphIds.length === 0;
  telegraphBanner.textContent =
    entityDiagnostics.telegraphIds.length === 0
      ? ""
      : `敌人正在蓄力：${entityDiagnostics.telegraphIds.join("、")}`;
  upgradeModal.hidden = state.status !== "upgrade";
  defeatModal.hidden = state.status !== "defeated";
  completeModal.hidden = state.status !== "complete";
  if (focusedStatus !== state.status) {
    focusedStatus = state.status;
    if (state.status === "upgrade") {
      upgradeButtons[0]?.focus();
    } else if (state.status === "defeated") {
      retryButton.focus();
    } else if (state.status === "complete") {
      completeModal.focus();
    }
  }
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
  synchronizer.sync(state, frameDelta);
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
      const entityDiagnostics = synchronizer.getDiagnostics();
      return {
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
          ? 4.5
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
      const enemy = state.enemies[enemyId];
      if (!enemy) throw new Error(`Unknown enemy: ${enemyId}`);
      if (state.status !== "playing") {
        throw new Error("Player strike requires a playing simulation");
      }
      const forward = {
        x: Math.sin(state.player.facingRadians),
        y: Math.cos(state.player.facingRadians),
      };
      const position = {
        x: state.player.position.x + forward.x * 1.2,
        y: state.player.position.y + forward.y * 1.2,
      };
      state = {
        ...state,
        player: {
          ...state.player,
          action: "idle",
          actionTime: 0,
          stamina: state.player.maxStamina,
        },
        enemies: Object.fromEntries(
          Object.entries(state.enemies).map(([id, current]) => [
            id,
            id === enemyId
              ? {
                  ...current,
                  position,
                  health: Math.min(current.health, 18),
                  aiEnabled: false,
                  action: "idle" as const,
                  actionTime: 0,
                  intent: "observe" as const,
                  currentMoveId: null,
                  movePhase: "none" as const,
                  moveElapsedTicks: 0,
                  cooldownTicks: 0,
                  staggerTicks: 0,
                  targetId: state.player.id,
                }
              : { ...current, aiEnabled: false },
          ]),
        ),
        combat: {
          ...state.combat,
          activeAttack: null,
          attackInputHeld: false,
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
      for (let tick = 0; tick < 60; tick += 1) {
        const result = stepGame(
          state,
          {
            ...neutral,
            attackPressed: tick === 0,
          },
          1 / 60,
          arenaContent,
        );
        state = result.state;
        routeGameplayEvents(result.events);
        persistFromEvents(result.events);
        if (state.status !== "playing") break;
      }
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
  upgradeButtons.forEach((button) =>
    button.removeEventListener("click", onUpgradeClick));
  retryButton.removeEventListener("click", onRetry);
  newRunButtons.forEach((button) =>
    button.removeEventListener("click", onNewRun));
  input.dispose();
  synchronizer.dispose();
  cameraController.dispose();
  player.dispose();
  arena.dispose();
  delete window.__ashfallDiagnostics;
  document.documentElement.dataset.runtimeDisposed = "true";
};
window.addEventListener("pagehide", dispose, { once: true });
