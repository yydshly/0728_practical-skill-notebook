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
  await page.goto("/");
  await expect(page.locator(".live-status")).toContainText("实时模型已就绪");
});

test.afterEach(() => {
  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
});

test("reviewer can play, pause, restart, and inspect overlays", async ({ page }) => {
  const canvas = page.locator("[data-inspector] canvas");
  const pixelsBefore = await canvas.screenshot();

  await page.getByRole("button", { name: "攻击" }).click();
  await expect(page.locator("[data-action-status]")).toContainText("攻击 / Attack");
  await page.getByRole("button", { name: "暂停动画" }).click();
  await expect(page.locator("[data-action-status]")).toContainText("已暂停");
  await page.getByRole("button", { name: "继续播放" }).click();
  await expect(page.locator("[data-action-status]")).toContainText("播放中");
  await page.getByLabel("显示挂点").check();
  await expect(page.locator("[data-overlay-status]")).toContainText("挂点已显示");
  const pixelsAfter = await canvas.screenshot();
  expect(pixelsAfter).not.toEqual(pixelsBefore);
  await page.getByRole("button", { name: "重新播放" }).click();
  await expect(page.locator("[data-action-status]")).toContainText("已重新播放");
});

test("technical overlays are independent, labelled, and keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const skeleton = page.getByLabel("显示骨架");
  const colliders = page.getByLabel("显示碰撞体");
  const sockets = page.getByLabel("显示挂点");

  await skeleton.focus();
  await expect(skeleton).toBeFocused();
  await skeleton.press("Space");
  await expect(skeleton).toBeChecked();
  await expect(page.locator("[data-overlay-status]")).toContainText("骨架已显示");
  await expect(colliders).not.toBeChecked();
  await sockets.check();
  await expect(sockets).toBeChecked();
  await expect(skeleton).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
