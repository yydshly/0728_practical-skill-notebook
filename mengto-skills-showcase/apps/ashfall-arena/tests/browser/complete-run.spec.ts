import { expect, test, type Page } from "@playwright/test";

type Vec2 = { x: number; y: number };

type ReviewState = {
  status: "playing" | "upgrade" | "defeated" | "complete";
  tick: number;
  player: {
    position: Vec2;
    facingRadians: number;
    health: number;
    maxHealth: number;
    stamina: number;
    action: string;
    healingCharges: number;
    souls: number;
    upgradeId: "vitality" | "power" | null;
    lockTargetId: string | null;
    weaponId: "oathblade" | "ember-bow";
  };
  enemies: Record<
    string,
    {
      id: string;
      health: number;
      maxHealth: number;
      position: Vec2;
      movePhase: "none" | "telegraph" | "active" | "recover";
      currentMoveId: string | null;
      cooldownTicks: number;
    }
  >;
  encounter: {
    phase: "training" | "wave-one" | "elite" | "boss" | "complete";
    gateOpen: boolean;
    trainingAttackSeen: boolean;
    trainingGuardSeen: boolean;
    completedIds: string[];
  };
  rewardedEnemyIds: string[];
};

type ReviewEvent = {
  tick: number;
  event: {
    type: string;
    actorId?: string;
    attackerId?: string;
    targetId?: string;
    actionId?: string;
    guarded?: boolean;
    phase?: string;
  };
};

const readState = (page: Page) =>
  page.evaluate(
    () => window.__ashfallDiagnostics!.getSerializableState(),
  ) as Promise<ReviewState>;

const readEvents = (page: Page) =>
  page.evaluate(
    () => window.__ashfallDiagnostics!.snapshot().recentEvents,
  ) as Promise<ReviewEvent[]>;

const releaseMovement = async (page: Page) => {
  for (const key of ["w", "a", "s", "d"]) {
    await page.keyboard.up(key);
  }
};

const moveTowardEnemy = async (
  page: Page,
  enemyId: string,
  desiredDistance = 1.2,
) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await readState(page);
    if (state.status === "defeated") {
      throw new Error(`Player was defeated while approaching ${enemyId}`);
    }
    const enemy = state.enemies[enemyId];
    if (!enemy || enemy.health <= 0) {
      await releaseMovement(page);
      return;
    }
    const dx = enemy.position.x - state.player.position.x;
    const dy = enemy.position.y - state.player.position.y;
    const distance = Math.hypot(dx, dy);
    if (
      state.player.action === "hit" ||
      state.player.action === "dodge" ||
      state.player.action === "attack" ||
      state.player.action === "guard"
    ) {
      await page.waitForTimeout(50);
      continue;
    }
    const keys = [
      ...(dx > 0.12 ? ["d"] : dx < -0.12 ? ["a"] : []),
      ...(dy > 0.12 ? ["w"] : dy < -0.12 ? ["s"] : []),
    ];
    if (keys.length === 0) return;

    if (distance <= desiredDistance + 0.2) {
      for (const key of keys) await page.keyboard.down(key);
      await page.waitForTimeout(34);
      for (const key of keys) await page.keyboard.up(key);
      await page.waitForTimeout(34);
      return;
    }

    if (
      distance > 2.4 &&
      state.player.action === "idle" &&
      state.player.stamina >= 30
    ) {
      for (const key of keys) await page.keyboard.down(key);
      await page.keyboard.down("Space");
      await page.waitForTimeout(70);
      await page.keyboard.up("Space");
      for (const key of keys) await page.keyboard.up(key);
      await page.waitForTimeout(120);
      continue;
    }

    const travelMs = Math.min(
      180,
      Math.max(45, ((distance - desiredDistance) / 4.2) * 1_000),
    );
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(travelMs);
    for (const key of keys) await page.keyboard.up(key);

  }
  throw new Error(`Could not reach ${enemyId} with real movement input`);
};

const advanceInput = (
  page: Page,
  intent: Record<string, number | boolean> = {},
  ticks = 1,
) =>
  page.evaluate(
    ({ nextIntent, nextTicks }) =>
      window.__ashfallDiagnostics!.advanceInput(nextIntent, nextTicks),
    { nextIntent: intent, nextTicks: ticks },
  );

const settlePlayerAction = async (page: Page) => {
  for (let tick = 0; tick < 60; tick += 1) {
    const state = await readState(page);
    if (state.status === "defeated") {
      throw new Error("Player was defeated while settling an action");
    }
    if (state.player.action === "idle" || state.player.action === "move") {
      return;
    }
    await advanceInput(page);
  }
  throw new Error("Player action did not settle within 60 real ticks");
};

const useHealingIfNeeded = async (page: Page) => {
  const before = await readState(page);
  if (
    before.status !== "playing" ||
    before.player.health >= 70 ||
    before.player.healingCharges <= 0
  ) {
    return;
  }
  await settlePlayerAction(page);
  await advanceInput(page, { healPressed: true });
  await advanceInput(page);
  const after = await readState(page);
  expect(after.player.health).toBeGreaterThan(before.player.health);
  expect(after.player.healingCharges).toBe(
    before.player.healingCharges - 1,
  );
};

const driveToEnemy = async (page: Page, enemyId: string) => {
  for (let step = 0; step < 360; step += 1) {
    const state = await readState(page);
    if (state.status === "defeated") {
      throw new Error(`Player was defeated while approaching ${enemyId}`);
    }
    const enemy = state.enemies[enemyId];
    if (!enemy || enemy.health <= 0) return;
    if (
      state.player.action === "attack" ||
      state.player.action === "guard" ||
      state.player.action === "hit" ||
      state.player.action === "dodge"
    ) {
      await advanceInput(page);
      continue;
    }
    const dx = enemy.position.x - state.player.position.x;
    const dy = enemy.position.y - state.player.position.y;
    const distance = Math.hypot(dx, dy);
    const moveX = distance === 0 ? 0 : dx / distance;
    const moveY = distance === 0 ? 0 : dy / distance;
    if (distance <= 1.15) {
      await advanceInput(page, { moveX, moveY });
      return;
    }
    const incomingTelegraph = Object.values(state.enemies).some(
      ({ health, movePhase }) =>
        health > 0 &&
        (movePhase === "telegraph" || movePhase === "active"),
    );
    if (incomingTelegraph && state.player.stamina >= 30) {
      await advanceInput(
        page,
        { moveX, moveY, dodgePressed: true },
      );
      await advanceInput(page, {}, 15);
      continue;
    }
    await advanceInput(page, { moveX, moveY }, 3);
  }
  throw new Error(`${enemyId} stayed unreachable for 360 real ticks`);
};

const guardExistingThreats = async (page: Page, enemyId: string) => {
  for (let tick = 0; tick < 180; tick += 1) {
    const state = await readState(page);
    if (state.status === "defeated") {
      throw new Error(`Player was defeated while guarding ${enemyId}`);
    }
    const enemy = state.enemies[enemyId];
    if (!enemy || enemy.health <= 0) return;
    const activeThreat = Object.values(state.enemies).some(
      ({ health, movePhase }) =>
        health > 0 &&
        (movePhase === "telegraph" || movePhase === "active"),
    );
    if (!activeThreat) {
      await settlePlayerAction(page);
      return;
    }
    const dx = enemy.position.x - state.player.position.x;
    const dy = enemy.position.y - state.player.position.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    if (state.player.action !== "guard") {
      await advanceInput(page, {
        moveX: dx / distance,
        moveY: dy / distance,
        guardHeld: true,
      });
    } else {
      await advanceInput(page, { guardHeld: true });
    }
  }
  throw new Error("Enemy telegraphs did not settle within 180 real ticks");
};

const defeatWithRealCombat = async (
  page: Page,
  preferredEnemyId: string,
) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const before = await readState(page);
    const enemy = before.enemies[preferredEnemyId];
    if (!enemy || enemy.health <= 0) return;

    await useHealingIfNeeded(page);
    await driveToEnemy(page, preferredEnemyId);
    await guardExistingThreats(page, preferredEnemyId);
    await driveToEnemy(page, preferredEnemyId);
    const attackStartedAfter = (await readState(page)).tick;
    await advanceInput(page, { attackPressed: true });
    await advanceInput(page, {}, 14);
    const afterAttack = await readState(page);
    const events = await readEvents(page);
    const playerContactIds = new Set(
      events
        .filter(
          ({ tick, event }) =>
            tick >= attackStartedAfter &&
            event.type === "contact" &&
            event.attackerId === "player" &&
            typeof event.targetId === "string",
        )
        .map(({ event }) => event.targetId!),
    );
    const damagedIds = Object.values(before.enemies)
      .filter(
        (candidate) =>
          playerContactIds.has(candidate.id) &&
          (afterAttack.enemies[candidate.id]?.health ?? 0) <
          candidate.health,
      )
      .map(({ id }) => id);
    if (damagedIds.length === 0) {
      continue;
    }
    for (const damagedId of damagedIds) {
      expect(
        events.some(
          ({ tick, event }) =>
            tick >= attackStartedAfter &&
            event.type === "contact" &&
            event.attackerId === "player" &&
            event.targetId === damagedId,
        ),
      ).toBe(true);
      expect(
        events.some(
          ({ tick, event }) =>
            tick >= attackStartedAfter &&
            event.type === "damage" &&
            event.targetId === damagedId,
        ),
      ).toBe(true);
      if (!afterAttack.enemies[damagedId]) {
        expect(
          events.some(
            ({ tick, event }) =>
              tick >= attackStartedAfter &&
              event.type === "defeated" &&
              event.actorId === damagedId,
          ),
        ).toBe(true);
      }
    }
    await settlePlayerAction(page);
    if ((await readState(page)).status === "defeated") {
      throw new Error(`Player was defeated after striking ${preferredEnemyId}`);
    }
    return;
  }
  throw new Error(`${preferredEnemyId} survived 8 real player attacks`);
};

const defeatPhaseWithRealCombat = async (
  page: Page,
  phase: ReviewState["encounter"]["phase"],
) => {
  for (let strike = 0; strike < 24; strike += 1) {
    const state = await readState(page);
    if (state.status === "defeated") {
      throw new Error(`Player was defeated during ${phase}`);
    }
    if (state.status !== "playing" || state.encounter.phase !== phase) return;
    const nearest = Object.values(state.enemies)
      .filter(({ health }) => health > 0)
      .sort((left, right) => {
        const leftDistance = Math.hypot(
          left.position.x - state.player.position.x,
          left.position.y - state.player.position.y,
        );
        const rightDistance = Math.hypot(
          right.position.x - state.player.position.x,
          right.position.y - state.player.position.y,
        );
        return leftDistance - rightDistance || left.id.localeCompare(right.id);
      })[0];
    if (!nearest) {
      await page.waitForTimeout(100);
      continue;
    }
    await defeatWithRealCombat(page, nearest.id);
  }
  throw new Error(`${phase} did not finish after 24 real damaging strikes`);
};

const guardRealTrainingContact = async (page: Page) => {
  const canvas = page.locator("[data-game-canvas]");
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 7481,
    pointerType: "mouse",
    button: 2,
  });
  await expect.poll(
    async () =>
      (await readEvents(page)).some(
        ({ event }) =>
          event.type === "damage" &&
          event.targetId === "player" &&
          event.guarded === true,
      ),
    { timeout: 8_000 },
  ).toBe(true);
};

test("fresh seed 7481 completes through real input, combat, rewards, upgrade, and save paths", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const startedAt = Date.now();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    (
      window as unknown as { __completeRunUnhandled: string[] }
    ).__completeRunUnhandled = [];
    window.addEventListener("unhandledrejection", (event) => {
      (
        window as unknown as { __completeRunUnhandled: string[] }
      ).__completeRunUnhandled.push(String(event.reason));
    });
  });

  await page.goto("/?fixture=fresh&seed=7481&reviewControls=1");
  await expect(page.locator("[data-game-canvas]")).toHaveCount(1);
  expect((await readState(page)).encounter.phase).toBe("training");

  await page.keyboard.down("w");
  await expect.poll(
    async () => Boolean((await readState(page)).enemies["training-crawler"]),
    { timeout: 5_000 },
  ).toBe(true);
  await page.keyboard.up("w");

  const training = (await readState(page)).enemies["training-crawler"]!;
  expect(training.health).toBeLessThanOrEqual(18);

  const canvas = page.locator("[data-game-canvas]");
  await canvas.focus();
  await guardRealTrainingContact(page);
  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 7481,
        pointerType: "mouse",
        button: 2,
      }),
    );
  });
  await expect.poll(async () => (await readState(page)).player.action)
    .toBe("idle");

  await page.keyboard.press("q");
  await expect.poll(
    async () => (await readState(page)).player.lockTargetId,
  ).toBe("training-crawler");

  await expect.poll(async () => (await readState(page)).player.action)
    .toBe("idle");
  await page.keyboard.down("d");
  await page.keyboard.down("Space");
  await page.waitForTimeout(80);
  await page.keyboard.up("Space");
  await page.keyboard.up("d");
  await expect.poll(
    async () =>
      (await readEvents(page)).some(
        ({ event }) =>
          event.type === "action-started" && event.actionId === "dodge",
      ),
  ).toBe(true);

  await moveTowardEnemy(page, "training-crawler", 1.35);
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.setManualReviewClock(true)
  );
  const clockTick = (await readState(page)).tick;
  await page.waitForTimeout(200);
  expect((await readState(page)).tick).toBe(clockTick);
  await advanceInput(page, {}, 6);
  expect((await readState(page)).tick).toBe(clockTick + 6);

  await defeatWithRealCombat(page, "training-crawler");
  await expect.poll(async () => (await readState(page)).encounter.phase, {
    timeout: 5_000,
  }).toBe("wave-one");
  const afterTraining = await readState(page);
  expect(afterTraining.encounter.trainingAttackSeen).toBe(true);
  expect(afterTraining.encounter.trainingGuardSeen).toBe(true);

  await defeatPhaseWithRealCombat(page, "wave-one");
  await expect.poll(async () => (await readState(page)).status, {
    timeout: 5_000,
  }).toBe("upgrade");
  const afterWave = await readState(page);
  expect(afterWave.encounter.completedIds).toEqual(
    expect.arrayContaining([
      "wave-one-crawler-a",
      "wave-one-crawler-b",
      "wave-one-warden",
    ]),
  );
  expect(afterWave.rewardedEnemyIds).toEqual(
    expect.arrayContaining([
      "wave-one-crawler-a",
      "wave-one-crawler-b",
      "wave-one-warden",
    ]),
  );
  expect(afterWave.player.souls).toBeGreaterThanOrEqual(35);

  await page.locator('[data-upgrade-id="vitality"]').click();
  await expect.poll(async () => (await readState(page)).encounter.phase)
    .toBe("elite");
  const upgraded = await readState(page);
  expect(upgraded.player).toMatchObject({
    upgradeId: "vitality",
    maxHealth: 125,
  });

  await defeatPhaseWithRealCombat(page, "elite");
  await expect.poll(async () => {
    const state = await readState(page);
    return {
      phase: state.encounter.phase,
      gateOpen: state.encounter.gateOpen,
    };
  }, { timeout: 5_000 }).toEqual({ phase: "boss", gateOpen: true });
  expect(
    (await readEvents(page)).some(
      ({ event }) =>
        event.type === "encounter-phase" && event.phase === "boss",
    ),
  ).toBe(true);

  await defeatPhaseWithRealCombat(page, "boss");
  await expect.poll(async () => (await readState(page)).status, {
    timeout: 5_000,
  }).toBe("complete");
  const completed = await readState(page);
  expect(completed.encounter).toMatchObject({
    phase: "complete",
    gateOpen: true,
  });
  expect(completed.encounter.completedIds).toContain("boss-sovereign");
  expect(
    (await readEvents(page)).some(
      ({ event }) => event.type === "encounter-complete",
    ),
  ).toBe(true);
  const completeRunEvents = await readEvents(page);
  const playerContacts = completeRunEvents.filter(
    ({ event }) =>
      event.type === "contact" && event.attackerId === "player",
  ).length;
  const enemyDamageEvents = completeRunEvents.filter(
    ({ event }) =>
      event.type === "damage" && event.targetId !== "player",
  ).length;
  const enemyDefeats = completeRunEvents.filter(
    ({ event }) =>
      event.type === "defeated" && event.actorId !== "player",
  ).length;
  expect(playerContacts).toBeGreaterThanOrEqual(7);
  expect(enemyDamageEvents).toBeGreaterThanOrEqual(7);
  expect(enemyDefeats).toBeGreaterThanOrEqual(7);
  test.info().annotations.push(
    {
      type: "real-player-contact-count",
      description: String(playerContacts),
    },
    {
      type: "real-enemy-damage-count",
      description: String(enemyDamageEvents),
    },
    {
      type: "real-enemy-defeat-count",
      description: String(enemyDefeats),
    },
  );

  const saved = await page.evaluate(() =>
    localStorage.getItem("ashfall-arena:v1")
  );
  expect(saved).toContain('"completion":true');
  expect(saved).toContain('"upgradeId":"vitality"');

  await page.goto("/?reviewControls=1");
  await expect(page.locator("[data-complete-modal]")).toBeVisible();
  const restored = await readState(page);
  expect(restored.status).toBe("complete");
  expect(restored.encounter.phase).toBe("complete");
  expect(restored.enemies).toEqual({});

  const unhandled = await page.evaluate(
    () =>
      (
        window as unknown as { __completeRunUnhandled: string[] }
      ).__completeRunUnhandled,
  );
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(unhandled).toEqual([]);
  test.info().annotations.push({
    type: "automated-complete-run-ms",
    description: String(Date.now() - startedAt),
  });
});
