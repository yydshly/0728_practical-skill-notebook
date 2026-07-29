import { expect, test } from "@playwright/test";

test("390px and 320px keep all actions operable without horizontal scroll", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    for (const target of await page.locator("a, button, input").all()) {
      if (!(await target.isVisible())) continue;
      const box = await target.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
  }
});

test("a 720px reflow proxy remains operable without claiming browser zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 720, height: 900 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "先看 Ashfall Arena 说明" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("failed preview requests preserve copy and both card actions", async ({
  page,
}) => {
  await page.route("**/previews/*.png", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/");
  await expect(page.locator("[data-preview-fallback]:visible")).toHaveCount(3);
  await expect(page.locator("[data-product-card] button")).toHaveCount(3);
  await expect(page.locator("[data-enter-product]")).toHaveCount(3);
});

test("reduced motion removes nonessential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .locator("[data-product-card]")
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(["0s", "0.01ms"]).toContain(duration);
});
