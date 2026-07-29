import { describe, expect, it } from "vitest";

import { PRODUCT_IDS } from "@showcase/showcase-guide";
import { SHOWCASE_PRODUCTS } from "../src/content/products";
import {
  resolvePreviewHref,
  resolveShowcaseProductUrls,
} from "../src/urls";

describe("showcase content and product URLs", () => {
  it("keeps the approved Chinese copy and skills in their capability groups", () => {
    expect(SHOWCASE_PRODUCTS).toEqual([
      {
        id: "monster-forge", name: "Monster Forge", label: "怪物锻造所", accent: "warm-orange",
        card: { summary: "在同一工作台检查怪物模型、动作和技术叠加。", business: "游戏资产库、角色编辑器、数字资产验收", duration: "预计 2–3 分钟", previewFilename: "monster-forge-review.png", previewAlt: "怪物锻造所的怪物目录与实时模型检查器" },
        details: {
          purpose: "检查和管理 3D 怪物资产。", steps: ["选择一个怪物。", "切换动作、骨骼或碰撞体。", "查看模型来源与技术参数。"], scenarios: ["游戏资产库", "角色编辑器", "数字资产验收"],
          capabilityGroups: [
            { label: "资产与模型", skills: ["build-game-monster-system", "build-hybrid-game-assets"] },
            { label: "审阅与交付", skills: ["build-vesperfall-review-assets", "test-playable-web-games"] },
          ], duration: "预计 2–3 分钟",
        },
      },
      {
        id: "ashfall-arena", name: "Ashfall Arena", label: "灰烬竞技场", accent: "ember-red",
        card: { summary: "直接体验战斗、敌人 AI、成长和反馈组成的动作游戏切片。", business: "游戏原型、互动营销、战斗系统验证", duration: "3–5 分钟了解核心操作", previewFilename: "ashfall-arena-combat.png", previewAlt: "灰烬竞技场中的等距动作战斗与中文状态界面" },
        details: {
          purpose: "展示完整动作游戏系统。", steps: ["学会移动、攻击、闪避和格挡。", "完成普通敌人与精英战。", "选择升级并挑战 Boss。"], scenarios: ["游戏原型", "互动营销", "战斗系统验证"],
          capabilityGroups: [
            { label: "战斗与敌人", skills: ["design-action-combat", "build-threejs-enemy-systems", "tune-enemy-ai"] },
            { label: "反馈与移动", skills: ["create-game-vfx", "build-game-audio-feedback", "build-mobile-threejs-games"] },
          ], duration: "3–5 分钟了解核心操作", boundary: "完整首次挑战继续保留 8–12 分钟真人验证门槛；自动化不代替这个结论。",
        },
      },
      {
        id: "mech-atelier", name: "Mech Atelier", label: "机甲定制工坊", accent: "precision-cyan",
        card: { summary: "更换机甲部件并立即看到 3D 外观与参数变化。", business: "汽车选配、工业设备、家具和定制商品", duration: "预计 3–5 分钟", previewFilename: "mech-atelier-configurator.png", previewAlt: "机甲定制工坊中的三维机甲与部件配置面板" },
        details: {
          purpose: "配置和展示复杂 3D 商品。", steps: ["更换机体、装甲和武器。", "查看负载、火力、防御和兼容性变化。", "使用拆解视图、分享配置或导出海报。"], scenarios: ["汽车选配", "工业设备", "家具", "定制商品销售"],
          capabilityGroups: [
            { label: "资产与配置", skills: ["build-hybrid-game-assets", "optimize-threejs-games"] },
            { label: "验证与交付", skills: ["test-playable-web-games", "ship-web-games"] },
          ], duration: "预计 3–5 分钟", boundary: "页面价格为概念性积分，不代表真实定价、库存、订单、支付或履约。",
        },
      },
    ]);
  });

  it("publishes exactly three terse cards with complete dialog details", () => {
    expect(SHOWCASE_PRODUCTS.map(({ id }) => id)).toEqual(PRODUCT_IDS);
    for (const product of SHOWCASE_PRODUCTS) {
      expect(product.card.summary.length).toBeGreaterThan(0);
      expect(product.card.business.length).toBeGreaterThan(0);
      expect(product.card.duration).toMatch(/分钟/);
      expect(product.card.previewFilename).toMatch(/\.png$/);
      expect(product.card.previewAlt.length).toBeGreaterThan(0);
      expect(product.details.steps).toHaveLength(3);
      expect(product.details.scenarios.length).toBeGreaterThanOrEqual(2);
      expect(product.details.capabilityGroups.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses fixed loopback only in development and same-origin paths in production", () => {
    expect(resolveShowcaseProductUrls({ DEV: true })).toEqual({
      "monster-forge": "http://127.0.0.1:4173/",
      "ashfall-arena": "http://127.0.0.1:4174/",
      "mech-atelier": "http://127.0.0.1:4175/",
    });
    expect(resolveShowcaseProductUrls({ DEV: false })).toEqual({
      "monster-forge": "/monster-forge/",
      "ashfall-arena": "/ashfall-arena/",
      "mech-atelier": "/mech-atelier/",
    });
  });

  it("prefers explicit Vite overrides without rewriting relative paths", () => {
    expect(
      resolveShowcaseProductUrls({
        DEV: false,
        VITE_MONSTER_FORGE_URL: "./monster-forge/",
        VITE_ASHFALL_ARENA_URL: "./ashfall-arena/",
        VITE_MECH_ATELIER_URL: "./mech-atelier/",
      }),
    ).toEqual({
      "monster-forge": "./monster-forge/",
      "ashfall-arena": "./ashfall-arena/",
      "mech-atelier": "./mech-atelier/",
    });
  });

  it("places preview filenames below the Vite base URL", () => {
    expect(resolvePreviewHref("/showcase", "monster-forge-review.png")).toBe(
      "/showcase/previews/monster-forge-review.png",
    );
  });
});
