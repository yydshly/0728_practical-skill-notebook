import type { InspectorState, MonsterDefinition } from "@showcase/game-assets";
import type { InspectorActionStatus } from "../scene/create-inspector-scene";

const actionLabels = {
  Idle: "待机",
  Walk: "行走",
  Attack: "攻击",
  Hit: "受击",
  Death: "倒地",
} as const;

export interface InspectorView {
  readonly canvas: HTMLCanvasElement;
  readonly fallback: HTMLElement;
  update(state: InspectorState, monster: MonsterDefinition, actionState?: InspectorActionStatus): void;
}

export function renderInspector(
  host: HTMLElement,
  onAction: (action: InspectorState["action"]) => void,
  onPause: () => void,
  onRestart: () => void,
  onOverlay: (name: keyof InspectorState["overlays"]) => void,
): InspectorView {
  host.innerHTML = `<section class="inspector-panel" data-inspector aria-labelledby="inspector-title">
    <header class="inspector-header"><p class="eyebrow">实时检视器 / WebGL</p><h2 id="inspector-title"></h2><p class="inspector-subtitle"></p></header>
    <div class="scene-shell"><canvas aria-label="选中怪物的实时 3D 审阅模型"></canvas><div class="scene-fallback" hidden></div><p class="scene-hint">拖拽旋转 · 滚轮或双指缩放</p></div>
    <div class="inspector-controls">
      <section class="action-controls" aria-labelledby="action-controls-title"><h3 id="action-controls-title">动作审阅</h3><div class="action-buttons"></div><button type="button" data-pause-action></button><button type="button" data-restart-action>重新播放</button><p class="review-status" data-action-status aria-live="polite"></p></section>
      <fieldset class="overlay-controls"><legend>技术叠加</legend><label><input type="checkbox" data-overlay="skeleton"> 显示骨架</label><label><input type="checkbox" data-overlay="colliders"> 显示碰撞体</label><label><input type="checkbox" data-overlay="sockets"> 显示挂点</label><p class="review-status" data-overlay-status aria-live="polite"></p></fieldset>
    </div>
    <dl class="metadata"></dl>
  </section>`;

  const title = host.querySelector<HTMLHeadingElement>("#inspector-title")!;
  const subtitle = host.querySelector<HTMLElement>(".inspector-subtitle")!;
  const actionControls = host.querySelector<HTMLElement>(".action-buttons")!;
  const metadata = host.querySelector<HTMLDListElement>(".metadata")!;
  const canvas = host.querySelector<HTMLCanvasElement>("canvas")!;
  const fallback = host.querySelector<HTMLElement>(".scene-fallback")!;
  const pause = host.querySelector<HTMLButtonElement>("[data-pause-action]")!;
  const restart = host.querySelector<HTMLButtonElement>("[data-restart-action]")!;
  const actionStatus = host.querySelector<HTMLElement>("[data-action-status]")!;
  const overlayStatus = host.querySelector<HTMLElement>("[data-overlay-status]")!;
  const actionButtons = new Map<InspectorState["action"], HTMLButtonElement>();
  const overlayInputs = new Map<keyof InspectorState["overlays"], HTMLInputElement>();

  for (const action of Object.keys(actionLabels) as InspectorState["action"][]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = actionLabels[action];
    button.setAttribute("aria-label", actionLabels[action]);
    button.title = action;
    button.addEventListener("click", () => onAction(action));
    actionButtons.set(action, button);
    actionControls.append(button);
  }
  pause.addEventListener("click", onPause);
  restart.addEventListener("click", onRestart);
  for (const input of host.querySelectorAll<HTMLInputElement>("[data-overlay]")) {
    const name = input.dataset.overlay as keyof InspectorState["overlays"];
    input.addEventListener("change", () => onOverlay(name));
    overlayInputs.set(name, input);
  }

  return {
    canvas,
    fallback,
    update(state, monster, runtime = { name: state.action, elapsed: 0, progress: 0, completed: false, paused: state.paused }) {
      title.textContent = monster.displayName;
      subtitle.textContent = "程序化 Three.js · 运行时工厂已交付 · 目录 PNG 已交付";
      for (const [action, button] of actionButtons) {
        button.classList.toggle("is-active", action === runtime.name);
        button.setAttribute("aria-pressed", String(action === runtime.name));
      }
      pause.textContent = runtime.paused ? "继续播放" : "暂停动画";
      const actionText = actionLabels[runtime.name];
      const activity = runtime.paused ? "已暂停" : runtime.completed ? "已完成" : "播放中";
      actionStatus.textContent = `${actionText} / ${runtime.name} · ${runtime.elapsed.toFixed(2)} 秒 · ${activity}${state.actionEvent === "restarted" ? " · 已重新播放" : ""}`;
      for (const [name, input] of overlayInputs) input.checked = state.overlays[name];
      overlayStatus.textContent = [
        `骨架${state.overlays.skeleton ? "已显示" : "已隐藏"}`,
        `碰撞体${state.overlays.colliders ? "已显示" : "已隐藏"}`,
        `挂点${state.overlays.sockets ? "已显示" : "已隐藏"}`,
      ].join(" · ");
      const { width, height, depth, groundOffset } = monster.bounds;
      metadata.innerHTML = `<dt>来源类型</dt><dd>运行时程序化（Runtime procedural）</dd>
        <dt>工厂 ID</dt><dd>${monster.factoryId}</dd>
        <dt>动作数量</dt><dd>${monster.actions.length}（${monster.actions.join("、")}）</dd>
        <dt>插槽名称</dt><dd>${monster.sockets.map((socket) => socket.name).join("、")}</dd>
        <dt>尺寸</dt><dd>${width} × ${height} × ${depth} 米</dd>
        <dt>接地偏移</dt><dd>${groundOffset} 米；${monster.review.notes}</dd>
        <dt>资产边界</dt><dd>此资产未使用导入的 GLB/FBX 文件。</dd>`;
    },
  };
}
