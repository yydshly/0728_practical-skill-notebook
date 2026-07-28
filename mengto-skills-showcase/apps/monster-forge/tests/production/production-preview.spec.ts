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

test.afterEach(() => {
  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
});

test("built preview renders one selected monster on one advancing canvas", async ({ page }) => {
  await page.goto("/");

  const canvas = page.locator("[data-inspector] canvas");
  await expect(canvas).toHaveCount(1);
  await expect(page.locator("[data-monster-card][aria-pressed='true']")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__monsterForgeDiagnostics?.())).toMatchObject({
    hasRendered: true,
    lastError: null,
    rootCount: 1,
    selectedMonsterId: "ash-warden",
  });
  await expect(page.locator(".scene-fallback")).toBeHidden();

  const before = await page.evaluate(() => window.__monsterForgeDiagnostics?.()?.frameCount ?? 0);
  await expect.poll(
    () => page.evaluate(() => window.__monsterForgeDiagnostics?.()?.frameCount ?? 0),
  ).toBeGreaterThan(before);

  const nonEmptyPixels = await canvas.evaluate((node: HTMLCanvasElement) => {
    const context = node.getContext("webgl2") ?? node.getContext("webgl");
    if (!context) return 0;
    const pixels = new Uint8Array(node.width * node.height * 4);
    context.readPixels(0, 0, node.width, node.height, context.RGBA, context.UNSIGNED_BYTE, pixels);
    let nonEmpty = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if ((pixels[index] ?? 0) + (pixels[index + 1] ?? 0) + (pixels[index + 2] ?? 0) > 0) {
        nonEmpty += 1;
      }
    }
    return nonEmpty;
  });
  expect(nonEmptyPixels).toBeGreaterThan(100);
});
