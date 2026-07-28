import type { MonsterDefinition } from "@showcase/game-assets";

const fallbackImage = (name: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360"><rect width="480" height="360" fill="#201f22"/><path d="M100 238 180 122l52 74 58-100 92 142H100Z" fill="#5e5246"/><text x="240" y="302" text-anchor="middle" fill="#d8cec1" font-family="sans-serif" font-size="20">${name} · PNG 待交付</text></svg>`)}`;

export interface CatalogView { update(selectedId: string): void; }

export function renderCatalog(host: HTMLElement, monsters: readonly MonsterDefinition[], onSelect: (id: string) => void): CatalogView {
  host.innerHTML = `<section class="catalog-panel" aria-labelledby="catalog-title"><div class="panel-heading"><p class="eyebrow">资产目录 / 04</p><h2 id="catalog-title">待审阅的构件</h2><p>目录 PNG 尚未交付；下列图像是明确标注的占位回退，不代表已交付媒体。</p></div><div class="catalog-grid"></div></section>`;
  const grid = host.querySelector<HTMLElement>(".catalog-grid")!;
  const buttons = new Map<string, HTMLButtonElement>();
  for (const monster of monsters) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.monsterCard = "";
    button.className = "monster-card";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<img src="${fallbackImage(monster.displayName.split(" ")[0] ?? monster.displayName)}" alt="${monster.displayName}：目录 PNG 尚未交付的占位图" /><span class="card-copy"><strong>${monster.displayName}</strong><span>程序化 Three.js · ${monster.animations.length} 个动作</span><em>PNG 未交付</em></span>`;
    button.addEventListener("click", () => onSelect(monster.id));
    buttons.set(monster.id, button);
    grid.append(button);
  }
  return { update(selectedId) { for (const [id, button] of buttons) { const selected = id === selectedId; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); if (selected) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current"); } } };
}
