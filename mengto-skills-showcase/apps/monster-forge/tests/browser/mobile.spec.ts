import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`mobile workspace is operable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const canvas = page.locator("[data-inspector] canvas");
    await expect(canvas).toBeVisible();
    const card = page.getByRole("button", { name: /Glass Crawler/ });
    const retry = page.getByRole("button", { name: /重新播放|暂停动画|继续播放/ }).first();
    expect(await card.evaluate((node) => Math.min(node.getBoundingClientRect().width, node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    expect(await retry.evaluate((node) => Math.min(node.getBoundingClientRect().width, node.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    expect(await canvas.evaluate((node) => getComputedStyle(node).touchAction)).toContain("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
