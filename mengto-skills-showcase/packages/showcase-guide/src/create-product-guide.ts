import {
  createGuidePreferenceAccess,
  guidePreferenceKey,
} from "./storage";
import type {
  ProductGuideCloseReason,
  ProductGuideConfig,
  ProductGuideController,
} from "./types";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const currentFocusableElements = (root: ParentNode): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    .filter((element) =>
      !element.hidden
      && element.getAttribute("aria-hidden") !== "true"
      && element.getClientRects().length > 0);

const createTextElement = <TagName extends keyof HTMLElementTagNameMap>(
  tagName: TagName,
  text: string,
): HTMLElementTagNameMap[TagName] => {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
};

const appendList = (
  parent: HTMLElement,
  items: readonly string[],
): void => {
  const list = document.createElement("ul");
  for (const item of items) {
    list.append(createTextElement("li", item));
  }
  parent.append(list);
};

export function createProductGuide(
  host: HTMLElement,
  config: ProductGuideConfig,
): ProductGuideController {
  const preferences = createGuidePreferenceAccess();
  const preferenceKey = guidePreferenceKey(
    config.productId,
    config.guideVersion,
  );

  const trigger = createTextElement("button", "这是什么？");
  trigger.type = "button";
  trigger.className = "showcase-guide-trigger";

  const dialog = document.createElement("dialog");
  dialog.className = "showcase-guide-dialog";
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "product-guide-title");
  dialog.setAttribute("aria-describedby", "product-guide-purpose");

  const panel = document.createElement("section");
  panel.className = "showcase-guide-panel";
  const eyebrow = createTextElement("p", "中文体验说明");
  eyebrow.className = "showcase-guide-eyebrow";

  const title = createTextElement("h2", config.title);
  title.id = "product-guide-title";
  const purpose = createTextElement("p", config.purpose);
  purpose.id = "product-guide-purpose";

  const steps = document.createElement("ol");
  steps.dataset.guideSteps = "";
  for (const step of config.steps) {
    steps.append(createTextElement("li", step));
  }

  const capability = document.createElement("section");
  capability.setAttribute("aria-labelledby", "product-guide-capability");
  const capabilityTitle = createTextElement("h3", "能力说明");
  capabilityTitle.id = "product-guide-capability";
  capability.append(
    capabilityTitle,
    createTextElement("p", config.capability),
  );

  const business = document.createElement("section");
  business.setAttribute("aria-labelledby", "product-guide-business");
  const businessTitle = createTextElement("h3", "业务说明");
  businessTitle.id = "product-guide-business";
  business.append(
    businessTitle,
    createTextElement("p", config.business),
  );

  const duration = createTextElement("p", config.duration);
  duration.dataset.guideDuration = "";

  const desktopControls = document.createElement("div");
  desktopControls.className = "showcase-guide-controls";
  desktopControls.dataset.desktopControls = "";
  desktopControls.append(createTextElement("h3", "桌面操作"));
  appendList(desktopControls, config.desktopControls);

  const touchControls = document.createElement("div");
  touchControls.className = "showcase-guide-controls";
  touchControls.dataset.touchControls = "";
  touchControls.append(createTextElement("h3", "触控操作"));
  appendList(touchControls, config.touchControls);

  const optOutLabel = document.createElement("label");
  const hideAutomatically = document.createElement("input");
  hideAutomatically.type = "checkbox";
  optOutLabel.append(
    hideAutomatically,
    document.createTextNode("不再自动显示"),
  );

  const actions = document.createElement("div");
  actions.className = "showcase-guide-actions";
  const startButton = createTextElement("button", "开始体验");
  startButton.type = "button";
  startButton.dataset.guideStart = "";
  const dismissButton = createTextElement("button", "关闭说明");
  dismissButton.type = "button";
  dismissButton.dataset.guideDismiss = "";
  const hubLink = createTextElement("a", "返回能力展厅");
  hubLink.dataset.guideHub = "";
  hubLink.href = config.hubHref;
  actions.append(startButton, dismissButton, hubLink);

  panel.append(
    eyebrow,
    title,
    purpose,
    steps,
    capability,
    business,
    duration,
    desktopControls,
    touchControls,
    optOutLabel,
    actions,
  );
  dialog.append(panel);
  host.append(trigger);
  document.body.append(dialog);

  let backgroundLocked = false;
  let hostInertBeforeOpen = false;
  let scrollXBeforeOpen = 0;
  let scrollYBeforeOpen = 0;
  let rootScrollLockBeforeOpen: string | undefined;
  const guideThemeProperties = [
    "--showcase-guide-accent",
    "--showcase-guide-surface",
    "--showcase-guide-text",
    "--showcase-guide-muted",
  ] as const;

  const syncGuideTheme = (): void => {
    const hostStyle = getComputedStyle(host);
    for (const property of guideThemeProperties) {
      const value = hostStyle.getPropertyValue(property).trim();
      if (value) dialog.style.setProperty(property, value);
    }
  };

  const lockBackground = (): void => {
    if (backgroundLocked) return;
    backgroundLocked = true;
    hostInertBeforeOpen = host.inert;
    scrollXBeforeOpen = window.scrollX;
    scrollYBeforeOpen = window.scrollY;
    rootScrollLockBeforeOpen =
      document.documentElement.dataset.guideScrollLock;
    host.inert = true;
    document.documentElement.dataset.guideScrollLock = "true";
  };

  const unlockBackground = (): void => {
    if (!backgroundLocked) return;
    backgroundLocked = false;
    host.inert = hostInertBeforeOpen;
    if (rootScrollLockBeforeOpen === undefined) {
      delete document.documentElement.dataset.guideScrollLock;
    } else {
      document.documentElement.dataset.guideScrollLock =
        rootScrollLockBeforeOpen;
    }
    window.scrollTo(scrollXBeforeOpen, scrollYBeforeOpen);
  };

  let destroyed = false;
  let opened = false;
  let autoPending = !preferences.readAutoHidden(preferenceKey);
  let returnFocusTo: HTMLElement | null = null;

  const commitOpen = (): boolean => {
    autoPending = false;
    syncGuideTheme();
    const active = document.activeElement;
    returnFocusTo = active instanceof HTMLElement && active !== document.body
      ? active
      : trigger;
    lockBackground();
    dialog.showModal();
    opened = true;
    config.onOpen?.();
    startButton.focus({ preventScroll: true });
    return true;
  };

  const finishClose = (reason: ProductGuideCloseReason): void => {
    if (destroyed || !opened) return;
    if (hideAutomatically.checked) {
      preferences.writeAutoHidden(preferenceKey);
    }
    opened = false;
    dialog.close();
    unlockBackground();
    config.onClose?.(reason);
    returnFocusTo?.focus({ preventScroll: true });
    returnFocusTo = null;
  };

  const controller: ProductGuideController = {
    open() {
      if (destroyed || opened || config.canOpen?.() === false) return false;
      return commitOpen();
    },
    retryAutoOpen() {
      if (destroyed || !autoPending) return "settled";
      if (config.canOpen?.() === false) return "blocked";
      return commitOpen() ? "opened" : "blocked";
    },
    close(reason = "dismiss") {
      finishClose(reason);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      opened = false;
      if (dialog.open) dialog.close();
      unlockBackground();
      removeListeners();
      returnFocusTo = null;
      trigger.remove();
      dialog.remove();
    },
    isOpen: () => opened,
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (!opened) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      controller.close("escape");
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = currentFocusableElements(dialog);
    const first = focusable[0] ?? startButton;
    const last = focusable.at(-1) ?? startButton;
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onTriggerClick = () => {
    controller.open();
  };
  const onStartClick = () => {
    finishClose("start");
  };
  const onDismissClick = () => {
    finishClose("dismiss");
  };
  const onCancel = (event: Event) => {
    event.preventDefault();
    finishClose("escape");
  };
  const onHubClick = () => {
    if (hideAutomatically.checked) {
      preferences.writeAutoHidden(preferenceKey);
    }
  };

  trigger.addEventListener("click", onTriggerClick);
  startButton.addEventListener("click", onStartClick);
  dismissButton.addEventListener("click", onDismissClick);
  dialog.addEventListener("cancel", onCancel);
  hubLink.addEventListener("click", onHubClick);
  document.addEventListener("keydown", onDocumentKeyDown, true);

  const removeListeners = (): void => {
    trigger.removeEventListener("click", onTriggerClick);
    startButton.removeEventListener("click", onStartClick);
    dismissButton.removeEventListener("click", onDismissClick);
    dialog.removeEventListener("cancel", onCancel);
    hubLink.removeEventListener("click", onHubClick);
    document.removeEventListener("keydown", onDocumentKeyDown, true);
  };

  controller.retryAutoOpen();
  return controller;
}
