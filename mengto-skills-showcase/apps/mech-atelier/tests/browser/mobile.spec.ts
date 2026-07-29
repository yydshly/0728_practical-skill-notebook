import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("mobile keeps the product, bottom-sheet options, summary, and controls reachable", async ({
  page,
}) => {
  await page.goto("/");
  const stage = page.locator("[data-product-stage]");
  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute("data-render-quality", "control-0.6");
  expect(await stage.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(389);

  const configure = page.getByRole("button", { name: "开始配置" });
  await configure.click();
  const sheet = page.getByRole("dialog", { name: "机甲配置面板" });
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("group", { name: "底盘" })).toBeVisible();
  await expect(page.locator("[data-summary-price]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(configure).toBeFocused();

  const canvas = page.locator("[data-product-canvas]");
  await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    const before = window.scrollY;
    target.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      pointerId: 1,
      clientX: 180,
      clientY: 200,
    }));
    target.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      pointerId: 1,
      clientX: 250,
      clientY: 220,
    }));
    target.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      pointerId: 1,
      clientX: 250,
      clientY: 220,
    }));
    if (window.scrollY !== before) throw new Error("touch rotation scrolled the page");
  });
});

test("landscape touch keeps the stage and sticky configure action available", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator("[data-product-stage]")).toBeVisible();
  await expect(page.getByRole("button", { name: "开始配置" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("390px control profile records two stable renderer-duration samples", async ({
  page,
}) => {
  test.setTimeout(20_000);
  const runs: Array<{ raf: { median: number; p95: number }; render: { median: number; p95: number } }> = [];
  for (let run = 0; run < 2; run += 1) {
    await page.goto("/?review=default&reviewPerformance=control&reviewDpr=0.6");
    await page.waitForTimeout(2_600);
    const samples = await page.evaluate(() => (
      window as unknown as {
        __MECH_ATELIER_DEBUG__: { diagnostics(): { rafIntervals: number[]; renderDurations: number[] } };
      }
    ).__MECH_ATELIER_DEBUG__.diagnostics());
    runs.push({
      raf: summarize(samples.rafIntervals),
      render: summarize(samples.renderDurations),
    });
  }
  console.info("MECH_MOBILE_DIAGNOSTICS", JSON.stringify(runs));
  for (const run of runs) {
    expect(run.render.median).toBeLessThanOrEqual(24);
    expect(run.render.p95).toBeLessThanOrEqual(34);
  }
});

function summarize(samples: readonly number[]): { median: number; p95: number } {
  const ordered = [...samples].sort((left, right) => left - right);
  const at = (fraction: number) => ordered[Math.min(
    ordered.length - 1,
    Math.ceil(ordered.length * fraction) - 1,
  )] ?? 0;
  return { median: at(0.5), p95: at(0.95) };
}
