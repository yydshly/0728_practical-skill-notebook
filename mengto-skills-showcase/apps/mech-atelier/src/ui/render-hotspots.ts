import type { MechModuleSlot } from "@showcase/game-assets";
import type {
  ConfiguratorSceneController,
  HotspotProjection,
} from "../scene/create-configurator-scene";

const hotspotDefinitions = [
  { slot: "head", label: "头部", controls: "option-group-headId" },
  { slot: "armor", label: "装甲", controls: "option-group-armorId" },
  {
    slot: "leftWeapon",
    label: "左侧武器",
    controls: "option-group-leftWeaponId",
  },
  {
    slot: "rightWeapon",
    label: "右侧武器",
    controls: "option-group-rightWeaponId",
  },
  {
    slot: "rearModule",
    label: "背部模块",
    controls: "option-group-rearModuleId",
  },
] as const satisfies readonly {
  slot: MechModuleSlot;
  label: string;
  controls: string;
}[];

export interface HotspotController {
  update(): void;
  dispose(): void;
}

export function renderHotspots(
  container: HTMLElement,
  scene: Pick<ConfiguratorSceneController, "projectHotspot" | "onFrame">,
  onActivate: (slot: MechModuleSlot, controlsId: string) => void,
): HotspotController {
  let disposed = false;
  const buttons = new Map<MechModuleSlot, HTMLButtonElement>();
  const listeners = new Map<MechModuleSlot, () => void>();

  for (const definition of hotspotDefinitions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "part-hotspot";
    button.dataset.partHotspot = definition.slot;
    button.dataset.hotspotVisibility = "invalid";
    button.setAttribute("aria-label", definition.label);
    button.setAttribute("aria-controls", definition.controls);
    button.innerHTML = `
      <span aria-hidden="true"></span>
      <strong>${definition.label}</strong>
    `;
    const activate = () => onActivate(definition.slot, definition.controls);
    button.addEventListener("click", activate);
    listeners.set(definition.slot, activate);
    buttons.set(definition.slot, button);
    container.append(button);
  }

  function updateButton(
    button: HTMLButtonElement,
    projection: HotspotProjection,
  ): void {
    button.dataset.hotspotVisibility = projection.hiddenReason;
    button.hidden = !projection.visible;
    button.style.transform = `translate3d(${projection.x.toFixed(2)}px, ${projection.y.toFixed(2)}px, 0)`;
  }

  const update = (): void => {
    if (disposed) return;
    for (const [slot, button] of buttons) {
      updateButton(button, scene.projectHotspot(slot));
    }
  };
  const unsubscribe = scene.onFrame(update);

  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      for (const [slot, button] of buttons) {
        const listener = listeners.get(slot);
        if (listener) button.removeEventListener("click", listener);
      }
      buttons.clear();
      listeners.clear();
      container.replaceChildren();
    },
  };
}
