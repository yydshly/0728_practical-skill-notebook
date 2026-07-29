import { expect, test } from "./fixtures";

test("opens complete details and restores the invoking button on Escape", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "先看 Monster Forge 说明",
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Monster Forge 产品说明",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("选择一个怪物");
  await expect(dialog).toContainText("build-game-monster-system");
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("focuses only a legal returned product hash without a second scroll", async ({
  page,
}) => {
  await page.goto("/#product-mech-atelier");
  const heading = page.getByRole("heading", { name: /Mech Atelier/ });
  await expect(heading).toBeFocused();
  await expect(heading).toHaveAttribute("tabindex", "-1");
  const y = await page.evaluate(() => scrollY);
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await page.goto("/#how-it-works");
  await expect(page.locator("body")).toBeFocused();
});

test("keeps every product journey in the current tab", async ({ page }) => {
  await page.goto("/");
  for (const link of await page.locator("[data-enter-product]").all()) {
    await expect(link).not.toHaveAttribute("target");
  }
});
