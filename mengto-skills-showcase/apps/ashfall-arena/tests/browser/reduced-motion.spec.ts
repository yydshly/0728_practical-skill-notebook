import { expect, test, type Page } from "@playwright/test";

type FeedbackDiagnostics = {
  effects: {
    totalActive: number;
    damageFlashActive: boolean;
    projectileTraces: Array<{
      projectileId: string;
      position: { x: number; z: number };
      velocity: { x: number; z: number };
      rotationY: number;
    }>;
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
    lastCue: string | null;
    cueCounts: Record<string, number>;
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

test("live projectile VFX velocity matches the authoritative combat projectile", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(120);
  await page.keyboard.up("KeyD");
  const wardenId = await page.evaluate(() => {
    const state = (
      window as unknown as {
        __review: {
          getSerializableState(): {
            enemies: Record<string, { kind: string }>;
          };
        };
      }
    ).__review.getSerializableState();
    return Object.entries(state.enemies).find(
      ([, enemy]) => enemy.kind === "ash-warden",
    )?.[0] ?? null;
  });
  expect(wardenId).not.toBeNull();

  await page.evaluate((enemyId) => {
    (
      window as unknown as {
        __ashfallDiagnostics: {
          queueEnemyMove(id: string, move: "warden-bolt"): string;
        };
      }
    ).__ashfallDiagnostics.queueEnemyMove(enemyId!, "warden-bolt");
  }, wardenId);

  let compared: {
    projectileId: string;
    traceId: string;
    projectileVelocity: { x: number; z: number };
    traceVelocity: { x: number; z: number };
  } | null = null;
  await expect
    .poll(async () => {
      compared = await page.evaluate(() => {
        const state = (
          window as unknown as {
            __review: {
              getSerializableState(): {
                combat: {
                  enemyProjectiles: Array<{
                    id: string;
                    direction: { x: number; y: number };
                    speed: number;
                  }>;
                };
              };
              getDiagnostics(): FeedbackDiagnostics;
            };
          }
        ).__review;
        const projectile =
          state.getSerializableState().combat.enemyProjectiles[0];
        const trace = state.getDiagnostics().effects.projectileTraces[0];
        if (!projectile || !trace) return null;
        return {
          projectileId: projectile.id,
          traceId: trace.projectileId,
          projectileVelocity: {
            x: projectile.direction.x * projectile.speed,
            z: projectile.direction.y * projectile.speed,
          },
          traceVelocity: trace.velocity,
        };
      });
      return compared;
    })
    .not.toBeNull();
  expect(compared).not.toBeNull();
  const captured = compared!;
  expect(captured.traceId).toBe(captured.projectileId);
  expect(captured.traceVelocity.x).toBeCloseTo(
    captured.projectileVelocity.x,
    10,
  );
  expect(captured.traceVelocity.z).toBeCloseTo(
    captured.projectileVelocity.z,
    10,
  );
});

test("fixed-step attack miss and heal events drive distinct captions and audio cues", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=fresh&reviewControls=1&safeTraining=1",
  );
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
  await expect
    .poll(async () => (await diagnostics(page)).audio.cueCounts.playerMiss)
    .toBeGreaterThan(0);

  const actionStartsBefore =
    (await diagnostics(page)).audio.cueCounts.playerAttackStart ?? 0;
  const missesBefore =
    (await diagnostics(page)).audio.cueCounts.playerMiss ?? 0;
  await page.locator("[data-game-canvas]").click({ position: { x: 90, y: 90 } });
  await expect(page.locator("[data-feedback-caption]")).toContainText(
    "攻击起手",
  );
  await expect
    .poll(async () => (await diagnostics(page)).audio.cueCounts.playerAttackStart)
    .toBe(actionStartsBefore + 1);
  await expect(page.locator("[data-feedback-caption]")).toContainText("落空");
  await expect
    .poll(async () => (await diagnostics(page)).audio.cueCounts.playerMiss)
    .toBe(missesBefore + 1);

  await page.evaluate(() =>
    (
      window as unknown as {
        __review: { setPlayerHealth(value: number): void };
      }
    ).__review.setPlayerHealth(60),
  );
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
  await page.keyboard.press("KeyE");
  await expect(page.locator("[data-feedback-caption]")).toContainText("治疗");
  await expect
    .poll(async () => (await diagnostics(page)).audio.cueCounts.playerHeal)
    .toBe(1);
  expect((await diagnostics(page)).audio.lastCue).toBe("playerHeal");
});

test("pause and visibility destroy active voices and resume never replays stale cues", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=fresh&reviewControls=1&safeTraining=1",
  );
  await page.locator("[data-game-canvas]").click({ position: { x: 80, y: 80 } });
  await expect
    .poll(async () => (await diagnostics(page)).audio.unlocked)
    .toBe(true);

  await page.evaluate(() => {
    const review = (
      window as unknown as {
        __review: { triggerPlayerHit(): void };
      }
    ).__review;
    for (let index = 0; index < 20; index += 1) review.triggerPlayerHit();
  });
  expect((await diagnostics(page)).audio.voiceCount).toBeGreaterThan(0);
  expect((await diagnostics(page)).audio.voiceCount).toBeLessThanOrEqual(12);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeVisible();
  expect((await diagnostics(page)).audio.voiceCount).toBe(0);
  const pauseCueCount = (await diagnostics(page)).audio.playedCueCount;
  await page.getByRole("button", { name: "继续战斗" }).click();
  await page.waitForTimeout(250);
  expect((await diagnostics(page)).audio.voiceCount).toBe(0);
  expect((await diagnostics(page)).audio.playedCueCount).toBe(pauseCueCount);

  await page.evaluate(() => {
    let visibility = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    (
      window as unknown as {
        __setTask6Visibility(value: "visible" | "hidden"): void;
      }
    ).__setTask6Visibility = (value) => {
      visibility = value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
    const review = (
      window as unknown as {
        __review: { triggerPlayerHit(): void };
      }
    ).__review;
    for (let index = 0; index < 8; index += 1) review.triggerPlayerHit();
  });
  expect((await diagnostics(page)).audio.voiceCount).toBeGreaterThan(0);
  await page.evaluate(() =>
    (
      window as unknown as {
        __setTask6Visibility(value: "visible" | "hidden"): void;
      }
    ).__setTask6Visibility("hidden"),
  );
  expect((await diagnostics(page)).audio.voiceCount).toBe(0);
  const hiddenCueCount = (await diagnostics(page)).audio.playedCueCount;
  await page.evaluate(() =>
    (
      window as unknown as {
        __setTask6Visibility(value: "visible" | "hidden"): void;
      }
    ).__setTask6Visibility("visible"),
  );
  await page.waitForTimeout(250);
  expect((await diagnostics(page)).audio.voiceCount).toBe(0);
  expect((await diagnostics(page)).audio.playedCueCount).toBe(hiddenCueCount);
});

test("HUD maps every phase and live telegraph to Chinese without internal IDs", async ({
  page,
}) => {
  const phases = [
    ["fresh", "训练阶段", "training"],
    ["wave-one", "第一波", "wave-one"],
    ["elite", "精英战", "elite"],
    ["boss", "首领战", "boss"],
    ["complete", "挑战完成", "complete"],
  ] as const;
  for (const [fixture, chinese, internal] of phases) {
    await page.goto(`/?fixture=${fixture}&reviewControls=1&manualEnemyAi=1`);
    const status = page.locator(".arena-status");
    await expect(status).toContainText(chinese);
    await expect(status).not.toContainText(internal);
  }

  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await page.evaluate(() =>
    (
      window as unknown as {
        __ashfallDiagnostics: {
          queueEnemyMove(id: string, move: "warden-bolt"): string;
        };
      }
    ).__ashfallDiagnostics.queueEnemyMove(
      "wave-one-warden",
      "warden-bolt",
    ),
  );
  const telegraph = page.locator("[data-enemy-telegraph]");
  await expect(telegraph).toBeVisible();
  await expect(telegraph).toContainText("灰烬守望者 · 灰烬飞矢");
  await expect(telegraph).not.toContainText("wave-one-warden");
  await expect(telegraph).not.toContainText("warden-bolt");

  await page.keyboard.press("Digit2");
  await expect(page.locator("[data-weapon]")).toHaveText("余烬弓");
  await expect(page.locator("[data-device-prompt]")).toContainText("键鼠");
});
