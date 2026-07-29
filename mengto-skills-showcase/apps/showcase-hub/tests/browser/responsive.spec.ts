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

test("mobile product dialog has one scroll owner and fully visible actions", async ({
  page,
}) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.locator("[data-explain-product='monster-forge']").click();

    const geometry = await page.locator("dialog.product-dialog").evaluate(
      (dialog) => {
        const panel = dialog.querySelector(".product-dialog-panel");
        const actions = [
          ...dialog.querySelectorAll(
            ".product-dialog-actions a, .product-dialog-actions button",
          ),
        ];
        if (!(panel instanceof HTMLElement)) {
          throw new Error("missing product dialog panel");
        }
        const dialogRect = dialog.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        return {
          outerHasSecondScroll: dialog.scrollHeight > dialog.clientHeight,
          panelFitsDialog: panelRect.bottom <= dialogRect.bottom,
          visibleActionHeights: actions.map((action) => {
            const rect = action.getBoundingClientRect();
            return Math.max(
              0,
              Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0),
            );
          }),
        };
      },
    );

    expect(geometry.outerHasSecondScroll).toBe(false);
    expect(geometry.panelFitsDialog).toBe(true);
    expect(
      geometry.visibleActionHeights.every((height) => height >= 44),
    ).toBe(true);
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
