import type { ProductId } from "@showcase/showcase-guide";

import type { ProductContent } from "../content/products";
import { resolvePreviewHref } from "../urls";

export interface ShowcaseView {
  readonly main: HTMLElement;
  readonly explainButtons: readonly HTMLButtonElement[];
}

interface ShowcaseShell {
  readonly main: HTMLElement;
  readonly productGrid: HTMLElement;
}

function createShowcaseShell(
  products: readonly ProductContent[],
): ShowcaseShell {
  const main = document.createElement("main");
  main.innerHTML = `
    <section class="hero" aria-labelledby="showcase-title">
      <p class="eyebrow">MengTo Skills 产品能力展</p>
      <h1 id="showcase-title">这是三款独立、可实际操作的 3D 产品体验</h1>
      <p class="hero-summary">它们不是同一款游戏的三个关卡，而是资产工具、动作游戏和商品配置器。Skill 是指导 Codex 开发与验收的专业工作说明，最终交付仍是普通网页产品。</p>
      <nav class="hero-actions" aria-label="开始参观">
        <a class="primary-action" href="#products">查看三款产品</a>
        <a class="text-action" href="#how-it-works">这些产品是怎样做出来的</a>
      </nav>
    </section>
    <section id="products" class="showcase-section" aria-labelledby="products-title">
      <div class="section-heading">
        <p class="section-number">01 / 产品</p>
        <h2 id="products-title">三款互补产品</h2>
        <p>同一套专业 Skill，如何产出三种完全不同的可运行产品。</p>
      </div>
      <div class="product-grid" data-product-grid></div>
    </section>
    <section id="business-guide" class="showcase-section business-guide" aria-labelledby="business-guide-title">
      <div class="section-heading">
        <p class="section-number">02 / 选择</p>
        <h2 id="business-guide-title">按业务目标选择</h2>
      </div>
      <ul>
        <li><span>管理和验收 3D 资产</span> <strong>→ Monster Forge</strong></li>
        <li><span>制作可玩的互动内容</span> <strong>→ Ashfall Arena</strong></li>
        <li><span>展示和配置复杂商品</span> <strong>→ Mech Atelier</strong></li>
      </ul>
    </section>
    <section id="how-it-works" class="showcase-section workflow" aria-labelledby="how-title">
      <div class="section-heading">
        <p class="section-number">03 / 方法</p>
        <h2 id="how-title">这些产品是怎样做出来的</h2>
      </div>
      <p class="workflow-line">选择业务目标 → Codex 读取相关专业工作说明 → 开发与测试 → 交付普通网页产品</p>
      <p>这些专业工作说明在 Codex 中称为 Skill。Skill 不会被浏览器加载，也不是运行时插件。</p>
      <details>
        <summary>查看英文 Skill 清单</summary>
        <ul data-skill-index></ul>
      </details>
    </section>
    <section id="validation" class="showcase-section validation" aria-labelledby="validation-title">
      <div class="section-heading">
        <p class="section-number">04 / 边界</p>
        <h2 id="validation-title">验证与边界</h2>
      </div>
      <p>已通过自动化验证文案、操作和本地生产路径；真人首次理解、真实设备表现与公开部署仍按证据单独判断。</p>
      <details>
        <summary>查看技术验证边界</summary>
        <p>测试数量、GPU、设备和真人门槛分别记录；自动测试不作为真人可用性证明。</p>
      </details>
    </section>`;

  const productGrid = main.querySelector<HTMLElement>("[data-product-grid]");
  const skillIndex = main.querySelector<HTMLUListElement>(
    "[data-skill-index]",
  );
  if (!productGrid || !skillIndex) {
    throw new Error("Showcase shell is missing a required content region");
  }

  const skillNames = [
    ...new Set(
      products.flatMap((product) =>
        product.details.capabilityGroups.flatMap((group) => group.skills),
      ),
    ),
  ];
  skillIndex.replaceChildren(
    ...skillNames.map((skill) => {
      const item = document.createElement("li");
      item.textContent = skill;
      return item;
    }),
  );

  return { main, productGrid };
}

export function renderShowcase(
  root: HTMLElement,
  products: readonly ProductContent[],
  urls: Readonly<Record<ProductId, string>>,
  assetBaseUrl: string,
): ShowcaseView {
  const { main, productGrid } = createShowcaseShell(products);
  const explainButtons: HTMLButtonElement[] = [];

  for (const product of products) {
    const article = document.createElement("article");
    article.id = `product-${product.id}`;
    article.dataset.productCard = product.id;
    article.dataset.accent = product.accent;

    const preview = document.createElement("div");
    preview.className = "product-preview";

    const image = document.createElement("img");
    image.src = resolvePreviewHref(
      assetBaseUrl,
      product.card.previewFilename,
    );
    image.alt = product.card.previewAlt;
    image.width = 1440;
    image.height = 900;

    const fallback = document.createElement("p");
    fallback.dataset.previewFallback = "";
    fallback.hidden = true;
    fallback.textContent = "预览暂时不可用，仍可查看说明或进入体验。";
    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
        fallback.hidden = false;
        article.dataset.previewState = "failed";
      },
      { once: true },
    );
    preview.append(image, fallback);

    const cardBody = document.createElement("div");
    cardBody.className = "product-card-body";

    const heading = document.createElement("h3");
    heading.tabIndex = -1;
    heading.textContent = `${product.name}｜${product.label}`;

    const summary = document.createElement("p");
    summary.className = "product-summary";
    summary.textContent = product.card.summary;

    const facts = document.createElement("div");
    facts.className = "product-facts";

    const business = document.createElement("p");
    business.innerHTML = "<strong>适合业务</strong> ";
    business.append(document.createTextNode(product.card.business));

    const duration = document.createElement("p");
    duration.innerHTML = "<strong>体验时间</strong> ";
    duration.append(document.createTextNode(product.card.duration));
    facts.append(business, duration);

    const actions = document.createElement("div");
    actions.className = "product-actions";

    const explain = document.createElement("button");
    explain.type = "button";
    explain.dataset.explainProduct = product.id;
    explain.setAttribute("aria-label", `先看 ${product.name} 说明`);
    explain.textContent = "先看说明";
    explainButtons.push(explain);

    const enter = document.createElement("a");
    enter.dataset.enterProduct = product.id;
    enter.href = urls[product.id];
    enter.textContent = "进入体验";
    actions.append(explain, enter);

    cardBody.append(heading, summary, facts, actions);
    article.append(preview, cardBody);
    productGrid.append(article);
  }

  root.replaceChildren(main);
  return { main, explainButtons };
}
