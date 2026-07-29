import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("first visit explains the asset-review task and can be reopened", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: /怪物锻造所/ });
  await expect(dialog).toContainText("在左侧目录选择另一个怪物");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "这是什么？" }))
    .toBeFocused();
});

test("returns in the same tab with the Monster anchor", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "返回能力展厅" });
  await expect(link).not.toHaveAttribute("target");
  await expect(link).toHaveAttribute("href", /#product-monster-forge$/);
});

test("a blocked localStorage getter does not remove the Monster guide", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toBeVisible();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toBeVisible();
});

test("WebGL fallback retains the guide and hub return", async ({ page }) => {
  await page.goto("/?reviewControls=1&forceWebglFailure=1");
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回能力展厅" }))
    .toHaveAttribute("href", /#product-monster-forge$/);
  await page.getByRole("button", { name: "开始体验" }).click();
  await expect(page.locator(".scene-fallback")).toBeVisible();
  await expect(page.getByRole("button", { name: "这是什么？" })).toBeVisible();
});

test("catalog capture mode stays free of onboarding chrome", async ({
  page,
}) => {
  await page.goto("/?capture=1");
  await expect(page.getByRole("dialog", { name: /怪物锻造所/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "这是什么？" }))
    .toHaveCount(0);
});

test("completes the observable asset-review success", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("button", { name: /Glass Crawler/ }).click();
  await page.getByRole("checkbox", { name: /骨架/ }).check();
  await expect(page.getByRole("button", { name: /Glass Crawler/ }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: /Glass Crawler/ }))
    .toBeVisible();
  await expect(page.locator("[data-overlay-status]")).toContainText("骨架");
  await expect(page.locator("canvas")).toHaveCount(1);
});
