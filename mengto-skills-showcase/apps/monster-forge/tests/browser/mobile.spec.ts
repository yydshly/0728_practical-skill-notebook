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

    if (viewport.width !== 390) return;

    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cdp = await page.context().newCDPSession(page);
    const touch = (id: number, x: number, y: number) => ({ id, x, y });
    const sendTouch = (type: "touchStart" | "touchMove" | "touchEnd", touchPoints: ReturnType<typeof touch>[]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    const beforeDrag = await page.evaluate(() => ({ scrollY: window.scrollY, diagnostics: window.__monsterForgeDiagnostics?.() }));
    await sendTouch("touchStart", [touch(1, centerX - 36, centerY - 18)]);
    await sendTouch("touchMove", [touch(1, centerX + 54, centerY + 32)]);
    await sendTouch("touchEnd", []);
    const afterDrag = await page.evaluate(() => ({ scrollY: window.scrollY, diagnostics: window.__monsterForgeDiagnostics?.() }));
    expect(afterDrag.diagnostics?.camera.yaw).not.toBeCloseTo(beforeDrag.diagnostics?.camera.yaw ?? 0, 6);
    expect(afterDrag.diagnostics?.radius).toBeCloseTo(beforeDrag.diagnostics?.radius ?? 0, 6);
    expect(afterDrag.scrollY).toBe(beforeDrag.scrollY);
    expect(afterDrag.diagnostics?.activePointerCount).toBe(0);

    const beforePinch = afterDrag.diagnostics;
    await sendTouch("touchStart", [
      touch(1, centerX - 30, centerY),
      touch(2, centerX + 30, centerY),
    ]);
    await sendTouch("touchMove", [
      touch(1, centerX - 45, centerY),
      touch(2, centerX + 45, centerY),
    ]);
    await sendTouch("touchMove", [
      touch(1, centerX - 90, centerY),
      touch(2, centerX + 90, centerY),
    ]);
    const duringPinch = await page.evaluate(() => ({ scrollY: window.scrollY, diagnostics: window.__monsterForgeDiagnostics?.() }));
    await sendTouch("touchEnd", []);
    const afterPinch = await page.evaluate(() => ({ scrollY: window.scrollY, diagnostics: window.__monsterForgeDiagnostics?.() }));
    expect(duringPinch.diagnostics?.radius).toBeLessThan(beforePinch?.radius ?? 0);
    expect(duringPinch.diagnostics?.radius).toBeGreaterThanOrEqual(1.2);
    expect(duringPinch.diagnostics?.radius).toBeLessThanOrEqual(10);
    expect(duringPinch.scrollY).toBe(beforeDrag.scrollY);
    expect(afterPinch.diagnostics?.activePointerCount).toBe(0);
    expect(afterPinch.diagnostics?.pinchDistance).toBe(0);
  });
}
