import { createProceduralMonster, monsters } from "@showcase/game-assets";
import { createInspectorStore } from "./state/inspector-store";
import {
  createInspectorScene,
  type InspectorActionStatus,
  type InspectorScene,
  type InspectorSceneDiagnostics,
  type InspectorUnavailableKind,
} from "./scene/create-inspector-scene";
import { renderCatalog } from "./ui/render-catalog";
import { renderFallback, type FallbackReason } from "./ui/render-fallback";
import { renderInspector } from "./ui/render-inspector";
import "./styles.css";

declare global { interface Window { __monsterForgeDiagnostics?: () => InspectorSceneDiagnostics | undefined; } }

const query = new URLSearchParams(window.location.search);
const captureMode = query.get("capture") === "1";
const reviewControls = query.get("reviewControls") === "1";
const forcedWebglFailure =
  reviewControls && query.get("forceWebglFailure") === "1";
let remainingModelFailures =
  reviewControls && query.get("forceModelFailure") === "1" ? 1 : 0;
let remainingRuntimeFailures =
  reviewControls && query.get("forceRuntimeFailure") === "1" ? 1 : 0;
const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
const reviewedId = query.get("review");
const initialId = reviewedId && monsterById.has(reviewedId) ? reviewedId : "ash-warden";
const app = document.querySelector<HTMLElement>("#app")!;
app.classList.toggle("capture-mode", captureMode);
app.innerHTML = `<main class="forge-shell"><header class="forge-intro"><p class="eyebrow">MONSTER FORGE · REVIEW BAY 03</p><h1>怪物锻造所</h1><p>在同一座实时审阅台上切换程序化怪物，并保留每项资产的来源、接地依据与交付边界。</p><p class="live-status" role="status" aria-live="polite"></p></header><div class="forge-workspace"><aside data-catalog></aside><section data-inspector-host></section></div></main>`;

const catalogHost = app.querySelector<HTMLElement>("[data-catalog]")!;
const inspectorHost = app.querySelector<HTMLElement>("[data-inspector-host]")!;
const status = app.querySelector<HTMLElement>(".live-status")!;
const store = createInspectorStore(initialId);
if (captureMode) store.setPaused(true);
const catalog = renderCatalog(catalogHost, monsters, (id) => store.select(id));
let runtimeActionState: InspectorActionStatus | undefined;
const inspector = renderInspector(
  inspectorHost,
  (action) => store.setAction(action),
  () => store.setPaused(!store.getState().paused),
  () => store.restartAction(),
  (name) => store.toggleOverlay(name),
);

type SceneStatus = "loading" | "ready" | "unavailable";
let sceneStatus: SceneStatus = "loading";
let scene: InspectorScene | undefined;
let refreshStatus = () => {};
let unavailableState: Readonly<{ reason: FallbackReason; detail: string }> | undefined;

const selectedMonster = () => monsterById.get(store.getState().selectedId)!;
const unavailable = (kind: InspectorUnavailableKind | "webgl-unavailable", error: unknown) => {
  sceneStatus = "unavailable";
  const detail = error instanceof Error ? error.message : String(error || "unknown error");
  const reason: FallbackReason = kind;
  unavailableState = { reason, detail };
  renderFallback(inspector.fallback, selectedMonster(), reason, detail, () => initializeScene());
  refreshStatus();
};
const showSceneStatus = (next: SceneStatus) => {
  sceneStatus = next;
  if (next === "ready") inspector.fallback.hidden = true;
  refreshStatus();
};

function initializeScene(): void {
  if (scene && unavailableState?.reason === "model-creation-failed") {
    inspector.fallback.hidden = true;
    unavailableState = undefined;
    sceneStatus = "loading";
    scene.setMonster(selectedMonster());
    scene.setState(store.getState());
    return;
  }
  scene?.dispose();
  scene = undefined;
  inspector.fallback.hidden = true;
  if (forcedWebglFailure) {
    unavailable("webgl-unavailable", new Error("WebGL was intentionally disabled for this review fixture."));
    return;
  }
  sceneStatus = "loading";
  try {
    scene = createInspectorScene(inspector.canvas, {
      capture: captureMode,
      createMonster: (monster) => {
        if (remainingModelFailures > 0) {
          remainingModelFailures -= 1;
          throw new Error("模型创建失败：确定性审阅夹具已触发一次。");
        }
        const instance = createProceduralMonster(monster);
        if (remainingRuntimeFailures > 0) {
          const update = instance.update.bind(instance);
          let shouldFail = true;
          instance.update = (deltaSeconds) => {
            if (shouldFail) {
              shouldFail = false;
              remainingRuntimeFailures -= 1;
              throw new Error("审阅模拟：运行时更新失败");
            }
            update(deltaSeconds);
          };
        }
        return instance;
      },
      onReady: () => showSceneStatus("ready"),
      onUnavailable: (error, kind) => unavailable(kind, error),
      onActionState: (actionState) => {
        runtimeActionState = actionState;
        inspector.update(store.getState(), selectedMonster(), runtimeActionState);
      },
    });
    scene.setMonster(selectedMonster());
    scene.setState(store.getState());
  } catch (error) {
    unavailable("renderer-init-failed", error);
  }
}

window.__monsterForgeDiagnostics = () => scene?.getDiagnostics();
let previousSelectedId = "";
const render = () => {
  const state = store.getState();
  const monster = selectedMonster();
  catalog.update(state.selectedId);
  inspector.update(state, monster, runtimeActionState);
  if (previousSelectedId !== state.selectedId) {
    if (sceneStatus === "unavailable") {
      const fallback = unavailableState ?? { reason: "webgl-unavailable" as const, detail: "3D preview remains unavailable." };
      renderFallback(inspector.fallback, monster, fallback.reason, fallback.detail, () => initializeScene());
    }
    else {
      sceneStatus = "loading";
      scene?.setMonster(monster);
      scene?.setState(state);
    }
  } else scene?.setState(state);
  status.textContent = `当前审阅：${monster.displayName} · ${sceneStatus === "ready" ? "实时模型已就绪" : sceneStatus === "loading" ? "实时模型正在准备" : "3D 预览不可用，已显示可读回退"}`;
  previousSelectedId = state.selectedId;
};
refreshStatus = render;
initializeScene();
render();
const unsubscribe = store.subscribe(render);
window.addEventListener("pagehide", () => { unsubscribe(); scene?.dispose(); }, { once: true });
