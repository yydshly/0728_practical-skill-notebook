import { expect, test } from "@playwright/test";

async function scrollToProgress(page, progress) {
  await page.evaluate((nextProgress) => {
    const root = document.querySelector("#cinematic-scroll");
    const stage = document.querySelector("#cinematic-stage");
    const top = window.scrollY + root.getBoundingClientRect().top;
    const travel = root.offsetHeight - stage.offsetHeight;
    window.scrollTo(0, top + travel * nextProgress);
  }, progress);
}

test("reveals the signal veil only during the fog-signal story", async ({ page }) => {
  await page.goto("/");
  const veil = page.locator("#signal-veil");

  await expect(veil).toHaveCSS("opacity", "0");
  await scrollToProgress(page, 0.58);
  await expect(veil).not.toHaveCSS("opacity", "0");

  await scrollToProgress(page, 0.82);
  await expect(veil).toHaveCSS("opacity", "0");
});

test("omits the decorative veil when motion is reduced", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  await expect(page.locator("#signal-veil")).toHaveCSS("display", "none");
});

test.describe("compact viewport", () => {
  test.use({ viewport: { width: 720, height: 900 } });

  test("omits the decorative veil", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("#signal-veil")).toHaveCSS("display", "none");
  });
});
