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

test("twenty four-asset switch cycles retain one live canvas, stable resources, and a running RAF", async ({ page }) => {
  await page.goto("/");
  const cards = ["Ash Warden", "Glass Crawler", "Bell Knight", "Mire Hound"];
  const canvas = page.locator("[data-inspector] canvas");

  await expect(page.getByRole("status")).toContainText("实时模型已就绪");
  // Let one complete replacement sequence settle before taking the resource baseline.
  for (const name of cards) await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForTimeout(80);
  const baseline = await page.evaluate(() => window.__monsterForgeDiagnostics?.());
  expect(baseline?.renderer).toBeDefined();
  expect(baseline?.rootCount).toBe(1);
  expect(baseline?.overlayNodeCount).toBe(1);

  for (let cycle = 0; cycle < 20; cycle += 1) {
    for (const name of cards) await page.getByRole("button", { name: new RegExp(name) }).click();
  }

  const settled = await page.evaluate(() => window.__monsterForgeDiagnostics?.());
  await page.waitForTimeout(80);
  const advanced = await page.evaluate(() => window.__monsterForgeDiagnostics?.());
  await expect(canvas).toHaveCount(1);
  expect(settled?.selectedMonsterId).toBe("mire-hound");
  expect(settled?.rootCount).toBe(1);
  expect(settled?.overlayNodeCount).toBe(1);
  // Renderer bookkeeping can release a disposed geometry on a later frame; it
  // must never grow after the repeated replacement path.
  expect(settled?.renderer?.memory.geometries).toBeLessThanOrEqual(baseline?.renderer?.memory.geometries ?? 0);
  expect(settled?.renderer?.memory.textures).toBe(baseline?.renderer?.memory.textures);
  expect(advanced?.frameCount).toBeGreaterThan(settled?.frameCount ?? 0);
  expect(advanced?.renderer?.pixelRatio).toBe(baseline?.renderer?.pixelRatio);
});

test("reduced motion removes CSS transitions and documents the immediate camera behavior", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("实时模型已就绪");

  const motion = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>("[data-monster-card]")!;
    return {
      matches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      transitionDuration: getComputedStyle(card).transitionDuration,
      diagnostics: window.__monsterForgeDiagnostics?.(),
    };
  });

  expect(motion.matches).toBe(true);
  expect(Number.parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(0.01);
  expect(motion.diagnostics?.cameraEasing).toBe("none");
  expect(motion.diagnostics?.reducedMotion).toBe(true);
});

test("native Tab order covers cards, review controls, overlays, selected state, and live announcements", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("实时模型已就绪");
  const focusTrail: string[] = [];
  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press("Tab");
    focusTrail.push(await page.evaluate(() => {
      const active = document.activeElement as HTMLElement;
      if (active.dataset.monsterCard !== undefined) return `card:${active.querySelector("strong")?.textContent}`;
      if (active.title) return `action:${active.title}`;
      if (active.dataset.pauseAction !== undefined) return "pause";
      if (active.dataset.restartAction !== undefined) return "restart";
      if (active.dataset.overlay) return `overlay:${active.dataset.overlay}`;
      return active.tagName;
    }));
  }
  expect(focusTrail).toEqual([
    "card:灰烬守卫 / Ash Warden",
    "card:琉璃爬行者 / Glass Crawler",
    "card:钟甲骑士 / Bell Knight",
    "card:泥沼猎犬 / Mire Hound",
    "action:Idle",
    "action:Walk",
    "action:Attack",
    "action:Hit",
    "action:Death",
    "pause",
    "restart",
    "overlay:skeleton",
    "overlay:colliders",
    "overlay:sockets",
  ]);
  const focusStyle = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth);
  expect(Number.parseFloat(focusStyle)).toBeGreaterThan(0);

  await page.getByRole("button", { name: /Glass Crawler/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /Glass Crawler/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Glass Crawler");
});

test("WebGL failure keeps catalog and metadata readable", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto("/");

  await expect(page.locator("[data-monster-card]")).toHaveCount(4);
  await expect(page.getByText("3D 预览不可用", { exact: true })).toBeVisible();
  await expect(page.getByText("已交付 PNG").first()).toBeVisible();
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
});
