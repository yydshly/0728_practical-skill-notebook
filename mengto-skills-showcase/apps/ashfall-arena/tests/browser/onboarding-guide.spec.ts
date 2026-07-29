import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("first visit gates before the first RAF and input sample", async ({
  page,
}) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  const before = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());

  expect(before.guideGateOpen).toBe(true);
  expect(before.guideOpen).toBe(true);
  expect(before.inputSampleCount).toBe(0);
  expect(before.tick).toBe(0);
});

test("gated frames render a frozen background without advancing simulation or presentation", async ({
  page,
}) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  const before = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());

  await page.waitForTimeout(150);
  const after = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());

  expect(after.tick).toBe(before.tick);
  expect(after.player).toEqual(before.player);
  expect(after.inputSampleCount).toBe(before.inputSampleCount);
  expect(after.presentationSeconds).toEqual(before.presentationSeconds);
  expect(after.audio).toEqual(before.audio);
  expect(after.performance.renderer.submittedFrames)
    .toBeGreaterThan(before.performance.renderer.submittedFrames);
});

test("manual review input cannot bypass an open guide", async ({ page }) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.setManualReviewClock(true));

  await expect(page.evaluate(() =>
    window.__ashfallDiagnostics!.advanceInput({ attackPressed: true }, 1)
  )).rejects.toThrow("guide gate is open");
});

test("Start releases only the guide gate and real input moves and attacks", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  const before = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());

  await page.getByRole("button", { name: "开始体验" }).click();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(180);
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyJ");

  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().player.z
  )).not.toBe(before.player.z);
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().recentEvents.filter(
      ({ event }) =>
        event.type === "action-started" &&
        event.actorId === "player" &&
        event.actionId !== "dodge",
    ).length
  )).toBeGreaterThan(0);

  const after = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());
  expect(after.guideGateOpen).toBe(false);
  expect(after.paused).toBe(before.paused);
});
