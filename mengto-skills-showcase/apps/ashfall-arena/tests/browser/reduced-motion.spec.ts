import { expect, test, type Page } from "@playwright/test";

type FeedbackDiagnostics = {
  effects: {
    totalActive: number;
    damageFlashActive: boolean;
    pools: {
      hitSparks: { active: number; capacity: number };
      guardArcs: { active: number; capacity: number };
      dodgeTrails: { active: number; capacity: number };
      projectileTraces: { active: number; capacity: number };
      bossShockwaves: { active: number; capacity: number };
    };
  };
  audio: {
    unlocked: boolean;
    muted: boolean;
    voiceCount: number;
    playedCueCount: number;
  };
  camera: {
    reducedMotion: boolean;
    shakeAmplitude: number;
  };
};

const diagnostics = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __review: { getDiagnostics(): FeedbackDiagnostics };
      }
    ).__review.getDiagnostics(),
  );

const triggerHit = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __review: { triggerPlayerHit(): void };
      }
    ).__review.triggerPlayerHit(),
  );

test("review controls stay private without the explicit query flag", async ({
  page,
}) => {
  await page.goto("/?fixture=boss");
  expect(
    await page.evaluate(
      () => (window as unknown as { __review?: unknown }).__review,
    ),
  ).toBeUndefined();
});

test("review enemy defeat uses the authoritative damage and reward path once", async ({
  page,
}) => {
  await page.goto("/?fixture=wave-one&reviewControls=1");
  const enemyId = await page.evaluate(() => {
    const review = (
      window as unknown as {
        __review: {
          getSerializableState(): {
            enemies: Record<string, { health: number }>;
          };
        };
      }
    ).__review;
    return Object.keys(review.getSerializableState().enemies).sort()[0]!;
  });

  await page.evaluate((id) => {
    const review = (
      window as unknown as {
        __review: { defeatEnemy(enemyId: string): void };
      }
    ).__review;
    review.defeatEnemy(id);
    review.defeatEnemy(id);
  }, enemyId);

  const result = await page.evaluate((id) => {
    const review = (
      window as unknown as {
        __review: {
          getSerializableState(): {
            enemies: Record<string, { health: number }>;
            rewardedEnemyIds: string[];
          };
          getDiagnostics(): {
            recentEvents: Array<{ event: { type: string; actorId?: string } }>;
          };
        };
      }
    ).__review;
    const state = review.getSerializableState();
    return {
      health: state.enemies[id]!.health,
      rewarded: state.rewardedEnemyIds.filter((candidate) => candidate === id),
      defeatCount: review
        .getDiagnostics()
        .recentEvents.filter(
          ({ event }) => event.type === "defeated" && event.actorId === id,
        ).length,
    };
  }, enemyId);
  expect(result).toEqual({ health: 0, rewarded: [enemyId], defeatCount: 1 });
});

test("reduced motion keeps damage flash and ring meaning without shake", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=boss&reviewControls=1");

  await triggerHit(page);
  await expect(page.locator("[data-damage-flash]")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-camera-shake",
    "off",
  );
  await expect(page.locator("[data-feedback-caption]")).toContainText("受击");

  const reduced = await diagnostics(page);
  expect(reduced.camera).toMatchObject({
    reducedMotion: true,
    shakeAmplitude: 0,
  });
});

test("normal motion bounds shake and rapid effects stay inside every pool", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?fixture=boss&reviewControls=1");

  await triggerHit(page);
  await expect(page.locator("html")).toHaveAttribute(
    "data-camera-shake",
    "on",
  );
  await expect
    .poll(async () => (await diagnostics(page)).camera.shakeAmplitude)
    .toBeGreaterThan(0);
  expect((await diagnostics(page)).camera.shakeAmplitude).toBeLessThanOrEqual(
    0.2,
  );

  await page.evaluate(() => {
    const review = (
      window as unknown as {
        __review: { triggerPlayerHit(): void };
      }
    ).__review;
    for (let index = 0; index < 100; index += 1) {
      review.triggerPlayerHit();
    }
  });
  const saturated = await diagnostics(page);
  for (const pool of Object.values(saturated.effects.pools)) {
    expect(pool.active).toBeLessThanOrEqual(pool.capacity);
  }
  expect(
    Object.fromEntries(
      Object.entries(saturated.effects.pools).map(([name, pool]) => [
        name,
        pool.capacity,
      ]),
    ),
  ).toEqual({
    hitSparks: 12,
    guardArcs: 8,
    dodgeTrails: 6,
    projectileTraces: 12,
    bossShockwaves: 4,
  });
  expect(saturated.effects.pools.hitSparks.active).toBeGreaterThan(0);
  expect(saturated.effects.pools.hitSparks.capacity).toBe(12);
});

test("pause freezes effect clocks and resume releases the pool", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=fresh&reviewControls=1&safeTraining=1",
  );
  await triggerHit(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeVisible();
  const pausedActive = (await diagnostics(page)).effects.pools.hitSparks.active;
  expect(pausedActive).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect((await diagnostics(page)).effects.pools.hitSparks.active).toBe(
    pausedActive,
  );

  await page.getByRole("button", { name: "继续战斗" }).click();
  await expect
    .poll(async () =>
      (await diagnostics(page)).effects.pools.hitSparks.active,
    )
    .toBe(0);
});

test("audio unlocks only after a gesture and mute preserves visual feedback", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=fresh&reviewControls=1&safeTraining=1",
  );

  expect((await diagnostics(page)).audio.unlocked).toBe(false);
  await triggerHit(page);
  expect((await diagnostics(page)).audio.unlocked).toBe(false);

  await page.locator("[data-game-canvas]").click({ position: { x: 80, y: 80 } });
  await expect
    .poll(async () => (await diagnostics(page)).audio.unlocked)
    .toBe(true);
  await expect
    .poll(async () =>
      page.evaluate(() =>
        (
          window as unknown as {
            __review: {
              getSerializableState(): { player: { action: string } };
            };
          }
        ).__review.getSerializableState().player.action,
      ),
    )
    .toBe("idle");
  const cuesBeforeAction = (await diagnostics(page)).audio.playedCueCount;
  await page.locator("[data-game-canvas]").click({ position: { x: 90, y: 90 } });
  await expect
    .poll(async () => (await diagnostics(page)).audio.playedCueCount)
    .toBeGreaterThan(cuesBeforeAction);

  await page.getByRole("checkbox", { name: "静音所有声音" }).check();
  await triggerHit(page);
  await expect(page.locator("[data-damage-flash]")).toBeVisible();
  await expect(page.locator("[data-feedback-caption]")).toContainText("受击");
  await expect
    .poll(async () => (await diagnostics(page)).audio.voiceCount)
    .toBe(0);

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "静音所有声音" })).toBeChecked();
  expect((await diagnostics(page)).audio.unlocked).toBe(false);
});
