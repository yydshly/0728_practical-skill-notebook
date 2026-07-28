import type { InspectorState, MonsterDefinition } from "@showcase/game-assets";

export interface InspectorView { readonly canvas: HTMLCanvasElement; readonly fallback: HTMLElement; update(state: InspectorState, monster: MonsterDefinition): void; }

export function renderInspector(host: HTMLElement, onAction: (action: InspectorState["action"]) => void, onPause: () => void, onOverlay: (name: keyof InspectorState["overlays"]) => void): InspectorView {
  host.innerHTML = `<section class="inspector-panel" data-inspector aria-labelledby="inspector-title"><header class="inspector-header"><p class="eyebrow">实时检视器 / WebGL</p><h2 id="inspector-title"></h2><p class="inspector-subtitle"></p></header><div class="scene-shell"><canvas aria-label="选中怪物的实时 3D 审阅模型"></canvas><div class="scene-fallback" hidden><strong>3D 预览不可用</strong><span>已保留目录、资产来源和审阅元数据；请恢复 WebGL 后重试。</span></div><p class="scene-hint">拖拽旋转 · 滚轮或双指缩放</p></div><div class="inspector-controls"><div class="action-controls" aria-label="动作控制"></div><div class="overlay-controls" aria-label="技术叠加"></div></div><dl class="metadata"></dl></section>`;
  const title = host.querySelector<HTMLHeadingElement>("#inspector-title")!;
  const subtitle = host.querySelector<HTMLElement>(".inspector-subtitle")!;
  const actionControls = host.querySelector<HTMLElement>(".action-controls")!;
  const overlayControls = host.querySelector<HTMLElement>(".overlay-controls")!;
  const metadata = host.querySelector<HTMLDListElement>(".metadata")!;
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const fallback = host.querySelector<HTMLElement>(".scene-fallback")!;
  const actionButtons = new Map<string, HTMLButtonElement>();
  for (const action of ["Idle", "Walk", "Attack", "Hit", "Death"] as const) { const button = document.createElement("button"); button.type = "button"; button.textContent = action; button.addEventListener("click", () => onAction(action)); actionButtons.set(action, button); actionControls.append(button); }
  const pause = document.createElement("button"); pause.type = "button"; pause.addEventListener("click", onPause); actionControls.append(pause);
  const overlayButtons = new Map<keyof InspectorState["overlays"], HTMLButtonElement>();
  for (const [key, label] of [["skeleton", "骨架"], ["colliders", "碰撞体"], ["sockets", "插槽"]] as const) { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.addEventListener("click", () => onOverlay(key)); overlayButtons.set(key, button); overlayControls.append(button); }
  return { canvas, fallback, update(state, monster) { title.textContent = monster.displayName; subtitle.textContent = "程序化 Three.js · 运行时工厂已交付 · 目录 PNG 未交付"; for (const [action, button] of actionButtons) button.classList.toggle("is-active", action === state.action); pause.textContent = state.paused ? "继续" : "暂停"; for (const [name, button] of overlayButtons) button.setAttribute("aria-pressed", String(state.overlays[name])); metadata.innerHTML = `<dt>来源</dt><dd>${monster.source.description}</dd><dt>模型格式</dt><dd>procedural-three（运行时程序化）</dd><dt>交付状态</dt><dd>目录 PNG：尚未交付；实时模型：运行时工厂</dd><dt>接地依据</dt><dd>${monster.review.notes}</dd>`; } };
}
