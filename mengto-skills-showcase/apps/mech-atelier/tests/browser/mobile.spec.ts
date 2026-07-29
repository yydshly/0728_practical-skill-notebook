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

  const configureBox = await configure.boundingBox();
  if (!configureBox) throw new Error("missing configuration touch target");
  await page.touchscreen.tap(
    configureBox.x + configureBox.width / 2,
    configureBox.y + configureBox.height / 2,
  );
  const option = page.getByRole("radio", { name: /深海冷钢/ });
  await option.tap();
  await expect(option).toBeChecked();
});

test("landscape touch keeps the stage and sticky configure action available", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator("[data-product-stage]")).toBeVisible();
  const configure = page.getByRole("button", { name: "开始配置" });
  await expect(configure).toBeVisible();
  const configureBox = await configure.boundingBox();
  if (!configureBox) throw new Error("missing landscape configure target");
  await page.touchscreen.tap(
    configureBox.x + configureBox.width / 2,
    configureBox.y + configureBox.height / 2,
  );
  const sheet = page.getByRole("dialog", { name: "机甲配置面板" });
  await expect(sheet).toBeVisible();
  await page.locator("[data-summary]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-summary-price]")).toBeVisible();
  const share = page.getByRole("button", { name: "复制配置链接" });
  await share.scrollIntoViewIfNeeded();
  await expect(share).toBeVisible();
  await page.getByRole("button", { name: "关闭配置面板" }).click();
  await expect(configure).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("mobile option, palette, segment, and action targets are at least 44px", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始配置" }).click();
  for (const selector of [
    ".option-card",
    ".palette-option",
    ".segment-list label",
    ".sharing-actions button",
    ".panel-close",
  ]) {
    const boxes = await page.locator(selector).evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    expect(boxes.length, selector).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.width, `${selector} width`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${selector} height`).toBeGreaterThanOrEqual(44);
    }
  }
});

test("390px control profile records CPU submission and scheduler samples", async ({
  page,
}) => {
  test.setTimeout(20_000);
  const runs: Array<{ raf: { median: number; p95: number }; render: { median: number; p95: number } }> = [];
  for (let run = 0; run < 2; run += 1) {
    await page.goto("/?review=default&reviewPerformance=control&reviewDpr=0.6");
    await page.waitForTimeout(2_600);
    const samples = await page.evaluate(() => (
      window as unknown as {
        __MECH_ATELIER_DEBUG__: { diagnostics(): { rafIntervals: number[]; renderSubmissionDurations: number[] } };
      }
    ).__MECH_ATELIER_DEBUG__.diagnostics());
    runs.push({
      raf: summarize(samples.rafIntervals),
      render: summarize(samples.renderSubmissionDurations),
    });
  }
  console.info("MECH_MOBILE_DIAGNOSTICS", JSON.stringify(runs));
  for (const run of runs) {
    expect(run.raf.median).toBeGreaterThan(0);
    expect(run.render.median).toBeGreaterThanOrEqual(0);
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
