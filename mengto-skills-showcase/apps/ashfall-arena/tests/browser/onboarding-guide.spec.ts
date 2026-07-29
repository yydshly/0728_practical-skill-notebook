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

test("guide gestures stay audio-neutral until the next gameplay gesture", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");

  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).audio.contextCreateCount,
  ).toBe(0);

  await page.getByRole("button", { name: "关闭说明" }).click();
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).audio.contextCreateCount,
  ).toBe(0);

  await page.getByRole("button", { name: "这是什么？" }).click();
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).audio.contextCreateCount,
  ).toBe(0);

  await page.getByRole("button", { name: "关闭说明" }).click();
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).audio.contextCreateCount,
  ).toBe(0);

  await page
    .locator("[data-game-canvas]")
    .click({ position: { x: 320, y: 240 } });
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().audio.contextCreateCount
  )).toBe(1);
});

test("focused gameplay keys unlock audio after Escape closes the guide", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  const before = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot());

  await page.keyboard.press("Escape");
  expect(await page.evaluate(() =>
    document.activeElement?.matches(".showcase-guide-trigger")
  )).toBe(true);
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).audio.contextCreateCount,
  ).toBe(0);

  await page.keyboard.down("KeyW");
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().player.z
  )).not.toBe(before.player.z);
  await page.keyboard.up("KeyW");
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().audio.contextCreateCount
  )).toBe(1);

  await page.keyboard.press("KeyJ");
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).audio.contextCreateCount,
  ).toBe(1);
});

test("Space remains an audio unlock gesture away from the guide", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.keyboard.press("Escape");
  await page.locator("[data-game-canvas]").focus();

  await page.keyboard.press("Space");

  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().audio.contextCreateCount
  )).toBe(1);
});

test("guide navigation keys on the restored trigger stay audio-neutral", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  const trigger = page.getByRole("button", { name: "这是什么？" });
  const dialog = page.locator(".showcase-guide-dialog");
  const contextCreateCount = () => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().audio.contextCreateCount);

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  expect(await contextCreateCount()).toBe(0);

  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  expect(await contextCreateCount()).toBe(0);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Space");
  expect(await contextCreateCount()).toBe(0);
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Tab");
  expect(await contextCreateCount()).toBe(0);
});

test("K and right mouse guard remain held until both sources release", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.getByRole("button", { name: "关闭说明" }).click();
  const canvas = page.locator("[data-game-canvas]");

  await page.keyboard.down("KeyK");
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().input.guardHeld
  )).toBe(true);
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 81,
    pointerType: "mouse",
    button: 2,
  });
  await page.keyboard.up("KeyK");
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).input.guardHeld,
  ).toBe(true);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 81,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).input.guardHeld,
  ).toBe(false);

  await canvas.dispatchEvent("pointerdown", {
    pointerId: 82,
    pointerType: "mouse",
    button: 2,
  });
  await page.keyboard.down("KeyK");
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 82,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).input.guardHeld,
  ).toBe(true);
  await page.keyboard.up("KeyK");
  expect(
    (await page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot())).input.guardHeld,
  ).toBe(false);
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
