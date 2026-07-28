import { expect, test } from "@playwright/test";

test.use({ hasTouch: true });

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

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const before = await page.evaluate(() => window.__monsterForgeDiagnostics?.()?.radius);
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.dispatchEvent("[data-inspector] canvas", "pointerdown", { pointerId: 9, pointerType: "touch", clientX: box!.x + box!.width * 0.45, clientY: box!.y + box!.height * 0.45 });
    await page.dispatchEvent("[data-inspector] canvas", "pointermove", { pointerId: 9, pointerType: "touch", clientX: box!.x + box!.width * 0.62, clientY: box!.y + box!.height * 0.52 });
    await page.dispatchEvent("[data-inspector] canvas", "pointerup", { pointerId: 9, pointerType: "touch", clientX: box!.x + box!.width * 0.62, clientY: box!.y + box!.height * 0.52 });
    const after = await page.evaluate(() => window.__monsterForgeDiagnostics?.()?.radius);
    expect(after).toBe(before);
  });
}
