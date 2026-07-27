import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 720, height: 450 } });

test("keeps the effective 200 percent zoom viewport free of horizontal overflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "雾屿灯塔" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.evaluate(() => {
    const root = document.querySelector("#cinematic-scroll");
    const top = window.scrollY + root.getBoundingClientRect().top;
    window.scrollTo({ top: top + root.offsetHeight - window.innerHeight, behavior: "auto" });
  });
  await expect.poll(
    () => page.locator("#cinematic-scroll").evaluate((root) => Number(getComputedStyle(root).getPropertyValue("--archive-progress"))),
    { timeout: 15_000 },
  ).toBeGreaterThan(0.99);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
