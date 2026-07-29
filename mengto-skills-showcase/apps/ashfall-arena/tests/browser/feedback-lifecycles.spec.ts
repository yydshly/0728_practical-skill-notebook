import { expect, test, type Page } from "@playwright/test";

type LifecycleDiagnostics = {
  effects: {
    reducedMotion: boolean;
    particleDisplacement: boolean;
    pools: {
      bossShockwaves: { active: number; capacity: number };
    };
  };
  audio: {
    blocked: boolean;
    unlocked: boolean;
    contextCreateCount: number;
    closeCount: number;
    lastCue: string | null;
    cueCounts: Record<string, number>;
  };
  recentEvents: Array<{
    tick: number;
    event: {
      type: string;
      attackId?: string;
      moveId?: string;
      actionId?: string;
      targetId?: string;
      result?: string;
      reason?: string;
    };
  }>;
};

const diagnostics = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __review: { getDiagnostics(): LifecycleDiagnostics };
      }
    ).__review.getDiagnostics(),
  );

for (const reducedMotion of [false, true]) {
  test(`real sovereign shockwave presents one bounded active ring with reducedMotion=${reducedMotion}`, async ({
    page,
  }) => {
    await page.emulateMedia({
      reducedMotion: reducedMotion ? "reduce" : "no-preference",
    });
    await page.goto("/?fixture=boss&reviewControls=1&manualEnemyAi=1");
    const attackId = await page.evaluate(() =>
      window.__ashfallDiagnostics!.queueEnemyMove(
        "boss-sovereign",
        "sovereign-shockwave",
      ),
    );

    let proof: LifecycleDiagnostics | null = null;
    await expect.poll(async () => {
      const current = await diagnostics(page);
      const activeEvents = current.recentEvents.filter(
        ({ event }) =>
          event.type === "enemy-move-active" &&
          event.attackId === attackId &&
          event.moveId === "sovereign-shockwave",
      );
      if (
        activeEvents.length === 1 &&
        current.effects.pools.bossShockwaves.active > 0
      ) {
        proof = current;
      }
      return activeEvents.length === 1 &&
        current.effects.pools.bossShockwaves.active > 0;
    }, { timeout: 8_000 }).toBe(true);

    expect(proof).not.toBeNull();
    expect(proof!.effects).toMatchObject({
      reducedMotion,
      particleDisplacement: !reducedMotion,
    });
    expect(proof!.effects.pools.bossShockwaves.active).toBeGreaterThan(0);
    expect(proof!.effects.pools.bossShockwaves.active).toBeLessThanOrEqual(4);
    expect(proof!.effects.pools.bossShockwaves.capacity).toBe(4);

    await page.waitForTimeout(1_000);
    expect(
      (await diagnostics(page)).recentEvents.filter(
        ({ event }) =>
          event.type === "enemy-move-active" &&
          event.attackId === attackId,
      ),
    ).toHaveLength(1);
  });
}

test("recovery dodge after melee contact presents hit without an interrupted cue", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  const canvas = page.locator("[data-game-canvas]");
  await page.getByRole("heading", { name: "灰烬竞技场" }).click();
  await expect.poll(async () => (await diagnostics(page)).audio.unlocked)
    .toBe(true);
  const before = (await diagnostics(page)).audio.cueCounts;
  await canvas.click({ position: { x: 80, y: 80 } });

  let attackId: string | null = null;
  await expect.poll(async () => {
    const started = (await diagnostics(page)).recentEvents.find(
      ({ event }) =>
        event.type === "action-started" &&
        event.actionId === "oathblade-light-1",
    );
    attackId = started?.event.attackId ?? null;
    return attackId;
  }).not.toBeNull();
  await expect.poll(async () =>
    (await diagnostics(page)).recentEvents.some(
      ({ event }) =>
        event.type === "contact" &&
        event.attackId === attackId &&
        event.targetId === "wave-one-crawler-a",
    ),
  { intervals: [10], timeout: 2_000 }).toBe(true);
  await expect.poll(async () =>
    page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot().activeAttackId,
    ),
  ).toBe(attackId);

  await page.keyboard.press("Space");
  await expect.poll(async () =>
    (await diagnostics(page)).recentEvents.filter(
      ({ event }) =>
        event.type === "attack-resolved" &&
        event.attackId === attackId,
    ),
  ).toEqual([
    expect.objectContaining({
      event: expect.objectContaining({
        type: "attack-resolved",
        attackId,
        result: "hit",
      }),
    }),
  ]);
  const caption = page.locator("[data-feedback-caption]");
  await expect(caption).toContainText(
    "命中",
  );
  await expect.poll(async () =>
    (await diagnostics(page)).audio.cueCounts.playerHit,
  ).toBe((before.playerHit ?? 0) + 1);
  expect(
    (await diagnostics(page)).audio.cueCounts.playerInterrupted ?? 0,
  ).toBe(before.playerInterrupted ?? 0);
  await expect(caption).toBeHidden({ timeout: 2_000 });
  await page.keyboard.press("Space");
  await expect(caption).toContainText("闪避起步");
});

test("rejected audio resumes recover on one context and hit interruption stays readable", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const NativeContext = window.AudioContext;
    const counters = {
      creates: 0,
      resumes: 0,
      closes: 0,
    };
    const WrappedContext = function () {
      const context = new NativeContext();
      counters.creates += 1;
      const nativeResume = context.resume.bind(context);
      const nativeClose = context.close.bind(context);
      context.resume = () => {
        counters.resumes += 1;
        if (counters.resumes <= 2) {
          return Promise.reject(new DOMException("blocked for test"));
        }
        return nativeResume();
      };
      context.close = () => {
        counters.closes += 1;
        return nativeClose();
      };
      return context;
    };
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: WrappedContext,
    });
    (
      window as unknown as {
        __audioLifecycleCounters: typeof counters;
      }
    ).__audioLifecycleCounters = counters;
  });
  await page.goto(
    "/?fixture=fresh&reviewControls=1&safeTraining=1",
  );

  await page.keyboard.press("Shift");
  await expect.poll(async () => (await diagnostics(page)).audio.blocked)
    .toBe(true);
  expect((await diagnostics(page)).audio).toMatchObject({
    unlocked: false,
    contextCreateCount: 1,
    closeCount: 0,
  });

  await page.keyboard.press("Shift");
  await expect.poll(async () =>
    page.evaluate(() =>
      (
        window as unknown as {
          __audioLifecycleCounters: { resumes: number };
        }
      ).__audioLifecycleCounters.resumes,
    )
  ).toBe(2);
  expect((await diagnostics(page)).audio.contextCreateCount).toBe(1);

  await page.keyboard.press("Shift");
  await expect.poll(async () => (await diagnostics(page)).audio.unlocked)
    .toBe(true);
  expect((await diagnostics(page)).audio).toMatchObject({
    blocked: false,
    contextCreateCount: 1,
    closeCount: 0,
  });

  const canvas = page.locator("[data-game-canvas]");
  await canvas.click({ position: { x: 80, y: 80 } });
  await expect.poll(async () =>
    page.evaluate(() =>
      window.__ashfallDiagnostics!.snapshot().activeAttackId,
    )
  ).not.toBeNull();
  const interruptsBefore =
    (await diagnostics(page)).audio.cueCounts.playerInterrupted ?? 0;
  await page.evaluate(() => window.__review!.triggerPlayerHit());
  await expect(page.locator("[data-feedback-caption]")).toContainText(
    "攻击被打断",
  );
  await expect.poll(async () =>
    (await diagnostics(page)).audio.cueCounts.playerInterrupted
  ).toBe(interruptsBefore + 1);
  const interrupted = await diagnostics(page);
  expect(interrupted.audio.lastCue).toBe("playerInterrupted");
  expect(
    interrupted.recentEvents.some(
      ({ event }) =>
        event.type === "attack-resolved" &&
        event.result === "interrupted" &&
        event.reason === "damage",
    ),
  ).toBe(true);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent(
    "pagehide",
  )));
  await expect(page.locator("html")).toHaveAttribute(
    "data-runtime-disposed",
    "true",
  );
  expect(
    await page.evaluate(() =>
      (
        window as unknown as {
          __audioLifecycleCounters: {
            creates: number;
            closes: number;
          };
        }
      ).__audioLifecycleCounters,
    ),
  ).toMatchObject({ creates: 1, closes: 1 });
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
