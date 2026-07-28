import { monsters } from "@showcase/game-assets";
import { createInspectorStore } from "./state/inspector-store";
import { createInspectorScene, type InspectorScene } from "./scene/create-inspector-scene";
import { renderCatalog } from "./ui/render-catalog";
import { renderInspector } from "./ui/render-inspector";
import "./styles.css";

const app = document.querySelector<HTMLElement>("#app")!;
const monsterById = new Map(monsters.map((monster) => [monster.id, monster]));
const store = createInspectorStore("ash-warden");
app.innerHTML = `<main class="forge-shell"><header class="forge-intro"><p class="eyebrow">MONSTER FORGE · REVIEW BAY 03</p><h1>怪物锻造所</h1><p>在同一座实时审阅台上切换程序化怪物，并保留每项资产的来源、接地依据与交付边界。</p><p class="live-status" role="status" aria-live="polite"></p></header><div class="forge-workspace"><aside data-catalog></aside><section data-inspector-host></section></div></main>`;
const catalogHost = app.querySelector<HTMLElement>("[data-catalog]")!;
const inspectorHost = app.querySelector<HTMLElement>("[data-inspector-host]")!;
const status = app.querySelector<HTMLElement>(".live-status")!;
const catalog = renderCatalog(catalogHost, monsters, (id) => store.select(id));
const inspector = renderInspector(inspectorHost, (action) => store.setAction(action), () => store.setPaused(!store.getState().paused), (name) => store.toggleOverlay(name));
let scene: InspectorScene | undefined;
try { scene = createInspectorScene(inspector.canvas, { onUnavailable: () => { inspector.fallback.hidden = false; } }); }
catch { inspector.fallback.hidden = false; }

let previousSelectedId = "";
const render = () => {
  const state = store.getState();
  const monster = monsterById.get(state.selectedId)!;
  catalog.update(state.selectedId);
  inspector.update(state, monster);
  if (previousSelectedId !== state.selectedId) scene?.setMonster(monster);
  scene?.setState(state);
  status.textContent = `当前审阅：${monster.displayName} · ${inspector.fallback.hidden ? "实时模型已就绪" : "3D 预览不可用，已显示可读回退"}`;
  previousSelectedId = state.selectedId;
};
render();
const unsubscribe = store.subscribe(render);
window.addEventListener("pagehide", () => { unsubscribe(); scene?.dispose(); }, { once: true });
