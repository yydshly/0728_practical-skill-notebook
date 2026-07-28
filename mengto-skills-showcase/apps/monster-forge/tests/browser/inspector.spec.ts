import { expect, test } from "@playwright/test";

const consoleErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
});

test.afterEach(({}, testInfo) => {
  const unexpectedErrors = testInfo.title.includes("WebGL failure")
    ? consoleErrors.filter((message) => !message.includes("Error creating WebGL context"))
    : consoleErrors;
  expect(unexpectedErrors, "browser console errors").toEqual([]);
});

test("inspector owns one canvas and selection reuses it", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("[data-inspector] canvas");

  await expect(canvas).toHaveCount(1);
  await expect(page.locator(".scene-fallback")).toBeHidden();
  const canvasHandle = await canvas.elementHandle();
  await page.getByRole("button", { name: /Glass Crawler/ }).click();

  await expect(page.getByRole("heading", { name: /Glass Crawler/ })).toBeVisible();
  await expect(canvas).toHaveCount(1);
  expect(await canvas.evaluate((node, initialNode) => node === initialNode, canvasHandle)).toBe(true);
  await expect(page.getByRole("status")).toContainText("Glass Crawler");
});

test("WebGL failure keeps catalog and metadata readable", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto("/");

  await expect(page.locator("[data-monster-card]")).toHaveCount(4);
  await expect(page.getByText("3D 预览不可用", { exact: true })).toBeVisible();
  await expect(page.getByText("目录 PNG 尚未交付")).toBeVisible();
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
});
