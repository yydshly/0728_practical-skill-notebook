import { expect, test } from "./fixtures";

test("the first screen explains the three-product relationship", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("MengTo Skills 产品能力展", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "这是三款独立、可实际操作的 3D 产品体验",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "它们不是同一款游戏的三个关卡，而是资产工具、动作游戏和商品配置器。Skill 是指导 Codex 开发与验收的专业工作说明，最终交付仍是普通网页产品。",
    ),
  ).toBeVisible();
});

test("keeps three default cards scan-friendly and explains the four-step workflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-product-card]")).toHaveCount(3);
  await expect(page.locator("main > section")).toHaveCount(5);
  await expect(page.locator("[data-product-card] ol")).toHaveCount(0);
  await expect(
    page.locator("[data-product-card] [data-skill-list]"),
  ).toHaveCount(0);
  await expect(page.locator("#how-it-works")).toContainText(
    "选择业务目标 → Codex 读取相关专业工作说明 → 开发与测试 → 交付普通网页产品",
  );
  await expect(page.locator("#how-it-works")).toContainText(
    "这些专业工作说明在 Codex 中称为 Skill",
  );
  await expect(page.locator("#how-it-works")).toContainText(
    "Skill 不会被浏览器加载，也不是运行时插件",
  );
  await expect(page.locator("#business-guide")).toContainText(
    "管理和验收 3D 资产 → Monster Forge",
  );
  await expect(page.locator("#business-guide")).toContainText(
    "制作可玩的互动内容 → Ashfall Arena",
  );
  await expect(page.locator("#business-guide")).toContainText(
    "展示和配置复杂商品 → Mech Atelier",
  );
  await expect(page.locator("#validation")).toContainText(
    "已通过自动化验证文案、操作和本地生产路径；真人首次理解、真实设备表现与公开部署仍按证据单独判断",
  );
  await expect(page.locator("canvas, svg")).toHaveCount(0);
});
