import { catalog } from "../content/catalog";
import type { MechConfiguration } from "../configuration/types";

export interface RenderFallbackController {
  update(configuration: MechConfiguration): void;
  dispose(): void;
}

/**
 * A deliberately static, local schematic for browsers without a usable WebGL
 * renderer. It is configuration-aware but never represents itself as live 3D.
 */
export function renderFallback(
  stage: HTMLElement,
  configuration: MechConfiguration,
): RenderFallbackController {
  const schematic = document.createElement("div");
  schematic.className = "render-fallback";
  schematic.dataset.renderFallback = "active";
  schematic.setAttribute("role", "status");
  schematic.innerHTML = `
    <div class="fallback-illustration" aria-hidden="true">
      <div class="fallback-outline" data-fallback-outline-visual="scout">
        <i class="fallback-head"></i><i class="fallback-core"></i><i class="fallback-left"></i><i class="fallback-right"></i><i class="fallback-legs"></i>
      </div>
      <div class="fallback-outline" data-fallback-outline-visual="hauler">
        <i class="fallback-hauler-cabin"></i><i class="fallback-hauler-bed"></i><i class="fallback-hauler-wheel fallback-hauler-wheel--left"></i><i class="fallback-hauler-wheel fallback-hauler-wheel--right"></i>
      </div>
      <div class="fallback-outline" data-fallback-outline-visual="oracle">
        <i class="fallback-oracle-crown"></i><i class="fallback-oracle-core"></i><i class="fallback-oracle-wing fallback-oracle-wing--left"></i><i class="fallback-oracle-wing fallback-oracle-wing--right"></i><i class="fallback-oracle-pedestal"></i>
      </div>
    </div>
    <div class="fallback-copy">
      <strong>3D 预览不可用</strong>
      <span>当前显示的是本地静态结构示意，不是实时 3D 模型。</span>
      <small data-fallback-chassis></small>
    </div>
  `;
  stage.prepend(schematic);
  const label = schematic.querySelector<HTMLElement>("[data-fallback-chassis]");

  const update = (next: MechConfiguration): void => {
    const chassis = catalog.chassis.find((candidate) => candidate.id === next.chassisId);
    schematic.dataset.chassis = next.chassisId;
    schematic.dataset.fallbackOutline = fallbackOutlineFor(next.chassisId);
    label!.textContent = `${chassis?.name ?? next.chassisId} / STATIC SCHEMATIC`;
  };
  update(configuration);

  return {
    update,
    dispose() {
      schematic.remove();
    },
  };
}

function fallbackOutlineFor(chassisId: string): "scout" | "hauler" | "oracle" {
  if (chassisId === "bastion-hauler") return "hauler";
  if (chassisId === "oracle-frame") return "oracle";
  return "scout";
}
