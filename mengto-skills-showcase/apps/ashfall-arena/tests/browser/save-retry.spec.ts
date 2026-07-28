import { expect, test, type Page } from "@playwright/test";

const snapshot = (page: Page) =>
  page.evaluate(() => window.__ashfallDiagnostics!.snapshot());

const strikeWaveOne = async (page: Page) => {
  for (const id of [
    "wave-one-crawler-a",
    "wave-one-crawler-b",
    "wave-one-warden",
  ]) {
    await page.evaluate((enemyId) =>
      window.__ashfallDiagnostics!.drivePlayerStrike(enemyId), id);
  }
  await expect.poll(async () => (await snapshot(page)).status)
    .toBe("upgrade");
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetItem = Storage.prototype.setItem;
    window.__setAshfallSaveWriteFailure = (enabled: boolean) => {
      window.__ashfallSaveWriteFailure = enabled;
    };
    Storage.prototype.setItem = function (key, value) {
      if (
        window.__ashfallSaveWriteFailure &&
        key === "ashfall-arena:v1"
      ) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      nativeSetItem.call(this, key, value);
    };
  });
});

test("upgrade save reload and real defeat retry preserve the checkpoint without duplicate transients", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await strikeWaveOne(page);
  const modal = page.getByRole("dialog", { name: "选择一次升级" });
  await expect(modal).toBeVisible();
  await expect(modal.getByRole("button", { name: /活力/ })).toBeFocused();
  await modal.getByRole("button", { name: /活力/ }).dblclick();

  await expect.poll(async () => (await snapshot(page)).encounterPhase)
    .toBe("elite");
  const saved = await page.evaluate(() =>
    localStorage.getItem("ashfall-arena:v1"));
  expect(saved).toContain('"phase":"elite"');
  expect(saved).toContain('"upgradeId":"vitality"');

  await page.goto("/?reviewControls=1&manualEnemyAi=1");
  const continued = await page.evaluate(() =>
    window.__ashfallDiagnostics!.getSerializableState());
  expect(continued).toMatchObject({
    status: "playing",
    encounter: { phase: "elite", gateOpen: false },
    player: {
      health: 125,
      maxHealth: 125,
      upgradeId: "vitality",
      souls: 35,
    },
  });
  expect(Object.keys(continued.enemies).sort()).toEqual([
    "elite-bell",
    "elite-crawler",
  ]);

  await page.evaluate(() =>
    window.__ashfallDiagnostics!.drivePlayerDefeat("elite-bell"));
  await expect.poll(async () => (await snapshot(page)).status)
    .toBe("defeated");
  await expect(
    page.getByRole("dialog", { name: "本轮挑战失败" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "从检查点重试" }).click();

  const retried = await page.evaluate(() =>
    window.__ashfallDiagnostics!.getSerializableState());
  expect(retried).toMatchObject({
    status: "playing",
    paused: false,
    encounter: { phase: "elite", gateOpen: false },
    player: {
      health: 125,
      maxHealth: 125,
      stamina: 100,
      upgradeId: "vitality",
      souls: 35,
    },
    drops: [],
  });
  expect(Object.keys(retried.enemies).sort()).toEqual([
    "elite-bell",
    "elite-crawler",
  ]);
  expect(retried.combat.projectiles).toEqual([]);
  expect(retried.combat.enemyProjectiles).toEqual([]);
  expect((await snapshot(page)).canvasCount).toBe(1);
  expect(
    await page.evaluate(() =>
      window.__ashfallDiagnostics!.retryLatestCheckpoint()),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("corrupt saves and quota failures fall back visibly without breaking the run", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("ashfall-arena:v1", "{");
  });
  await page.goto("/?reviewControls=1&safeTraining=1");
  await expect(page.locator("[data-save-notice]")).toContainText(
    "存档损坏",
  );
  expect((await snapshot(page)).encounterPhase).toBe("training");

  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await page.evaluate(() => window.__setAshfallSaveWriteFailure(true));
  await strikeWaveOne(page);
  await page.getByRole("button", { name: /力量/ }).click();
  await expect.poll(async () => (await snapshot(page)).encounterPhase)
    .toBe("elite");
  await expect(page.locator("[data-save-notice]")).toContainText(
    "无法写入存档",
  );
  expect((await snapshot(page)).status).toBe("playing");
});

test("new run cancellation is a no-op and confirmation clears only the exact key", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await strikeWaveOne(page);
  await page.getByRole("button", { name: /力量/ }).click();
  await page.evaluate(() =>
    localStorage.setItem("another-product:v1", "keep"));

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "新开一局" }).click();
  expect((await snapshot(page)).encounterPhase).toBe("elite");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ashfall-arena:v1")),
  ).not.toBeNull();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "新开一局" }).click();
  await expect.poll(async () => (await snapshot(page)).encounterPhase)
    .toBe("training");
  expect(
    await page.evaluate(() => ({
      ashfall: localStorage.getItem("ashfall-arena:v1"),
      other: localStorage.getItem("another-product:v1"),
    })),
  ).toEqual({ ashfall: null, other: "keep" });
  expect((await snapshot(page)).canvasCount).toBe(1);
});

test("boss completion is saved and reloads as a completed record", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=boss&reviewControls=1&manualEnemyAi=1",
  );
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.drivePlayerStrike("boss-sovereign"));
  await expect.poll(async () => (await snapshot(page)).status)
    .toBe("complete");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("ashfall-arena:v1")),
  ).toContain('"completion":true');

  await page.goto("/?reviewControls=1");
  await expect(
    page.getByRole("dialog", { name: "挑战完成记录" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "挑战完成记录" }),
  ).toBeFocused();
  const restored = await page.evaluate(() =>
    window.__ashfallDiagnostics!.getSerializableState());
  expect(restored.status).toBe("complete");
  expect(restored.encounter.phase).toBe("complete");
  expect(restored.enemies).toEqual({});
});

test("keyboard and touch healing consume one charge per physical edge", async ({
  page,
}) => {
  const injureWithWarden = async () => {
    const attackId = await page.evaluate(() =>
      window.__ashfallDiagnostics!.queueEnemyMove(
        "wave-one-warden",
        "warden-bolt",
      ));
    await expect.poll(async () => {
      const state = await page.evaluate(() =>
        window.__ashfallDiagnostics!.getSerializableState());
      return state.combat.receivedAttackIds.includes(attackId);
    }, { timeout: 8_000 }).toBe(true);
    await expect.poll(async () => {
      const state = await page.evaluate(() =>
        window.__ashfallDiagnostics!.getSerializableState());
      return state.player.action;
    }).toBe("idle");
  };
  const progression = () =>
    page.evaluate(() => {
      const state =
        window.__ashfallDiagnostics!.getSerializableState();
      return {
        health: state.player.health,
        charges: state.player.healingCharges,
      };
    });

  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await injureWithWarden();
  expect((await progression()).health).toBeLessThan(105);
  await page.keyboard.down("e");
  await page.waitForTimeout(350);
  const keyboard = await progression();
  await page.keyboard.up("e");
  expect(keyboard).toEqual({ health: 105, charges: 2 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );
  await injureWithWarden();
  const heal = page.getByRole("button", { name: "治疗" });
  const box = await heal.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await heal.dispatchEvent("pointerdown", {
    pointerId: 901,
    pointerType: "touch",
    button: 0,
  });
  await page.waitForTimeout(350);
  const touch = await progression();
  await heal.dispatchEvent("pointerup", {
    pointerId: 901,
    pointerType: "touch",
    button: 0,
  });
  expect(touch).toEqual({ health: 105, charges: 2 });
});

declare global {
  interface Window {
    __ashfallSaveWriteFailure?: boolean;
    __setAshfallSaveWriteFailure(enabled: boolean): void;
  }
}
