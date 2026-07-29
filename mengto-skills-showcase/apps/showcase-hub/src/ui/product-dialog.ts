import type { ProductId } from "@showcase/showcase-guide";

import type { ProductContent } from "../content/products";

export interface ProductDialogController {
  open(productId: ProductId, opener: HTMLElement): void;
  close(): void;
  destroy(): void;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function createProductDialog(
  main: HTMLElement,
  products: readonly ProductContent[],
  urls: Readonly<Record<ProductId, string>>,
): ProductDialogController {
  const dialog = document.createElement("dialog");
  dialog.className = "product-dialog";
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "product-dialog-title");
  dialog.setAttribute("aria-describedby", "product-dialog-purpose");
  dialog.innerHTML = `
    <section class="product-dialog-panel">
      <p class="eyebrow">完整产品说明</p>
      <h2 id="product-dialog-title" data-dialog-title></h2>
      <p id="product-dialog-purpose" data-dialog-purpose></p>
      <h3>三步体验任务</h3>
      <ol data-dialog-steps></ol>
      <h3>典型业务场景</h3>
      <ul data-dialog-scenarios></ul>
      <div class="dialog-capabilities" data-dialog-capabilities></div>
      <p class="dialog-duration" data-dialog-duration></p>
      <p class="dialog-boundary" data-dialog-boundary></p>
      <div class="product-dialog-actions">
        <button type="button" data-dialog-close>关闭</button>
        <a data-dialog-enter>进入体验</a>
      </div>
    </section>`;
  document.body.append(dialog);

  const required = <ElementType extends Element>(
    selector: string,
  ): ElementType => {
    const element = dialog.querySelector<ElementType>(selector);
    if (!element) throw new Error(`Product dialog is missing ${selector}`);
    return element;
  };

  const title = required<HTMLElement>("[data-dialog-title]");
  const purpose = required<HTMLElement>("[data-dialog-purpose]");
  const steps = required<HTMLOListElement>("[data-dialog-steps]");
  const scenarios = required<HTMLUListElement>("[data-dialog-scenarios]");
  const capabilities = required<HTMLElement>(
    "[data-dialog-capabilities]",
  );
  const duration = required<HTMLElement>("[data-dialog-duration]");
  const boundary = required<HTMLElement>("[data-dialog-boundary]");
  const closeButton = required<HTMLButtonElement>("[data-dialog-close]");
  const enter = required<HTMLAnchorElement>("[data-dialog-enter]");

  let activeOpener: HTMLElement | null = null;
  let mainInertBeforeOpen = main.inert;

  const getFocusable = () =>
    [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (element) =>
        !element.hidden && element.getAttribute("aria-hidden") !== "true",
    );

  const open = (productId: ProductId, opener: HTMLElement) => {
    if (dialog.open) return;
    const product = products.find(({ id }) => id === productId);
    if (!product) throw new RangeError(`Unknown product: ${productId}`);

    title.textContent = `${product.name} 产品说明`;
    purpose.textContent = product.details.purpose;
    steps.replaceChildren(
      ...product.details.steps.map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      }),
    );
    scenarios.replaceChildren(
      ...product.details.scenarios.map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      }),
    );
    capabilities.replaceChildren(
      ...product.details.capabilityGroups.map((group) => {
        const section = document.createElement("section");
        const heading = document.createElement("h3");
        heading.textContent = group.label;
        const list = document.createElement("p");
        list.dataset.skillList = "";
        list.textContent = group.skills.join(" · ");
        section.append(heading, list);
        return section;
      }),
    );
    duration.textContent = product.details.duration;
    boundary.textContent = product.details.boundary ?? "";
    boundary.hidden = product.details.boundary === undefined;
    enter.href = urls[product.id];
    enter.removeAttribute("target");

    activeOpener = opener;
    mainInertBeforeOpen = main.inert;
    main.inert = true;
    document.documentElement.dataset.productDialogScrollLock = "true";
    dialog.showModal();
    closeButton.focus({ preventScroll: true });
  };

  const close = () => {
    if (!dialog.open) return;
    dialog.close();
    main.inert = mainInertBeforeOpen;
    delete document.documentElement.dataset.productDialogScrollLock;
    activeOpener?.focus({ preventScroll: true });
    activeOpener = null;
  };

  const onCancel = (event: Event) => {
    event.preventDefault();
    close();
  };

  const onDialogKeyDown = (event: KeyboardEvent) => {
    if (!dialog.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = getFocusable();
    const first = focusable[0] ?? closeButton;
    const last = focusable.at(-1) ?? closeButton;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  dialog.addEventListener("cancel", onCancel);
  document.addEventListener("keydown", onDialogKeyDown, true);
  const onCloseButtonClick = () => close();
  closeButton.addEventListener("click", onCloseButtonClick);

  const destroy = () => {
    dialog.removeEventListener("cancel", onCancel);
    document.removeEventListener("keydown", onDialogKeyDown, true);
    closeButton.removeEventListener("click", onCloseButtonClick);
    if (dialog.open) dialog.close();
    main.inert = mainInertBeforeOpen;
    delete document.documentElement.dataset.productDialogScrollLock;
    activeOpener = null;
    dialog.remove();
  };

  return { open, close, destroy };
}
