import { expect, test } from "@playwright/test";

test("WebGL failure preserves configuration, summary, sharing, and reset", async ({
  page,
}) => {
  await page.goto("/?reviewControls=1&forceWebglFailure=1");

  await expect(page.getByText("3D 预览不可用")).toBeVisible();
  await expect(page.locator("[data-render-fallback]")).toBeVisible();
  await expect(page.locator("[data-product-canvas]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "复制配置链接" }),
  ).toBeEnabled();

  await page.getByRole("radio", { name: /堡垒运输型/ }).check();
  await expect(page.locator("[data-summary-price]")).toHaveText("216,000 信用点");

  for (const name of ["分解视图", "部件热点", "导出产品海报"]) {
    const control = page.getByRole("button", { name });
    await expect(control).toBeDisabled();
    await expect(control).toHaveAttribute("aria-describedby", /fallback-reason/);
  }

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "恢复默认配置" }).click();
  await expect(page.locator("[data-summary-price]")).toHaveText("184,000 信用点");
});

test("a review-gated failure after renderer construction uses the same usable static fallback", async ({
  page,
}) => {
  await page.goto("/?reviewControls=1&forceSceneFailure=after-renderer");

  await expect(page.getByText("3D 预览不可用")).toBeVisible();
  await expect(page.locator("[data-render-fallback]")).toHaveAttribute(
    "data-render-fallback",
    "active",
  );
  await page.getByRole("radio", { name: /神谕框架/ }).check();
  await expect(page.locator("[data-summary-price]")).toContainText("232,000");
});

test("fallback schematic changes its local visual outline for every chassis", async ({ page }) => {
  await page.goto("/?reviewControls=1&forceWebglFailure=1");
  const expectedOutlines = [
    ["strider-scout", "scout"],
    ["bastion-hauler", "hauler"],
    ["oracle-frame", "oracle"],
  ] as const;

  for (const [chassisId, outline] of expectedOutlines) {
    await page.locator(`input[name="chassisId"][value="${chassisId}"]`).check();
    await expect(page.locator("[data-render-fallback]")).toHaveAttribute(
      "data-fallback-outline",
      outline,
    );
    await expect(
      page.locator(`[data-fallback-outline-visual="${outline}"]`),
    ).toBeVisible();
  }
});

test("review failure boundaries dispose partial live scene work before fallback", async ({ page }) => {
  for (const stage of ["after-renderer", "after-assembly", "after-hotspots"]) {
    await page.goto(`/?reviewControls=1&forceSceneFailure=${stage}`);
    await expect(page.locator("[data-render-fallback]")).toBeVisible();
    await expect(page.locator("[data-product-canvas]")).toHaveCount(0);
    await expect(page.locator("[data-product-stage]")).toHaveAttribute(
      "data-scene-cleanup-raf",
      "0",
    );
    await expect(page.locator("[data-product-stage]")).toHaveAttribute(
      "data-scene-cleanup-listeners",
      "0",
    );
    await expect(page.locator("[data-product-stage]")).toHaveAttribute(
      "data-scene-cleanup-resources",
      "0",
    );
  }
});

test("failure injection is unavailable on an ordinary URL", async ({ page }) => {
  await page.goto("/?forceSceneFailure=after-renderer");
  await expect(page.locator("[data-product-canvas]")).toHaveCount(1);
  await expect(page.locator("[data-render-fallback]")).toHaveCount(0);
});
