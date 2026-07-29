import { expect, test } from "@playwright/test";

test("WebGL failure preserves configuration, summary, sharing, and reset", async ({
  page,
}) => {
  await page.goto("/?forceWebglFailure=1");

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

test("a renderer construction exception uses the same usable static fallback", async ({
  page,
}) => {
  await page.goto("/?forceWebglFailure=renderer");

  await expect(page.getByText("3D 预览不可用")).toBeVisible();
  await expect(page.locator("[data-render-fallback]")).toHaveAttribute(
    "data-render-fallback",
    "active",
  );
  await page.getByRole("radio", { name: /神谕框架/ }).check();
  await expect(page.locator("[data-summary-price]")).toContainText("232,000");
});
