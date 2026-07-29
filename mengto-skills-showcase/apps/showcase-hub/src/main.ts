import "@showcase/ui-system/tokens.css";
import "./styles.css";

import type { ProductId } from "@showcase/showcase-guide";
import { SHOWCASE_PRODUCTS } from "./content/products";
import { focusProductAnchor } from "./focus-product-anchor";
import { createProductDialog } from "./ui/product-dialog";
import { renderShowcase } from "./ui/render-showcase";
import { resolveShowcaseProductUrls } from "./urls";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Showcase Hub app root is missing");

const urls = resolveShowcaseProductUrls(import.meta.env);
const view = renderShowcase(
  app,
  SHOWCASE_PRODUCTS,
  urls,
  import.meta.env.BASE_URL,
);
const productDialog = createProductDialog(
  view.main,
  SHOWCASE_PRODUCTS,
  urls,
);

for (const button of view.explainButtons) {
  button.addEventListener("click", () => {
    const productId = button.dataset.explainProduct as ProductId;
    productDialog.open(productId, button);
  });
}

focusProductAnchor(view.main, window.location.hash);
window.addEventListener("pagehide", () => productDialog.destroy(), {
  once: true,
});
