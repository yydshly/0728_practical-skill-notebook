import type { MonsterDefinition } from "@showcase/game-assets";

export type FallbackReason =
  | "webgl-unavailable"
  | "renderer-init-failed"
  | "model-creation-failed"
  | "runtime-failed";

export function fallbackDetails(reason: FallbackReason): Readonly<{ title: string; message: string }> {
  switch (reason) {
    case "webgl-unavailable":
      return { title: "3D 预览不可用", message: "当前浏览器未提供 WebGL，已显示同一资产的透明目录预览。" };
    case "renderer-init-failed":
      return { title: "3D 预览不可用", message: "渲染器初始化失败，已显示同一资产的透明目录预览。" };
    case "model-creation-failed":
      return { title: "3D 预览不可用", message: "模型创建失败，已显示同一资产的透明目录预览。" };
    case "runtime-failed":
      return { title: "实时预览运行失败", message: "模型更新或渲染已终止，已显示同一资产的透明目录预览；重试会重建 3D 场景。" };
  }
}

const sourceLabel = (definition: MonsterDefinition) =>
  definition.source.type === "procedural" ? "运行时程序化（procedural-three）" : definition.source.type;

export function renderFallback(container: HTMLElement, definition: MonsterDefinition, reason: FallbackReason, detail: string, onRetry: () => void): void {
  const content = fallbackDetails(reason);
  container.hidden = false;
  container.innerHTML = `<div class="fallback-card" data-fallback-reason="${reason}">
    <img src="${definition.previewPath}" alt="${definition.displayName} 透明目录预览" />
    <div class="fallback-copy"><strong>${content.title}</strong><span>${content.message}</span>
      <dl><dt>来源</dt><dd>${sourceLabel(definition)}</dd><dt>尺寸</dt><dd>${definition.bounds.width} × ${definition.bounds.height} × ${definition.bounds.depth} 米</dd><dt>动作</dt><dd>${definition.actions.join("、")}</dd><dt>具体原因</dt><dd>${detail || content.message}</dd></dl>
      <button type="button" data-retry-preview>重试 3D 预览</button>
    </div>
  </div>`;
  container.querySelector<HTMLButtonElement>("[data-retry-preview]")!.addEventListener("click", onRetry, { once: true });
}
