import { expect, test } from "@playwright/test";

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  pageErrors.length = 0;
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Error creating WebGL context")) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
});

test("WebGL failure retains selected asset information and retry remains idempotent", async ({ page }) => {
  await page.goto("/?forceWebglFailure=1");
  await expect(page.locator(".scene-fallback").getByRole("img", { name: /Ash Warden/ })).toBeVisible();
  await expect(page.getByText("3D 预览不可用", { exact: true })).toBeVisible();
  await expect(page.locator(".scene-fallback").getByText(/运行时程序化/)).toBeVisible();
  await expect(page.locator(".scene-fallback").getByText("尺寸", { exact: true })).toBeVisible();
  await expect(page.getByText(/intentionally disabled/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重试 3D 预览" })).toBeVisible();

  await page.getByRole("button", { name: "重试 3D 预览" }).click();
  await page.getByRole("button", { name: "重试 3D 预览" }).click();
  await expect(page.locator("[data-inspector] canvas")).toHaveCount(1);
});
