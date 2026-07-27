import { expect, test } from "@playwright/test";

test("keeps the dark stage and semantic content when a critical layer fails", async ({ page }) => {
  await page.route("**/assets/scene/30-lighthouse.webp", (route) => route.abort());
  await page.goto("/");

  await expect.poll(
    () => page.locator("html").evaluate((node) => node.classList.contains("has-asset-failures")),
    { timeout: 15_000 },
  ).toBe(true);
  await expect(page.locator('[data-layer="lighthouse"]')).toHaveAttribute("data-failed", "true");
  await expect(page.locator('[data-layer="lighthouse"]')).toHaveCSS("opacity", "0");
  await expect(page.getByRole("heading", { name: "雾屿灯塔" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
