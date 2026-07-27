import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("keeps all content available without scroll choreography", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect.poll(() => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await expect(page.locator("#cinematic-stage")).toHaveCSS("position", "relative");
  await expect(page.getByRole("heading", { name: "每一次点亮， 都是一次回答。" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "看不见岸时， 方向仍然存在。" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "沿着光， 认识这座岛。" })).toBeVisible();
  await expect(page.locator("#route-archive")).toHaveCSS("pointer-events", "auto");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
