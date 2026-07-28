import { expect, test } from "@playwright/test";

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  pageErrors.length = 0;
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Error creating WebGL context")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
});

test("WebGL failure retains selected asset information and retry remains idempotent", async ({ page }) => {
  await page.goto("/?forceWebglFailure=1");
  await expect(page.locator(".scene-fallback").getByRole("img", { name: /Ash Warden/ })).toBeVisible();
  await expect(page.getByText("3D 预览不可用", { exact: true })).toBeVisible();
  await expect(page.locator(".scene-fallback").getByText(/运行时程序化/)).toBeVisible();
  await expect(page.locator(".scene-fallback").getByText("尺寸", { exact: true })).toBeVisible();
  await expect(page.getByText(/intentionally disabled/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重试 3D 预览" })).toBeVisible();

  await page.getByRole("button", { name: "重试 3D 预览" }).click();
  await page.getByRole("button", { name: "重试 3D 预览" }).click();
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
});

test("a real one-shot model creation failure recovers the selected asset through retry", async ({ page }) => {
  await page.goto("/?forceModelFailure=1");
  const fallback = page.locator('[data-fallback-reason="model-creation-failed"]');
  await expect(fallback).toBeVisible();
  await expect(fallback.getByRole("img", { name: /Ash Warden/ })).toHaveAttribute("src", "/asset-catalog/monsters/ash-warden.png");
  await expect(fallback).toContainText("模型创建失败");
  await expect(fallback).toContainText("运行时程序化");
  await expect(fallback).toContainText("1.2 × 2.55 × 0.96");
  await expect(fallback).toContainText("Idle、Walk、Attack、Hit、Death");

  await page.getByRole("button", { name: /Mire Hound/ }).click();
  await expect(fallback.getByRole("img", { name: /Mire Hound/ })).toHaveAttribute("src", "/asset-catalog/monsters/mire-hound.png");
  await expect(fallback).toContainText("1.04 × 1.16 × 2.42");

  await page.locator("[data-retry-preview]").click();
  await expect(page.locator(".scene-fallback")).toBeHidden();
  await expect(page.getByRole("status")).toContainText("Mire Hound");
  await expect(page.getByRole("status")).toContainText("实时模型已就绪");
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__monsterForgeDiagnostics?.())).toMatchObject({
    hasRendered: true,
    rootCount: 1,
    selectedMonsterId: "mire-hound",
  });
  const nonEmptyPixels = await page.locator("[data-inspector] canvas").evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext("webgl2") ?? node.getContext("webgl");
    if (!context) return 0;
    const pixels = new Uint8Array(node.width * node.height * 4);
    context.readPixels(0, 0, node.width, node.height, context.RGBA, context.UNSIGNED_BYTE, pixels);
    let nonEmpty = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0) > 0) nonEmpty += 1;
    }
    return nonEmpty;
  });
  expect(nonEmptyPixels).toBeGreaterThan(100);

  await page.getByRole("button", { name: /Ash Warden/ }).click();
  await page.getByRole("button", { name: /Mire Hound/ }).click();
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
});
