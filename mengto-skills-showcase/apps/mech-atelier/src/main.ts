import "./styles.css";
import type { MechModuleSlot } from "@showcase/game-assets";
import { calculateSummary } from "./configuration/calculate-summary";
import { catalog, defaultConfiguration } from "./content/catalog";
import {
  hasConfigurationQuery,
  parseConfiguration,
  serializeConfiguration,
  type ParseIssue,
} from "./configuration/serialize-config";
import type {
  MechConfiguration,
  PartDefinition,
} from "./configuration/types";
import { normalizeConfiguration } from "./configuration/validate-config";
import {
  createSavedConfigurationController,
  loadConfiguration,
} from "./persistence/saved-config";
import {
  createConfiguratorScene,
  type ConfiguratorSceneSnapshot,
} from "./scene/create-configurator-scene";
import {
  createProductPoster,
  type ProductPosterMetadata,
} from "./export/create-product-poster";
import { renderHotspots } from "./ui/render-hotspots";
import { renderOptionGroups } from "./ui/render-option-groups";
import { renderSummary } from "./ui/render-summary";

type DebugWindow = typeof window & {
  __MECH_ATELIER_DEBUG__?: {
    snapshot(): ConfiguratorSceneSnapshot;
    nonEmptyPixelCount(): number;
    lastPosterMetadata(): ProductPosterMetadata | null;
  };
};

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
      <section
        class="product-stage"
        data-product-stage
        data-exploded-state="assembled"
        aria-label="机甲三维预览"
      >
        <canvas
          data-product-canvas
          aria-label="可拖拽旋转和缩放的机甲概念模型"
          tabindex="0"
        ></canvas>
        <div class="stage-vignette" aria-hidden="true"></div>
        <div class="part-hotspots" data-part-hotspots aria-label="机甲部件热点"></div>
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
          <button type="button" data-toggle-exploded>
            <span aria-hidden="true">↗</span> 分解视图
          </button>
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
        <div
          class="config-announcer"
          data-config-announcer
          role="status"
          aria-live="polite"
          aria-atomic="true"
        ></div>
        <form class="configuration-form" data-option-groups></form>
        <section class="summary-panel" data-summary aria-label="配置摘要"></section>
        <section class="sharing-panel" aria-label="保存与分享">
          <div>
            <p class="section-kicker">SAVE / SHARE</p>
            <h2>保存与分享</h2>
          </div>
          <div class="sharing-actions">
            <button type="button" data-copy-link>复制配置链接</button>
            <button type="button" data-reset-config>恢复默认配置</button>
            <button type="button" data-export-poster>导出产品海报</button>
          </div>
          <p
            class="share-status"
            data-share-status
            role="status"
            aria-live="polite"
          ></p>
          <p
            class="share-status poster-status"
            data-poster-status
            role="status"
            aria-live="polite"
          ></p>
          <input
            class="share-fallback"
            data-share-fallback
            aria-label="手动复制配置链接"
            type="text"
            readonly
            hidden
          />
        </section>
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
const productStage = requiredElement<HTMLElement>("[data-product-stage]");
const hotspotContainer = requiredElement<HTMLElement>("[data-part-hotspots]");
const toggleExplodedButton = requiredElement<HTMLButtonElement>(
  "[data-toggle-exploded]",
);
const copyLinkButton = requiredElement<HTMLButtonElement>("[data-copy-link]");
const resetConfigurationButton = requiredElement<HTMLButtonElement>(
  "[data-reset-config]",
);
const shareStatus = requiredElement<HTMLElement>("[data-share-status]");
const shareFallback = requiredElement<HTMLInputElement>(
  "[data-share-fallback]",
);
const exportPosterButton = requiredElement<HTMLButtonElement>(
  "[data-export-poster]",
);
const posterStatus = requiredElement<HTMLElement>("[data-poster-status]");

const search = new URLSearchParams(window.location.search);
const hasExplicitConfiguration = hasConfigurationQuery(search);
const reviewId = search.get("review");
const knownReview = reviewId !== null && isKnownReview(reviewId);
const initial = resolveInitialConfiguration(
  hasExplicitConfiguration,
  reviewId,
  knownReview,
);
let configuration = initial.config;
const persistence = createSavedConfigurationController();

const productScene = createConfiguratorScene(canvas, configuration);
const hotspotController = renderHotspots(
  hotspotContainer,
  productScene,
  focusConfigurationSlot,
);
let exploded = false;
let lastPosterMetadata: ProductPosterMetadata | null = null;
renderInterface();
renderAnnouncement(initial.messages);
if (hasExplicitConfiguration) replaceCurrentConfigurationUrl();

const debugWindow = window as DebugWindow;
delete debugWindow.__MECH_ATELIER_DEBUG__;
if (
  (!hasExplicitConfiguration && knownReview) ||
  search.get("reviewControls") === "1"
) {
  debugWindow.__MECH_ATELIER_DEBUG__ = {
    snapshot: () => productScene.snapshot(),
    nonEmptyPixelCount: () => productScene.nonEmptyPixelCount(),
    lastPosterMetadata: () => lastPosterMetadata,
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
toggleExplodedButton.addEventListener("click", () => {
  exploded = !exploded;
  productScene.setExploded(exploded);
  productStage.dataset.explodedState = exploded ? "exploded" : "assembled";
  toggleExplodedButton.innerHTML = exploded
    ? '<span aria-hidden="true">↙</span> 重新组装'
    : '<span aria-hidden="true">↗</span> 分解视图';
});
copyLinkButton.addEventListener("click", async () => {
  const link = canonicalAbsoluteUrl();
  shareFallback.hidden = true;
  shareStatus.textContent = "";

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("当前浏览器未开放剪贴板权限");
    }
    await navigator.clipboard.writeText(link);
    shareStatus.textContent = "配置链接已复制。";
  } catch (error) {
    const detail =
      error instanceof Error && error.message
        ? ` 技术原因：${error.message}。`
        : "";
    shareStatus.textContent =
      `无法自动复制，请手动选择并复制以下链接。${detail}`;
    shareFallback.value = link;
    shareFallback.hidden = false;
    shareFallback.focus();
    shareFallback.select();
  }
});
exportPosterButton.addEventListener("click", async () => {
  exportPosterButton.disabled = true;
  posterStatus.textContent = "正在生成当前配置海报…";
  lastPosterMetadata = null;
  try {
    const chassis = catalog.chassis.find(
      (candidate) => candidate.id === configuration.chassisId,
    );
    const head = findPart(configuration.headId);
    const moduleNames = [
      head?.name ?? configuration.headId,
      findPart(configuration.armorId)?.name ?? configuration.armorId,
      findPart(configuration.leftWeaponId)?.name ??
        configuration.leftWeaponId,
      findPart(configuration.rightWeaponId)?.name ??
        configuration.rightWeaponId,
      findPart(configuration.rearModuleId)?.name ??
        configuration.rearModuleId,
    ];
    const blob = await createProductPoster({
      configuration,
      summary: calculateSummary(configuration, catalog),
      chassisName: chassis?.name ?? configuration.chassisId,
      configurationName: `${chassis?.name ?? configuration.chassisId} · ${head?.name ?? configuration.headId}方案`,
      moduleNames,
      canonicalUrl: canonicalAbsoluteUrl(),
      captureProduct: (width, height) =>
        productScene.captureProduct(width, height),
    });
    lastPosterMetadata = blob.debugMetadata;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = posterFilename(configuration);
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    posterStatus.textContent = "产品海报已导出。";
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    posterStatus.textContent =
      `海报导出失败：${detail} 请保持配置器开启并重试。`;
  } finally {
    exportPosterButton.disabled = false;
  }
});
resetConfigurationButton.addEventListener("click", () => {
  if (!window.confirm("确定恢复默认配置吗？当前选择将被替换。")) return;
  applyConfiguration(cloneConfiguration(defaultConfiguration), {
    announcement: "已恢复默认配置。",
  });
  const saved = persistence.flush();
  if (!saved.ok) {
    shareStatus.textContent = "默认配置已恢复，但本地保存失败。";
  }
});
window.addEventListener(
  "pagehide",
  () => {
    persistence.flush();
    persistence.dispose();
    hotspotController.dispose();
    productScene.dispose();
    delete debugWindow.__MECH_ATELIER_DEBUG__;
  },
  { once: true },
);

function applyConfiguration(
  requested: MechConfiguration,
  options: { announcement?: string } = {},
): void {
  const activeName =
    document.activeElement instanceof HTMLInputElement
      ? document.activeElement.name
      : null;
  const normalized = normalizeConfiguration(requested, catalog);
  configuration = normalized.config;
  productScene.updateConfiguration(configuration);
  const normalizationMessage = describeNormalization(
    requested,
    configuration,
  );
  renderAnnouncement(
    options.announcement
      ? [options.announcement]
      : normalizationMessage
        ? [normalizationMessage]
        : [],
  );
  renderInterface(activeName);
  replaceCurrentConfigurationUrl();
  persistence.schedule(configuration);
}

function focusConfigurationSlot(
  _slot: MechModuleSlot,
  controlsId: string,
): void {
  const fieldset = document.getElementById(controlsId);
  if (!(fieldset instanceof HTMLFieldSetElement)) return;
  fieldset.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "center",
  });
  const firstAvailable = fieldset.querySelector<HTMLInputElement>(
    'input[type="radio"]:not(:disabled)',
  );
  firstAvailable?.focus({ preventScroll: true });
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

function resolveInitialConfiguration(
  hasExplicitConfiguration: boolean,
  reviewId: string | null,
  knownReview: boolean,
): { config: MechConfiguration; messages: string[] } {
  if (hasExplicitConfiguration) {
    const parsed = parseConfiguration(window.location.search);
    return {
      config: cloneConfiguration(parsed.config),
      messages: parsed.issues.map(describeParseIssue),
    };
  }

  if (reviewId !== null) {
    return knownReview
      ? {
          config: cloneConfiguration(
            reviewConfigurations[
              reviewId as keyof typeof reviewConfigurations
            ],
          ),
          messages: [],
        }
      : {
          config: cloneConfiguration(defaultConfiguration),
          messages: [
            `未知审阅状态 ${reviewId}，已恢复默认配置。`,
          ],
        };
  }

  const saved = loadConfiguration();
  if (saved.ok) {
    return {
      config: cloneConfiguration(saved.config),
      messages: [],
    };
  }
  const shouldAnnounce = saved.issues.some(
    (issue) => issue.code !== "missing",
  );
  return {
    config: cloneConfiguration(defaultConfiguration),
    messages: shouldAnnounce
      ? ["本地保存的配置无法读取，已使用默认配置。"]
      : [],
  };
}

function describeParseIssue(issue: ParseIssue): string {
  const label = {
    version: "链接版本",
    chassisId: "底盘",
    headId: "头部",
    armorId: "装甲",
    leftWeaponId: "左侧武器",
    rightWeaponId: "右侧武器",
    rearModuleId: "背部模块",
    "finish.primary": "主色",
    "finish.secondary": "辅色",
    "finish.metalness": "金属度",
    "finish.roughness": "粗糙度",
    "finish.environment": "环境",
    weight: "载重",
  }[issue.field];
  const value =
    "value" in issue && issue.value !== undefined
      ? `“${String(issue.value)}”`
      : "";
  const detail = {
    "missing-version": "缺少版本，",
    "unsupported-version": `${value}不受支持，`,
    "malformed-value": `${value}格式错误，`,
    "duplicate-key": `${value}是重复参数，已采用第一个值并`,
    "unknown-option": `${value}不存在，`,
    "slot-incompatible": `${value}不支持这个挂载位，`,
    "chassis-incompatible": `${value}与当前底盘不兼容，`,
    "invalid-finish": `${value}不是允许的表面参数，`,
    "weight-limit": `${value}超过底盘载重上限，`,
  }[issue.code];
  return `${label}${detail}已规范化为合法配置。`;
}

function renderAnnouncement(messages: readonly string[]): void {
  announcer.replaceChildren(
    ...messages.map((message) => {
      const line = document.createElement("span");
      line.dataset.configIssue = "";
      line.textContent = message;
      return line;
    }),
  );
}

function canonicalAbsoluteUrl(): string {
  return new URL(
    serializeConfiguration(configuration),
    window.location.origin,
  ).href;
}

function posterFilename(config: MechConfiguration): string {
  const safeChassis = config.chassisId.replace(/[^a-z0-9-]/g, "");
  const safeHead = config.headId.replace(/[^a-z0-9-]/g, "");
  return `mech-atelier-${safeChassis}-${safeHead}.png`;
}

function replaceCurrentConfigurationUrl(): void {
  const url = new URL(window.location.href);
  url.search = serializeConfiguration(configuration);
  window.history.replaceState(window.history.state, "", url);
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
