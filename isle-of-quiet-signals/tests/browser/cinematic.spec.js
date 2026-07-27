import { expect, test } from "@playwright/test";

async function scrollToProgress(page, progress) {
  await page.evaluate((target) => {
    const root = document.querySelector("#cinematic-scroll");
    const top = window.scrollY + root.getBoundingClientRect().top;
    const travel = root.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * target, behavior: "auto" });
  }, progress);
  await page.waitForTimeout(650);
}

async function variables(page) {
  return page.locator("#cinematic-scroll").evaluate((root) => {
    const style = getComputedStyle(root);
    return {
      intro: Number(style.getPropertyValue("--intro-opacity")),
      storyA: Number(style.getPropertyValue("--story-a-opacity")),
      storyB: Number(style.getPropertyValue("--story-b-opacity")),
      focus: Number(style.getPropertyValue("--focus")),
      archive: Number(style.getPropertyValue("--archive-progress")),
    };
  });
}

test("reaches every cinematic moment and restores state on reverse scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "雾屿灯塔" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await scrollToProgress(page, 0.18);
  await expect.poll(async () => (await variables(page)).intro).toBeLessThan(0.02);
  await expect.poll(async () => (await variables(page)).storyA).toBe(0);

  await scrollToProgress(page, 0.27);
  await expect.poll(async () => (await variables(page)).storyA).toBeGreaterThan(0.95);

  await scrollToProgress(page, 0.44);
  await expect.poll(async () => (await variables(page)).storyA).toBeLessThan(0.02);

  await scrollToProgress(page, 0.58);
  await expect.poll(async () => (await variables(page)).storyB).toBeGreaterThan(0.95);
  await expect.poll(async () => (await variables(page)).focus).toBeGreaterThan(0.95);

  await scrollToProgress(page, 0.74);
  await expect.poll(async () => (await variables(page)).focus).toBeLessThan(0.02);

  await scrollToProgress(page, 0.9);
  await expect.poll(async () => (await variables(page)).archive).toBeGreaterThan(0.75);
  await expect(page.locator("#route-archive")).toHaveCSS("pointer-events", "auto");

  await scrollToProgress(page, 1);
  await expect.poll(async () => (await variables(page)).archive).toBe(1);

  await scrollToProgress(page, 0.58);
  await expect.poll(async () => (await variables(page)).storyB).toBeGreaterThan(0.95);
  await expect(page.locator("#route-archive")).toHaveCSS("pointer-events", "none");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
