import { expect, test } from "@playwright/test";

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  pageErrors.length = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(consoleErrors, "browser console errors").toEqual([]);
  expect(pageErrors, "uncaught page errors").toEqual([]);
});

test("catalog cards use readable fallbacks and no canvases", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /怪物锻造所/ })).toBeVisible();
  await expect(page.getByText("目录 PNG 尚未交付")).toBeVisible();
  await expect(page.locator("[data-monster-card]")).toHaveCount(4);
  await expect(page.locator("[data-monster-card] canvas")).toHaveCount(0);
  await expect(page.locator("[data-monster-card] img")).toHaveCount(4);
  await expect(page.locator("[data-monster-card]").first()).toContainText("未交付");
});

test("narrow keyboard selection remains focused and does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const glassCrawler = page.getByRole("button", { name: /Glass Crawler/ });

  await glassCrawler.focus();
  await expect(glassCrawler).toBeFocused();
  await glassCrawler.press("Enter");
  await expect(page.getByRole("heading", { name: /Glass Crawler/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
