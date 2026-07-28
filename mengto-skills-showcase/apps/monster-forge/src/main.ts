import { monsters } from "@showcase/game-assets";
import { createInspectorStore } from "./state/inspector-store";
import {
  createInspectorScene,
  type InspectorScene,
  type InspectorActionStatus,
  type InspectorSceneDiagnostics,
} from "./scene/create-inspector-scene";
import { renderCatalog } from "./ui/render-catalog";
import { renderInspector } from "./ui/render-inspector";
import "./styles.css";

declare global {
  interface Window {
    __monsterForgeDiagnostics?: () => InspectorSceneDiagnostics | undefined;
  }
}

const app = document.querySelector<HTMLElement>("#app")!;
const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
const store = createInspectorStore("ash-warden");
app.innerHTML = `<main class="forge-shell"><header class="forge-intro"><p class="eyebrow">MONSTER FORGE · REVIEW BAY 03</p><h1>怪物锻造所</h1><p>在同一座实时审阅台上切换程序化怪物，并保留每项资产的来源、接地依据与交付边界。</p><p class="live-status" role="status" aria-live="polite"></p></header><div class="forge-workspace"><aside data-catalog></aside><section data-inspector-host></section></div></main>`;
const catalogHost = app.querySelector<HTMLElement>("[data-catalog]")!;
const inspectorHost = app.querySelector<HTMLElement>("[data-inspector-host]")!;
const status = app.querySelector<HTMLElement>(".live-status")!;
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
let sceneError = "";
let refreshStatus = () => {};
const showSceneStatus = (next: SceneStatus, error?: unknown) => {
  sceneStatus = next;
  sceneError = error instanceof Error ? error.message : error ? String(error) : "";
  const title = inspector.fallback.querySelector<HTMLElement>("strong")!;
  const copy = inspector.fallback.querySelector<HTMLElement>("span")!;
  if (next === "ready") {
    inspector.fallback.hidden = true;
  } else {
    inspector.fallback.hidden = false;
    title.textContent = next === "loading" ? "3D 预览正在准备" : "3D 预览不可用";
    copy.textContent = next === "loading"
      ? "正在建立实时审阅场景；目录、资产来源和元数据仍可阅读。"
      : `已保留目录、资产来源和审阅元数据；请恢复 WebGL 后重试。${sceneError ? `（${sceneError}）` : ""}`;
  }
  refreshStatus();
};
showSceneStatus("loading");
let scene: InspectorScene | undefined;
try {
  scene = createInspectorScene(inspector.canvas, {
    onReady: () => showSceneStatus("ready"),
    onUnavailable: (error) => showSceneStatus("unavailable", error),
    onActionState: (actionState) => {
      runtimeActionState = actionState;
      const currentState = store.getState();
      inspector.update(currentState, monsterById.get(currentState.selectedId)!, runtimeActionState);
    },
  });
} catch (error) {
  showSceneStatus("unavailable", error);
}
window.__monsterForgeDiagnostics = () => scene?.getDiagnostics();

let previousSelectedId = "";
const render = () => {
  const state = store.getState();
  const monster = monsterById.get(state.selectedId)!;
  catalog.update(state.selectedId);
  inspector.update(state, monster, runtimeActionState);
  if (previousSelectedId !== state.selectedId) {
    if (sceneStatus !== "unavailable") showSceneStatus("loading");
    scene?.setMonster(monster);
  }
  scene?.setState(state);
  status.textContent = `当前审阅：${monster.displayName} · ${
    sceneStatus === "ready"
      ? "实时模型已就绪"
      : sceneStatus === "loading"
        ? "实时模型正在准备"
        : "3D 预览不可用，已显示可读回退"
  }`;
  previousSelectedId = state.selectedId;
};
refreshStatus = () => {
  const monster = monsterById.get(store.getState().selectedId)!;
  status.textContent = `当前审阅：${monster.displayName} · ${
    sceneStatus === "ready"
      ? "实时模型已就绪"
      : sceneStatus === "loading"
        ? "实时模型正在准备"
        : "3D 预览不可用，已显示可读回退"
  }`;
};
render();
const unsubscribe = store.subscribe(render);
window.addEventListener("pagehide", () => { unsubscribe(); scene?.dispose(); }, { once: true });
