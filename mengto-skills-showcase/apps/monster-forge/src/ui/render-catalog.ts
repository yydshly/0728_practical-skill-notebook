import type { MonsterDefinition } from "@showcase/game-assets";

export interface CatalogView { update(selectedId: string): void; }

export function renderCatalog(host: HTMLElement, monsters: readonly MonsterDefinition[], onSelect: (id: string) => void): CatalogView {
  host.innerHTML = `<section class="catalog-panel" aria-labelledby="catalog-title"><div class="panel-heading"><p class="eyebrow">资产目录 / 04</p><h2 id="catalog-title">待审阅的构件</h2><p>每张目录卡都使用已交付的透明 PNG；选择后在右侧查看同一资产的实时程序化模型。</p></div><div class="catalog-grid"></div></section>`;
  const grid = host.querySelector<HTMLElement>(".catalog-grid")!;
  const buttons = new Map<string, HTMLButtonElement>();
  for (const monster of monsters) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.monsterCard = "";
    button.className = "monster-card";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<img src="${monster.previewPath}" alt="${monster.displayName} 透明目录预览" /><span class="card-copy"><strong>${monster.displayName}</strong><span>程序化 Three.js · ${monster.animations.length} 个动作</span><em>已交付 PNG</em></span>`;
    button.addEventListener("click", () => onSelect(monster.id));
    buttons.set(monster.id, button);
    grid.append(button);
  }
  return { update(selectedId) { for (const [id, button] of buttons) { const selected = id === selectedId; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); if (selected) button.setAttribute("aria-current", "true"); else button.removeAttribute("aria-current"); } } };
}
