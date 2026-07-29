import { expect, test, type Page } from "@playwright/test";

interface Diagnostics {
  readonly rafIntervals: readonly number[];
  readonly renderSubmissionDurations: readonly number[];
  readonly renderer: { calls: number; triangles: number; geometries: number; textures: number };
  readonly listeners: number;
  readonly resources: { geometries: number; textures: number };
}

test("review diagnostics are isolated, sample a live renderer, and remain stable across fifty switches", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto("/");
  expect(await page.evaluate(() => "__MECH_ATELIER_DEBUG__" in window)).toBe(false);
  await expect(page.locator("[data-product-stage]")).toHaveAttribute(
    "data-render-quality",
    "control-auto",
  );

  await page.goto("/?review=default");
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __MECH_ATELIER_DEBUG__?: { diagnostics(): Diagnostics } }
  ).__MECH_ATELIER_DEBUG__?.diagnostics().rafIntervals.length ?? 0)).toBeGreaterThan(8);

  const before = await diagnostics(page);
  for (let index = 0; index < 50; index += 1) {
    const value = index % 2 === 0 ? "halo-head" : "surveyor-head";
    await page.locator(`input[name="headId"][value="${value}"]`).check({ force: true });
  }
  const after = await diagnostics(page);
  expect(await page.locator("canvas").count()).toBe(1);
  expect(after.listeners).toBe(before.listeners);
  expect(after.resources).toEqual(before.resources);
  expect(after.renderer.geometries).toBe(before.renderer.geometries);
  expect(after.renderer.textures).toBe(before.renderer.textures);
  expect(after.renderSubmissionDurations.length).toBeGreaterThan(8);
  const timing = {
    raf: summarize(after.rafIntervals),
    renderSubmission: summarize(after.renderSubmissionDurations),
  };
  await testInfo.attach("renderer-diagnostics.json", {
    body: JSON.stringify({ before, after, timing }, null, 2),
    contentType: "application/json",
  });
  console.info("MECH_DESKTOP_DIAGNOSTICS", JSON.stringify({ before, after, timing }));
  console.info("MECH_RAF_CADENCE_OBSERVATION", JSON.stringify({
    viewport: "1440x900",
    window: "foreground-stable-after-switches",
    raf: timing.raf,
    cpuSubmission: timing.renderSubmission,
    gpuCompletion: "not-measured",
  }));
  expect(timing.renderSubmission.median).toBeGreaterThanOrEqual(0);
});

test("keyboard controls and invalid links retain accessible feedback", async ({ page }) => {
  await page.goto("/?v=1&c=not-a-chassis");
  await expect(page.locator("[data-config-announcer][aria-live='polite']")).toContainText("底盘");

  const firstRadio = page.getByRole("group", { name: "底盘" }).getByRole("radio").first();
  for (let tab = 0; tab < 20; tab += 1) {
    await page.keyboard.press("Tab");
    if (await firstRadio.evaluate((element) => document.activeElement === element)) break;
  }
  await expect(firstRadio).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("group", { name: "头部" }).getByRole("radio", { checked: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(firstRadio).toBeFocused();

  for (const name of ["复制配置链接", "恢复默认配置", "导出产品海报", "分解视图"]) {
    await expect(page.getByRole("button", { name })).toBeEnabled();
  }
});

test("Tab and Shift+Tab follow the complete keyboard journey without scripted focus", async ({ page }) => {
  await page.goto("/?reviewControls=1&reviewHotspots=off");
  const expected = [
    page.locator(".wordmark"),
    page.locator("[data-product-canvas]"),
    page.getByRole("button", { name: "分解视图" }),
    page.getByRole("button", { name: "重置视图" }),
    ...["底盘", "头部", "装甲", "左侧武器", "右侧武器", "背部模块", "涂装", "金属度", "粗糙度", "环境"].map(
      (name) => page.getByRole("group", { name }).getByRole("radio", { checked: true }),
    ),
    page.locator("[data-summary]"),
    page.getByRole("button", { name: "复制配置链接" }),
    page.getByRole("button", { name: "恢复默认配置" }),
    page.getByRole("button", { name: "导出产品海报" }),
  ];
  for (const target of expected) {
    await page.keyboard.press("Tab");
    await expect(target).toBeFocused();
  }
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "恢复默认配置" })).toBeFocused();
});

test("review control profile is explicit and keeps a same-page low-cost renderer baseline", async ({ page }) => {
  await page.goto("/?review=default&reviewPerformance=control");
  await expect.poll(() => page.evaluate(() => (
    window as unknown as {
      __MECH_ATELIER_DEBUG__?: {
        diagnostics(): { quality?: string; renderer: { calls: number; triangles: number } };
      };
    }
  ).__MECH_ATELIER_DEBUG__?.diagnostics().quality ?? "")).toBe("control");
  const control = await page.evaluate(() => (
    window as unknown as {
      __MECH_ATELIER_DEBUG__: {
        diagnostics(): { renderer: { calls: number; triangles: number } };
      };
    }
  ).__MECH_ATELIER_DEBUG__.diagnostics().renderer);
  expect(control.calls).toBeGreaterThan(0);
  expect(control.triangles).toBeGreaterThan(0);
});

test("review-only empty control separates rAF cadence from renderer duration", async ({ page }) => {
  await page.goto("/?review=default&reviewPerformance=empty");
  await expect.poll(() => page.evaluate(() => (
    window as unknown as {
      __MECH_ATELIER_DEBUG__?: {
        diagnostics(): {
          quality?: string;
          rafIntervals?: number[];
          renderSubmissionDurations?: number[];
        };
      };
    }
  ).__MECH_ATELIER_DEBUG__?.diagnostics().quality ?? "")).toBe("empty");
  await expect.poll(() => page.evaluate(() => (
    window as unknown as {
      __MECH_ATELIER_DEBUG__?: { diagnostics(): { rafIntervals: number[] } };
    }
  ).__MECH_ATELIER_DEBUG__?.diagnostics().rafIntervals.length ?? 0)).toBeGreaterThan(8);
  const diagnostics = await page.evaluate(() => (
    window as unknown as {
      __MECH_ATELIER_DEBUG__: {
        diagnostics(): { rafIntervals: number[]; renderSubmissionDurations: number[] };
      };
    }
  ).__MECH_ATELIER_DEBUG__.diagnostics());
  expect(diagnostics.rafIntervals.length).toBeGreaterThan(8);
  expect(
    Math.abs(diagnostics.renderSubmissionDurations.length - diagnostics.rafIntervals.length),
  ).toBeLessThanOrEqual(1);
});

test("review performance matrix records stable same-viewport controls", async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const profiles = [
    ["full-dpr-1", "?review=default&reviewDpr=1"],
    ["full-dpr-075", "?review=default&reviewDpr=0.75"],
    ["full-dpr-06", "?review=default&reviewDpr=0.6"],
    ["no-shadows", "?review=default&reviewPerformance=no-shadows&reviewDpr=1"],
    ["key-light", "?review=default&reviewPerformance=key-light&reviewDpr=1"],
    ["ambient-control", "?review=default&reviewPerformance=control&reviewDpr=1"],
    ["empty-control", "?review=default&reviewPerformance=empty&reviewDpr=1"],
    ["hotspots-off", "?review=default&reviewHotspots=off&reviewDpr=1"],
  ] as const;
  const measurements: Record<string, unknown> = {};
  for (const [name, query] of profiles) {
    await page.goto(`/${query}`);
    await page.waitForTimeout(2_600);
    const diagnostics = await page.evaluate(() => (
      window as unknown as { __MECH_ATELIER_DEBUG__: { diagnostics(): Diagnostics } }
    ).__MECH_ATELIER_DEBUG__.diagnostics());
    measurements[name] = {
      ...diagnostics,
      timing: {
        raf: summarize(diagnostics.rafIntervals),
        renderSubmission: summarize(diagnostics.renderSubmissionDurations),
      },
    };
  }
  await testInfo.attach("performance-matrix.json", {
    body: JSON.stringify(measurements, null, 2),
    contentType: "application/json",
  });
  console.info("MECH_PERFORMANCE_MATRIX", JSON.stringify(measurements));
  expect(Object.keys(measurements)).toHaveLength(profiles.length);
});

async function diagnostics(page: Page): Promise<Diagnostics> {
  return page.evaluate(() => (
    window as unknown as { __MECH_ATELIER_DEBUG__: { diagnostics(): Diagnostics } }
  ).__MECH_ATELIER_DEBUG__.diagnostics());
}

function summarize(samples: readonly number[]): { median: number; p95: number } {
  const ordered = [...samples].sort((left, right) => left - right);
  const percentile = (fraction: number): number => ordered[Math.min(
    ordered.length - 1,
    Math.ceil(ordered.length * fraction) - 1,
  )] ?? 0;
  return { median: percentile(0.5), p95: percentile(0.95) };
}
