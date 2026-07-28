import { expect, test } from "@playwright/test";

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  pageErrors.length = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(({}, testInfo) => {
  const unexpectedErrors = testInfo.title.includes("WebGL failure")
    ? consoleErrors.filter((message) => !message.includes("Error creating WebGL context"))
    : consoleErrors;
  expect(unexpectedErrors, "browser console errors").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
});

const readCanvasSignature = async (canvas: import("@playwright/test").Locator) =>
  canvas.evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext("webgl2") ?? node.getContext("webgl");
    if (!context) return { uniqueColors: 0, nonTransparent: 0 };
    const pixels = new Uint8Array(node.width * node.height * 4);
    context.readPixels(0, 0, node.width, node.height, context.RGBA, context.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>();
    let nonTransparent = 0;
    const stride = Math.max(4, Math.floor(pixels.length / 12_000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += stride) {
      const alpha = pixels[index + 3] ?? 0;
      if (alpha > 0) nonTransparent += 1;
      colors.add(`${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${alpha}`);
    }
    return { uniqueColors: colors.size, nonTransparent };
  });

test("inspector owns one canvas and selection reuses it", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("[data-inspector] canvas");

  await expect(canvas).toHaveCount(1);
  await expect(page.locator(".scene-fallback")).toBeHidden();
  await expect(page.getByRole("status")).toContainText("实时模型已就绪");
  const initialSignature = await readCanvasSignature(canvas);
  expect(initialSignature.uniqueColors).toBeGreaterThan(8);
  expect(initialSignature.nonTransparent).toBeGreaterThan(100);
  const canvasHandle = await canvas.elementHandle();
  await page.getByRole("button", { name: /Glass Crawler/ }).click();

  await expect(page.getByRole("heading", { name: /Glass Crawler/ })).toBeVisible();
  await expect(canvas).toHaveCount(1);
  expect(await canvas.evaluate((node, initialNode) => node === initialNode, canvasHandle)).toBe(true);
  await expect(page.getByRole("status")).toContainText("Glass Crawler");
  const selectedSignature = await readCanvasSignature(canvas);
  expect(selectedSignature.uniqueColors).toBeGreaterThan(8);
});

test("negative first RAF timestamp still renders without a page error", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
    let firstFrame = true;
    window.requestAnimationFrame = (callback) => nativeRequestAnimationFrame((timestamp) => {
      if (firstFrame) {
        firstFrame = false;
        callback(Math.min(1, timestamp));
      } else callback(timestamp);
    });
  });
  await page.goto("/");
  const canvas = page.locator("[data-inspector] canvas");

  await expect(page.getByRole("status")).toContainText("实时模型已就绪");
  expect((await readCanvasSignature(canvas)).uniqueColors).toBeGreaterThan(8);
});

test("repeated switches retain one root and refit the measured target", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("实时模型已就绪");
  const canvas = page.locator("[data-inspector] canvas");
  const ash = await page.evaluate(() => window.__monsterForgeDiagnostics?.());

  await page.getByRole("button", { name: /Glass Crawler/ }).click();
  const crawler = await page.evaluate(() => window.__monsterForgeDiagnostics?.());
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.7, box!.y + box!.height * 0.4);
  await page.mouse.up();
  await page.mouse.wheel(0, -180);
  const adjustedCrawler = await page.evaluate(() => window.__monsterForgeDiagnostics?.());
  await page.getByRole("button", { name: /Bell Knight/ }).click();
  await page.getByRole("button", { name: /Ash Warden/ }).click();
  const final = await page.evaluate(() => window.__monsterForgeDiagnostics?.());

  expect(ash?.rootCount).toBe(1);
  expect(crawler?.rootCount).toBe(1);
  expect(final?.rootCount).toBe(1);
  expect(crawler?.target.y).not.toBeCloseTo(ash?.target.y ?? 0, 4);
  expect(crawler?.radius).not.toBeCloseTo(ash?.radius ?? 0, 4);
  expect(adjustedCrawler?.target).toEqual(crawler?.target);
  expect(adjustedCrawler?.radius).not.toBeCloseTo(crawler?.radius ?? 0, 4);
  expect(final?.target.y).toBeCloseTo(ash?.target.y ?? 0, 4);
  expect(final?.radius).toBeCloseTo(ash?.radius ?? 0, 4);
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
