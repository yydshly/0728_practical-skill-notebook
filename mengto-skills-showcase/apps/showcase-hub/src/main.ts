import "@showcase/ui-system/tokens.css";
import "./styles.css";

import { SHOWCASE_PRODUCTS } from "./content/products";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Showcase Hub app root is missing");

const productList = document.createElement("ul");
for (const product of SHOWCASE_PRODUCTS) {
  const item = document.createElement("li");
  item.textContent = product.name;
  productList.append(item);
}

const heading = document.createElement("h1");
heading.textContent = "MengTo Skills 产品能力展";
app.replaceChildren(heading, productList);
