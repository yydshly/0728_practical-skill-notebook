import {
  createProductGuide,
  type ProductId,
} from "../../src";
import "../../src/styles.css";

const query = new URLSearchParams(location.search);
const productId = (query.get("product") ?? "monster-forge") as ProductId;
const guideVersion = Number(query.get("version") ?? "1");
const key =
  `mengto-showcase:guide:${productId}:v${guideVersion}:auto-hidden`;
if (query.get("hidden") === "1") localStorage.setItem(key, "true");
const rootScrollLock = query.get("rootScrollLock");
if (rootScrollLock !== null) {
  document.documentElement.dataset.guideScrollLock = rootScrollLock;
}
const storageFailure = query.get("storageFailure");
if (storageFailure === "getter") {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("storage getter blocked", "SecurityError");
    },
  });
} else if (storageFailure === "read") {
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function (itemKey) {
    if (itemKey === key) {
      throw new DOMException("storage read blocked", "SecurityError");
    }
    return getItem.call(this, itemKey);
  };
} else if (storageFailure === "write") {
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (itemKey, value) {
    if (itemKey === key) {
      throw new DOMException("storage write blocked", "QuotaExceededError");
    }
    setItem.call(this, itemKey, value);
  };
}

let blocked = query.get("blocked") === "1";
const closeReasons: string[] = [];
const controller = createProductGuide(document.querySelector("main")!, {
  productId,
  guideVersion,
  title: "测试产品导览",
  purpose: "验证真实浏览器导览行为。",
  steps: ["选择内容", "完成操作", "查看结果"],
  capability: "验证导览能力",
  business: "验证业务说明",
  duration: "预计 1 分钟",
  desktopControls: ["Tab 和 Escape"],
  touchControls: ["轻触按钮"],
  hubHref:
    `/tests/fixture/?returned=1#product-${productId}`,
  canOpen: () => !blocked,
  onClose: (reason) => {
    closeReasons.push(reason);
    sessionStorage.setItem("guide-close-reasons", closeReasons.join(","));
    document.querySelector("[data-close-log]")!.textContent =
      closeReasons.join(",");
  },
});
document.querySelector("[data-unblock]")!.addEventListener("click", () => {
  blocked = false;
  document.querySelector("[data-auto-result]")!.textContent =
    controller.retryAutoOpen();
});
document.querySelector("[data-destroy]")!.addEventListener("click", () =>
  controller.destroy());
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const node = document.querySelector("[data-host-escape-count]")!;
  node.textContent = String(Number(node.textContent) + 1);
});
document.querySelector("[data-auto-result]")!.textContent =
  controller.retryAutoOpen();
document.querySelector("[data-close-log]")!.textContent =
  sessionStorage.getItem("guide-close-reasons") ?? "";
