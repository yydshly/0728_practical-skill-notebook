import { calculateSummary } from "../configuration/calculate-summary";
import { validateConfiguration } from "../configuration/validate-config";
import { catalog } from "../content/catalog";
import type {
  MechConfiguration,
  PartDefinition,
  PartSlot,
} from "../configuration/types";

type SelectionField =
  | "chassisId"
  | "headId"
  | "armorId"
  | "leftWeaponId"
  | "rightWeaponId"
  | "rearModuleId";

interface SelectionGroup {
  field: SelectionField;
  legend: string;
  sequence: string;
  options: readonly {
    id: string;
    name: string;
    priceCredits: number;
    weight: number;
  }[];
}

const selectionGroups: readonly SelectionGroup[] = [
  {
    field: "chassisId",
    legend: "底盘",
    sequence: "01",
    options: catalog.chassis,
  },
  {
    field: "headId",
    legend: "头部",
    sequence: "02",
    options: catalog.heads,
  },
  {
    field: "armorId",
    legend: "装甲",
    sequence: "03",
    options: catalog.armors,
  },
  {
    field: "leftWeaponId",
    legend: "左侧武器",
    sequence: "04",
    options: catalog.weapons,
  },
  {
    field: "rightWeaponId",
    legend: "右侧武器",
    sequence: "05",
    options: catalog.weapons,
  },
  {
    field: "rearModuleId",
    legend: "背部模块",
    sequence: "06",
    options: catalog.rearModules,
  },
];

const finishPalettes = [
  {
    id: "ember-brass",
    name: "余烬黄铜",
    primary: "#7a2f24",
    secondary: "#d8b36a",
  },
  {
    id: "ocean-steel",
    name: "深海冷钢",
    primary: "#244a62",
    secondary: "#8fd5e5",
  },
  {
    id: "graphite-alert",
    name: "石墨警戒",
    primary: "#34363c",
    secondary: "#e35f43",
  },
] as const;

export function renderOptionGroups(
  container: HTMLElement,
  config: MechConfiguration,
): void {
  container.innerHTML = [
    ...selectionGroups.map((group) => renderSelectionGroup(group, config)),
    renderPaletteGroup(config),
    renderChoiceGroup(
      "金属度",
      "finish.metalness",
      [
        { value: "0", name: "非金属" },
        { value: "0.5", name: "混合金属" },
        { value: "1", name: "高金属" },
      ],
      String(config.finish.metalness),
      "08",
    ),
    renderChoiceGroup(
      "粗糙度",
      "finish.roughness",
      [
        { value: "0.2", name: "精抛光" },
        { value: "0.6", name: "工业磨砂" },
        { value: "1", name: "粗粒表面" },
      ],
      String(config.finish.roughness),
      "09",
    ),
    renderChoiceGroup(
      "环境",
      "finish.environment",
      [
        { value: "foundry", name: "铸造厂" },
        { value: "hangar", name: "机库" },
        { value: "dusk", name: "暮色" },
      ],
      config.finish.environment,
      "10",
    ),
  ].join("");
}

function renderSelectionGroup(
  group: SelectionGroup,
  config: MechConfiguration,
): string {
  return `
    <fieldset class="option-group" data-option-group="${group.field}">
      <legend><span>${group.sequence}</span>${group.legend}</legend>
      <div class="option-list">
        ${group.options
          .map((option) => {
            const reason = disabledReason(group.field, option.id, config);
            const reasonId = reason
              ? `reason-${group.field}-${option.id}`
              : "";
            const selected = config[group.field] === option.id;
            return `
              <label class="option-card${reason ? " is-disabled" : ""}">
                <input
                  type="radio"
                  name="${group.field}"
                  value="${option.id}"
                  data-config-field="${group.field}"
                  aria-label="${option.name}"
                  ${reason ? "disabled" : ""}
                  ${reasonId ? `aria-describedby="${reasonId}"` : ""}
                  ${selected ? "checked" : ""}
                />
                <span class="option-indicator" aria-hidden="true"></span>
                <span class="option-copy">
                  <strong>${option.name}</strong>
                  <small>+${option.weight} kg · ${option.priceCredits.toLocaleString("en-US")} cr</small>
                  ${
                    reason
                      ? `<em class="option-reason" id="${reasonId}">${option.name}：${reason}</em>`
                      : ""
                  }
                </span>
              </label>
            `;
          })
          .join("")}
      </div>
    </fieldset>
  `;
}

function renderPaletteGroup(config: MechConfiguration): string {
  return `
    <fieldset class="option-group option-group--palette">
      <legend><span>07</span>涂装</legend>
      <div class="palette-list">
        ${finishPalettes
          .map((palette) => {
            const selected =
              palette.primary === config.finish.primary &&
              palette.secondary === config.finish.secondary;
            return `
              <label class="palette-option">
                <input
                  type="radio"
                  name="finish.palette"
                  value="${palette.id}"
                  data-finish-palette
                  data-primary="${palette.primary}"
                  data-secondary="${palette.secondary}"
                  aria-label="${palette.name}"
                  ${selected ? "checked" : ""}
                />
                <span class="palette-swatches" aria-hidden="true">
                  <i style="--swatch:${palette.primary}"></i>
                  <i style="--swatch:${palette.secondary}"></i>
                </span>
                <strong>${palette.name}</strong>
              </label>
            `;
          })
          .join("")}
      </div>
    </fieldset>
  `;
}

function renderChoiceGroup(
  legend: string,
  field: string,
  options: readonly { value: string; name: string }[],
  selected: string,
  sequence: string,
): string {
  return `
    <fieldset class="option-group option-group--compact">
      <legend><span>${sequence}</span>${legend}</legend>
      <div class="segment-list">
        ${options
          .map(
            (option) => `
              <label>
                <input
                  type="radio"
                  name="${field}"
                  value="${option.value}"
                  data-finish-field="${field.replace("finish.", "")}"
                  aria-label="${option.name}"
                  ${option.value === selected ? "checked" : ""}
                />
                <span>${option.name}</span>
              </label>
            `,
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function disabledReason(
  field: SelectionField,
  optionId: string,
  config: MechConfiguration,
): string | null {
  if (field === "chassisId") return null;

  const proposed = {
    ...config,
    [field]: optionId,
  } as MechConfiguration;
  const validation = validateConfiguration(proposed, catalog);
  if (validation.ok) return null;

  const fieldIssue = validation.issues.find((issue) => issue.field === field);
  if (fieldIssue?.code === "slot-incompatible") {
    const part = findPart(optionId);
    if (part?.slots.includes("rightWeapon")) return "仅支持右侧武器位。";
    if (part?.slots.includes("leftWeapon")) return "仅支持左侧武器位。";
    return "不支持这个挂载位。";
  }
  if (fieldIssue?.code === "chassis-incompatible") {
    const chassis = catalog.chassis.find(
      (candidate) => candidate.id === config.chassisId,
    );
    return `与${chassis?.name ?? "当前"}底盘不兼容。`;
  }
  if (validation.issues.some((issue) => issue.code === "weight-limit")) {
    const chassis = catalog.chassis.find(
      (candidate) => candidate.id === config.chassisId,
    );
    const summary = calculateSummary(proposed, catalog);
    return `当前组合为 ${summary.weight} kg，超过${chassis?.name ?? "当前底盘"}上限 ${chassis?.weightLimit ?? "—"} kg。`;
  }
  return "当前配置不可用。";
}

function findPart(id: string): PartDefinition | undefined {
  return [
    ...catalog.heads,
    ...catalog.armors,
    ...catalog.weapons,
    ...catalog.rearModules,
  ].find((part) => part.id === id);
}

export function slotForSelectionField(
  field: SelectionField,
): PartSlot | null {
  if (field === "chassisId") return null;
  if (field === "headId") return "head";
  if (field === "armorId") return "armor";
  if (field === "leftWeaponId") return "leftWeapon";
  if (field === "rightWeaponId") return "rightWeapon";
  return "rearModule";
}
