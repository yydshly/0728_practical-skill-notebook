import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

async function requestGuideWhileBlocked(page: Page): Promise<void> {
  await page.getByRole("button", { name: "这是什么？" }).evaluate(
    (button: HTMLButtonElement) => button.click(),
  );
}

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

test("player pause prevents a second dialog and manual guide opens after resume", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "游戏已暂停" }),
  ).toBeVisible();

  await requestGuideWhileBlocked(page);

  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeHidden();
  await page.getByRole("button", { name: "继续战斗" }).click();
  await expect(
    page.getByRole("dialog", { name: "游戏已暂停" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeVisible();
});

test("upgrade prevents a second dialog until an actual upgrade is chosen", async ({
  page,
}) => {
  await page.goto("/?fixture=wave-one&reviewControls=1&guideReview=1");
  await page.getByRole("button", { name: "开始体验" }).click();
  const enemyIds = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().enemies
      .filter(({ health }) => health > 0)
      .map(({ id }) => id),
  );
  for (const id of enemyIds) {
    await page.evaluate(
      (enemyId) =>
        window.__ashfallDiagnostics!.drivePlayerStrike(enemyId),
      id,
    );
  }
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().status
  )).toBe("upgrade");

  await requestGuideWhileBlocked(page);

  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeHidden();
  await page.locator('[data-upgrade-id="vitality"]').click();
  await expect(
    page.getByRole("dialog", { name: "选择一次升级" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeVisible();
});

test("defeat prevents a second dialog until checkpoint retry", async ({
  page,
}) => {
  await page.goto("/?fixture=elite&reviewControls=1&guideReview=1");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.drivePlayerDefeat("elite-bell"),
  );
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().status
  )).toBe("defeated");

  await requestGuideWhileBlocked(page);

  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeHidden();
  await page.getByRole("button", { name: "从检查点重试" }).click();
  await expect(
    page.getByRole("dialog", { name: "本轮挑战失败" }),
  ).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeVisible();
});

test("complete keeps automatic open pending and retries after a new run", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/?fixture=complete&reviewControls=1&guideReview=1");
  await expect(
    page.getByRole("dialog", { name: "挑战完成记录" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeHidden();

  await page
    .getByRole("dialog", { name: "挑战完成记录" })
    .getByRole("button", { name: "新开一局" })
    .click();

  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
});

test("repeated guide cycles preserve state, save, listeners, and guide DOM", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.setManualReviewClock(true),
  );
  const before = await page.evaluate(() => ({
    state: window.__ashfallDiagnostics!.getSerializableState(),
    save: localStorage.getItem("ashfall-arena:v1"),
    listeners:
      window.__ashfallDiagnostics!.snapshot().performance.lifecycle
        .listenerRegistrations,
  }));

  for (let cycle = 0; cycle < 5; cycle += 1) {
    await page.getByRole("button", { name: "关闭说明" }).click();
    await page.getByRole("button", { name: "这是什么？" }).click();
  }

  const after = await page.evaluate(() => ({
    state: window.__ashfallDiagnostics!.getSerializableState(),
    save: localStorage.getItem("ashfall-arena:v1"),
    listeners:
      window.__ashfallDiagnostics!.snapshot().performance.lifecycle
        .listenerRegistrations,
    guideDialogs:
      document.querySelectorAll(".showcase-guide-dialog").length,
    guideTriggers:
      document.querySelectorAll(".showcase-guide-trigger").length,
  }));
  expect(after.state).toEqual(before.state);
  expect(after.save).toBe(before.save);
  expect(after.listeners).toBe(before.listeners);
  expect(after.guideDialogs).toBe(1);
  expect(after.guideTriggers).toBe(1);
});

test("direct diagnostics mutators reject while the guide is open without changing state", async ({
  page,
}) => {
  await page.goto("/?fixture=wave-one&reviewControls=1&guideReview=1");
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.setManualReviewClock(true),
  );
  const result = await page.evaluate(() => {
    const diagnostics = window.__ashfallDiagnostics!;
    const enemy = diagnostics.snapshot().enemies.find(
      ({ health }) => health > 0,
    )!;
    const moveId =
      enemy.kind === "ash-warden"
        ? "warden-bolt"
        : enemy.kind === "bell-elite"
          ? "elite-sweep"
          : enemy.kind === "bell-sovereign"
            ? "sovereign-sweep"
            : "crawler-lunge";
    const before = diagnostics.getSerializableState();
    const calls = [
      () => diagnostics.triggerCameraShake(),
      () => diagnostics.queueEnemyMove(enemy.id, moveId),
      () => diagnostics.drivePlayerDodge(enemy.id, moveId),
      () => diagnostics.drivePlayerStrike(enemy.id),
      () => diagnostics.drivePlayerDefeat(enemy.id),
      () => diagnostics.retryLatestCheckpoint(),
    ];
    const outcomes = calls.map((call) => {
      try {
        call();
        return "resolved";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });
    return {
      before,
      after: diagnostics.getSerializableState(),
      outcomes,
    };
  });

  expect(result.outcomes).toEqual(
    Array.from({ length: 6 }, () => "guide gate is open"),
  );
  expect(result.after).toEqual(result.before);
});

for (const legalMutation of ["triggerPlayerHit", "setPlayerHealth"] as const) {
  test(`window review writes reject before ${legalMutation} consumes its first attack id`, async ({
    page,
  }) => {
    await page.goto("/?fixture=wave-one&reviewControls=1&guideReview=1");
    const blocked = await page.evaluate(() => {
      const diagnostics = window.__ashfallDiagnostics!;
      const review = window.__review!;
      const before = diagnostics.getSerializableState();
      const enemyId = Object.values(before.enemies).find(
        ({ health }) => health > 0,
      )!.id;
      const calls = [
        () => review.triggerPlayerHit(),
        () => review.setPlayerHealth(before.player.health - 1),
        () => review.defeatEnemy(enemyId),
      ];
      const outcomes = calls.map((call) => {
        try {
          call();
          return "resolved";
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      });
      return {
        before,
        after: diagnostics.getSerializableState(),
        outcomes,
      };
    });

    expect(blocked.outcomes).toEqual([
      "guide gate is open",
      "guide gate is open",
      "guide gate is open",
    ]);
    expect(blocked.after).toEqual(blocked.before);

    await page.getByRole("button", { name: "关闭说明" }).click();
    const receivedAttackIds = await page.evaluate((mutation) => {
      const diagnostics = window.__ashfallDiagnostics!;
      const review = window.__review!;
      const before = diagnostics.getSerializableState();
      if (mutation === "triggerPlayerHit") {
        review.triggerPlayerHit();
      } else {
        review.setPlayerHealth(before.player.health - 1);
      }
      return diagnostics
        .getSerializableState()
        .combat.receivedAttackIds.slice(
          before.combat.receivedAttackIds.length,
        );
    }, legalMutation);

    expect(receivedAttackIds).toEqual([
      legalMutation === "triggerPlayerHit"
        ? "review:player-hit:1"
        : "review:set-health:1",
    ]);
  });
}

test("a blocked localStorage getter keeps Ashfall onboarding usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/?fixture=fresh&reviewControls=1&guideReview=1");
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();

  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场｜/ }),
  ).toBeVisible();
});

test("hub return is same-tab while live lifecycle diagnostics report the guide gate", async ({
  page,
}) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  const link = page.getByRole("link", { name: "返回能力展厅" });
  await expect(link).not.toHaveAttribute("target");
  await expect(link).toHaveAttribute(
    "href",
    /#product-ashfall-arena$/,
  );

  const openLifecycle = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().performance.lifecycle,
  );
  expect(openLifecycle.guideGateOpen).toBe(true);
  expect(openLifecycle.recoveryFrames).toBe(0);

  await page.getByRole("button", { name: "关闭说明" }).click();
  const closedLifecycle = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot().performance.lifecycle,
  );
  expect(closedLifecycle.guideGateOpen).toBe(false);
  expect(closedLifecycle.recoveryFrames).toBe(0);
});

test("WebGL fallback creates an independent guide after disabling gameplay controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/?reviewControls=1&guideReview=1");

  await expect(page.getByText(/3D 不可用/).first()).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "关闭说明" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "返回能力展厅" }),
  ).toBeEnabled();
  const snapshot = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot(),
  );
  expect(snapshot.runtimeMode).toBe("information-fallback");
  expect(snapshot.guideGateOpen).toBe(false);
  expect(snapshot.guideOpen).toBe(true);
  expect(snapshot.frameCount).toBe(0);
  expect(snapshot.inputSampleCount).toBe(0);
  expect(snapshot.audio).toEqual({
    paused: true,
    contextState: "not-created",
    contextCreateCount: 0,
    playedCueCount: 0,
  });
});

test("live pagehide destroys the guide without a close recovery frame", async ({
  page,
}) => {
  await page.goto("/?reviewControls=1&guideReview=1");
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await page.waitForTimeout(100);

  const disposal = await page.evaluate(() => ({
    snapshot: window.__ashfallReleaseDisposalSnapshot,
    diagnosticsPresent: window.__ashfallDiagnostics !== undefined,
    guideDialogs:
      document.querySelectorAll(".showcase-guide-dialog").length,
    guideTriggers:
      document.querySelectorAll(".showcase-guide-trigger").length,
  }));
  expect(disposal.snapshot?.lifecycle.disposed).toBe(true);
  expect(disposal.snapshot?.lifecycle.guideGateOpen).toBe(false);
  expect(disposal.snapshot?.lifecycle.recoveryFrames).toBe(0);
  expect(disposal.diagnosticsPresent).toBe(false);
  expect(disposal.guideDialogs).toBe(0);
  expect(disposal.guideTriggers).toBe(0);
});

test("fallback pagehide destroys its independent guide without starting recovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/?reviewControls=1&guideReview=1");
  await expect(
    page.getByRole("dialog", { name: /灰烬竞技场/ }),
  ).toBeVisible();

  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  await page.waitForTimeout(100);

  const disposal = await page.evaluate(() => ({
    snapshot: window.__ashfallReleaseDisposalSnapshot,
    diagnosticsPresent: window.__ashfallDiagnostics !== undefined,
    guideDialogs:
      document.querySelectorAll(".showcase-guide-dialog").length,
    guideTriggers:
      document.querySelectorAll(".showcase-guide-trigger").length,
  }));
  expect(disposal.snapshot?.lifecycle.disposed).toBe(true);
  expect(disposal.snapshot?.lifecycle.guideGateOpen).toBe(false);
  expect(disposal.snapshot?.lifecycle.recoveryFrames).toBe(0);
  expect(disposal.diagnosticsPresent).toBe(false);
  expect(disposal.guideDialogs).toBe(0);
  expect(disposal.guideTriggers).toBe(0);
});
