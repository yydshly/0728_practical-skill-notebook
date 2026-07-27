import { expect, test } from "@playwright/test";

async function revealArchive(page) {
  await page.goto("/");
  await page.evaluate(() => {
    const root = document.querySelector("#cinematic-scroll");
    const top = window.scrollY + root.getBoundingClientRect().top;
    window.scrollTo({ top: top + root.offsetHeight - window.innerHeight, behavior: "auto" });
  });
  await expect.poll(
    () => page.locator("#cinematic-scroll").evaluate((root) => Number(getComputedStyle(root).getPropertyValue("--archive-progress"))),
    { timeout: 15_000 },
  ).toBeGreaterThan(0.99);
}

test("supports button, keyboard, detail, and drag route navigation", async ({ page }) => {
  await revealArchive(page);

  const archive = page.locator("#route-archive");
  const status = page.locator("#route-status");
  const next = page.getByRole("button", { name: "查看下一条航线" });
  const detail = page.getByRole("button", { name: "了解「潮汐花园」" });
  await detail.focus();
  await page.keyboard.press("Enter");
  await expect(detail).toHaveAttribute("aria-expanded", "true");

  await expect(next).toHaveCount(1);
  await next.click();
  await expect(status).toHaveText("路线 2，共 4 条：回声湾");

  await archive.focus();
  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveText("路线 3，共 4 条：守灯人居所");
  await page.keyboard.press("Home");
  await expect(status).toHaveText("路线 1，共 4 条：潮汐花园");

  const card = page.locator(".route-card").first();
  const box = await card.boundingBox();
  if (!box) throw new Error("Route card was not visible for drag verification");
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5, { steps: 4 });
  await page.mouse.up();
  await expect(status).toHaveText("路线 2，共 4 条：回声湾");
});
