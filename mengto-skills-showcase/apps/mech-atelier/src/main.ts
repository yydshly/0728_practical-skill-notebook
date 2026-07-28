import "./styles.css";
import { catalog, defaultConfiguration } from "./content/catalog";
import type {
  MechConfiguration,
  PartDefinition,
} from "./configuration/types";
import { normalizeConfiguration } from "./configuration/validate-config";
import {
  createConfiguratorScene,
  type ConfiguratorSceneSnapshot,
} from "./scene/create-configurator-scene";
import { renderOptionGroups } from "./ui/render-option-groups";
import { renderSummary } from "./ui/render-summary";

declare global {
  interface Window {
    __MECH_ATELIER_DEBUG__?: {
      snapshot(): ConfiguratorSceneSnapshot;
      nonEmptyPixelCount(): number;
    };
  }
}

type SelectionField =
  | "chassisId"
  | "headId"
  | "armorId"
  | "leftWeaponId"
  | "rightWeaponId"
  | "rearModuleId";

const reviewConfigurations = {
  default: cloneConfiguration(defaultConfiguration),
  "bastion-guard": {
    ...cloneConfiguration(defaultConfiguration),
    chassisId: "bastion-hauler",
    headId: "bulwark-head",
    armorId: "reactive-bastion",
    leftWeaponId: "aegis-shield",
    rearModuleId: "field-relay",
    finish: {
      ...defaultConfiguration.finish,
      primary: "#34363c",
      secondary: "#e35f43",
      environment: "hangar",
    },
  },
  "oracle-dusk": {
    ...cloneConfiguration(defaultConfiguration),
    chassisId: "oracle-frame",
    headId: "halo-head",
    armorId: "void-weave",
    leftWeaponId: "drone-rack",
    rightWeaponId: "rail-lance",
    rearModuleId: "field-relay",
    finish: {
      ...defaultConfiguration.finish,
      primary: "#244a62",
      secondary: "#8fd5e5",
      environment: "dusk",
    },
  },
} as const satisfies Record<string, MechConfiguration>;

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Mech Atelier app root is missing");

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="wordmark" href="/" aria-label="Mech Atelier 首页">
        <span class="wordmark-mark" aria-hidden="true">M</span>
        <span>
          <strong>MECH ATELIER</strong>
          <small>机甲概念配置系统 / 01</small>
        </span>
      </a>
      <div class="topbar-status">
        <span><i></i> 本地渲染</span>
        <span>程序化资产</span>
        <span>V1.0</span>
      </div>
    </header>

    <div class="workspace">
      <section class="product-stage" data-product-stage aria-label="机甲三维预览">
        <canvas
          data-product-canvas
          aria-label="可拖拽旋转和缩放的机甲概念模型"
          tabindex="0"
        ></canvas>
        <div class="stage-vignette" aria-hidden="true"></div>
        <div class="stage-heading">
          <p class="section-kicker">CONFIGURATION / ACTIVE</p>
          <h1>机甲定制工坊</h1>
          <p>组合模块、校验载荷，并从任意角度检查你的概念机体。</p>
        </div>
        <div class="stage-badge">
          <span>MODEL</span>
          <strong data-stage-model>游骑侦察型</strong>
        </div>
        <div class="stage-readout" aria-hidden="true">
          <span>LIVE<br />ASSEMBLY</span>
          <i></i>
          <span data-stage-environment>FOUNDRY<br />LIGHTING</span>
        </div>
        <div class="stage-controls">
          <p>拖拽旋转 · 滚轮 / 双指缩放</p>
          <button type="button" data-reset-view>
            <span aria-hidden="true">↺</span> 重置视图
          </button>
        </div>
        <p class="asset-disclosure">项目自制程序化概念模型 · L2 可检查</p>
      </section>

      <aside class="configuration-panel" aria-label="机甲配置面板">
        <div class="panel-intro">
          <div>
            <p class="section-kicker">ASSEMBLY MATRIX</p>
            <h2>部件配置</h2>
          </div>
          <span>10 组参数</span>
        </div>
        <p
          class="config-announcer"
          data-config-announcer
          role="status"
          aria-live="polite"
          aria-atomic="true"
        ></p>
        <form class="configuration-form" data-option-groups></form>
        <section class="summary-panel" data-summary aria-label="配置摘要"></section>
        <footer class="panel-footer">
          <span>所有数值来自本地纯配置规则</span>
          <span>NO CHECKOUT · NO INVENTORY</span>
        </footer>
      </aside>
    </div>
  </div>
`;

const canvas = requiredElement<HTMLCanvasElement>("[data-product-canvas]");
const optionsContainer = requiredElement<HTMLFormElement>(
  "[data-option-groups]",
);
const summaryContainer = requiredElement<HTMLElement>("[data-summary]");
const announcer = requiredElement<HTMLElement>("[data-config-announcer]");
const stageModel = requiredElement<HTMLElement>("[data-stage-model]");
const stageEnvironment = requiredElement<HTMLElement>(
  "[data-stage-environment]",
);
const resetViewButton = requiredElement<HTMLButtonElement>("[data-reset-view]");

const search = new URLSearchParams(window.location.search);
const reviewId = search.get("review");
const knownReview = reviewId !== null && isKnownReview(reviewId);
let configuration = knownReview
  ? cloneConfiguration(reviewConfigurations[reviewId])
  : cloneConfiguration(defaultConfiguration);
const initialAnnouncement =
  reviewId !== null && !knownReview
    ? `未知审阅状态 ${reviewId}，已恢复默认配置。`
    : "";

const productScene = createConfiguratorScene(canvas, configuration);
renderInterface();
announcer.textContent = initialAnnouncement;

delete window.__MECH_ATELIER_DEBUG__;
if (knownReview || search.get("reviewControls") === "1") {
  window.__MECH_ATELIER_DEBUG__ = {
    snapshot: () => productScene.snapshot(),
    nonEmptyPixelCount: () => productScene.nonEmptyPixelCount(),
  };
}

optionsContainer.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.checked) return;

  const configField = input.dataset.configField as
    | SelectionField
    | undefined;
  if (configField) {
    applyConfiguration({
      ...configuration,
      [configField]: input.value,
    } as MechConfiguration);
    return;
  }

  const finishField = input.dataset.finishField;
  if (finishField) {
    const value =
      finishField === "metalness" || finishField === "roughness"
        ? Number(input.value)
        : input.value;
    applyConfiguration({
      ...configuration,
      finish: {
        ...configuration.finish,
        [finishField]: value,
      },
    } as MechConfiguration);
    return;
  }

  if (input.hasAttribute("data-finish-palette")) {
    applyConfiguration({
      ...configuration,
      finish: {
        ...configuration.finish,
        primary: input.dataset.primary ?? configuration.finish.primary,
        secondary: input.dataset.secondary ?? configuration.finish.secondary,
      },
    });
  }
});

resetViewButton.addEventListener("click", () => productScene.resetView());
window.addEventListener(
  "pagehide",
  () => {
    productScene.dispose();
    delete window.__MECH_ATELIER_DEBUG__;
  },
  { once: true },
);

function applyConfiguration(requested: MechConfiguration): void {
  const activeName =
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement.name
      : null;
  const normalized = normalizeConfiguration(requested, catalog);
  configuration = normalized.config;
  productScene.updateConfiguration(configuration);
  announcer.textContent = describeNormalization(requested, configuration);
  renderInterface(activeName);
}

function renderInterface(focusGroup: string | null = null): void {
  renderOptionGroups(optionsContainer, configuration);
  renderSummary(summaryContainer, configuration);
  const chassis = catalog.chassis.find(
    (candidate) => candidate.id === configuration.chassisId,
  );
  stageModel.textContent = chassis?.name ?? configuration.chassisId;
  stageEnvironment.textContent = {
    foundry: "FOUNDRY\nLIGHTING",
    hangar: "HANGAR\nLIGHTING",
    dusk: "DUSK\nLIGHTING",
  }[configuration.finish.environment];

  if (focusGroup) {
    requestAnimationFrame(() => {
      const checked = [...optionsContainer.elements].find(
        (control) =>
          control instanceof HTMLInputElement &&
          control.name === focusGroup &&
          control.checked,
      );
      if (checked instanceof HTMLInputElement) {
        checked.focus({ preventScroll: true });
      }
    });
  }
}

function describeNormalization(
  requested: MechConfiguration,
  actual: MechConfiguration,
): string {
  const messages: string[] = [];
  const fields = [
    "headId",
    "armorId",
    "leftWeaponId",
    "rightWeaponId",
    "rearModuleId",
  ] as const;

  for (const field of fields) {
    if (requested[field] === actual[field]) continue;
    const requestedPart = findPart(requested[field]);
    const actualPart = findPart(actual[field]);
    const chassis = catalog.chassis.find(
      (candidate) => candidate.id === actual.chassisId,
    );
    if (
      requestedPart?.incompatibleChassisIds?.includes(actual.chassisId)
    ) {
      messages.push(
        `${requestedPart.name}与${chassis?.name ?? "当前底盘"}不兼容，已调整为${actualPart?.name ?? actual[field]}。`,
      );
    } else {
      messages.push(
        `${requestedPart?.name ?? requested[field]}超出当前配置限制，已调整为${actualPart?.name ?? actual[field]}。`,
      );
    }
  }

  return messages.join(" ");
}

function findPart(id: string): PartDefinition | undefined {
  return [
    ...catalog.heads,
    ...catalog.armors,
    ...catalog.weapons,
    ...catalog.rearModules,
  ].find((part) => part.id === id);
}

function isKnownReview(
  value: string,
): value is keyof typeof reviewConfigurations {
  return Object.hasOwn(reviewConfigurations, value);
}

function cloneConfiguration(
  config: MechConfiguration,
): MechConfiguration {
  return {
    ...config,
    finish: { ...config.finish },
  };
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element is missing: ${selector}`);
  return element;
}
