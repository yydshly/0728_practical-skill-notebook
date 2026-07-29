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
    layerWidth: number,
    layerHeight: number,
    width: number,
    height: number,
  ): void {
    button.dataset.hotspotVisibility = projection.hiddenReason;
    button.hidden = !projection.visible;
    if (!projection.visible) return;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const x = Math.min(
      Math.max(projection.x, halfWidth),
      Math.max(halfWidth, layerWidth - halfWidth),
    );
    const y = Math.min(
      Math.max(projection.y, halfHeight),
      Math.max(halfHeight, layerHeight - halfHeight),
    );
    button.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) ` +
      "translate(-50%, -50%)";
  }

  const update = (): void => {
    if (disposed) return;
    const layerWidth = container.clientWidth;
    const layerHeight = container.clientHeight;
    const pending = [...buttons].map(([slot, button]) => ({
      button,
      projection: scene.projectHotspot(slot),
    }));
    // Read all layout metrics before writing transforms, preventing one
    // read/write layout cycle per hotspot on every frame.
    const metrics = pending.map(({ button, projection }) => ({
      button,
      projection,
      width: button.offsetWidth,
      height: button.offsetHeight,
    }));
    for (const { button, projection, width, height } of metrics) {
      updateButton(
        button,
        projection,
        layerWidth,
        layerHeight,
        width,
        height,
      );
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
