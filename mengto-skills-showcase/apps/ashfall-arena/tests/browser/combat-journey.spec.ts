import { expect, test, type Page } from "@playwright/test";

type ReviewEvent = {
  tick: number;
  event: {
    type: string;
    attackId?: string;
    targetId?: string;
    actorId?: string;
    amount?: number;
    guarded?: boolean;
  };
};

const snapshot = (page: Page) =>
  page.evaluate(() => window.__ashfallDiagnostics!.snapshot());

const waitUntilMoveReady = async (page: Page, enemyId: string) => {
  await expect.poll(async () => {
    const enemy = (await snapshot(page)).enemies.find(
      ({ id }) => id === enemyId,
    );
    return enemy
      ? enemy.currentMoveId === null && enemy.cooldownTicks === 0
      : false;
  }, { timeout: 12_000 }).toBe(true);
};

test("wave-one proves readable enemy contact, defenses, player defeat, and objective progress", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await expect(page.locator("[data-game-canvas]")).toHaveCount(1);
  await expect.poll(async () => (await snapshot(page)).enemyModelRootCount)
    .toBe(3);
  expect((await snapshot(page)).enemyFallbackRootCount).toBe(0);

  const canvas = page.locator("[data-game-canvas]");
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.drivePlayerStrike(
      "wave-one-crawler-a",
    ),
  );
  await expect.poll(async () =>
    (await snapshot(page)).recentEvents.some(
      ({ event }: ReviewEvent) =>
        event.type === "defeated" &&
        event.actorId === "wave-one-crawler-a",
    ),
  ).toBe(true);

  await waitUntilMoveReady(page, "wave-one-warden");
  const unguardedAttackId = await page.evaluate(() =>
    window.__ashfallDiagnostics!.queueEnemyMove(
      "wave-one-warden",
      "warden-bolt",
    ),
  );
  await expect(page.locator("[data-enemy-telegraph]")).toBeVisible();
  await expect.poll(async () =>
    (await snapshot(page)).recentEvents.some(
      ({ event }: ReviewEvent) =>
        event.type === "contact" &&
        event.attackId === unguardedAttackId,
    ),
  ).toBe(true);
  const afterContact = await snapshot(page);
  const telegraphEvent = afterContact.recentEvents.find(
    ({ event }: ReviewEvent) =>
      event.type === "enemy-telegraph" &&
      event.attackId === unguardedAttackId,
  )!;
  const contactEvent = afterContact.recentEvents.find(
    ({ event }: ReviewEvent) =>
      event.type === "contact" &&
      event.attackId === unguardedAttackId,
  )!;
  expect(contactEvent.tick - telegraphEvent.tick).toBeGreaterThanOrEqual(21);

  await waitUntilMoveReady(page, "wave-one-warden");
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 81,
    pointerType: "mouse",
    button: 2,
  });
  const guardedAttackId = await page.evaluate(() =>
    window.__ashfallDiagnostics!.queueEnemyMove(
      "wave-one-warden",
      "warden-bolt",
    ),
  );
  await expect.poll(async () =>
    (await snapshot(page)).recentEvents.some(
      ({ event }: ReviewEvent) =>
        event.type === "damage" &&
        event.attackId === undefined &&
        event.targetId === "player" &&
        event.guarded === true,
    ),
  ).toBe(true);
  const guarded = await snapshot(page);
  const guardedContact = guarded.recentEvents.find(
    ({ event }: ReviewEvent) =>
      event.type === "contact" &&
      event.attackId === guardedAttackId,
  );
  expect(guardedContact).toBeDefined();
  expect(
    guarded.recentEvents.some(
      ({ event }: ReviewEvent) =>
        event.type === "damage" &&
        event.targetId === "player" &&
        event.guarded === true &&
        event.amount === 6,
    ),
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

  await expect.poll(async () => (await snapshot(page)).action, {
    timeout: 5_000,
  }).toBe("idle");
  await waitUntilMoveReady(page, "wave-one-crawler-b");
  const healthBeforeDodge = (await snapshot(page)).playerHealth;
  const dodgeAttackId = await page.evaluate(() =>
    window.__ashfallDiagnostics!.drivePlayerDodge(
      "wave-one-crawler-b",
      "crawler-lunge",
    ),
  );
  const afterDodge = await snapshot(page);
  expect(afterDodge.playerHealth).toBe(healthBeforeDodge);
  expect(
    afterDodge.recentEvents.some(
      ({ event }: ReviewEvent) =>
        event.type === "contact" &&
        event.attackId === dodgeAttackId,
    ),
  ).toBe(false);

  for (const enemyId of [
    "wave-one-crawler-b",
    "wave-one-warden",
  ]) {
    await page.evaluate((id) =>
      window.__ashfallDiagnostics!.drivePlayerStrike(id),
    enemyId);
  }
  await expect.poll(async () => (await snapshot(page)).status).toBe("upgrade");
  await expect.poll(async () => (await snapshot(page)).encounterPhase)
    .toBe("elite");
  await expect(page.locator("[data-objective]")).toContainText("升级");

  const final = await snapshot(page);
  expect(final.canvasCount).toBe(1);
  expect(final.playerRootCount).toBe(1);
  expect(final.enemyModelRootCount).toBe(0);
  expect(final.enemyFallbackRootCount).toBe(0);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("shared model failure exposes truthful footprint roots without adding a canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(
    "/?fixture=wave-one&reviewControls=1&forceEnemyModelFailure=glass-crawler",
  );

  await expect.poll(async () => {
    const state = await snapshot(page);
    return {
      models: state.enemyModelRootCount,
      fallbacks: state.enemyFallbackRootCount,
    };
  }).toEqual({ models: 1, fallbacks: 2 });
  expect((await snapshot(page)).canvasCount).toBe(1);
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll("canvas")].length
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});
