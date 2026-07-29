import { expect, test, type Page } from "@playwright/test";

type PerformanceSnapshot = {
  performanceControl: "live" | "empty";
  qualityMode: "auto" | "low" | "medium" | "high";
  qualityTier: "low" | "medium" | "high";
  quality: {
    mode: "auto" | "low" | "medium" | "high";
    tier: "low" | "medium" | "high";
    reason: "initial" | "user-fixed" | "sustained-slow-frame";
    transitionCount: number;
    sampleCount: number;
    lastWindowMedianMs: number;
    lastWindowP95Ms: number;
    transitions: Array<{
      from: "low" | "medium" | "high";
      to: "low" | "medium" | "high";
      medianMs: number;
      p95Ms: number;
    }>;
  };
  frame: {
    sampleCount: number;
    averageMs: number;
    medianMs: number;
    p95Ms: number;
    maxMs: number;
  };
  work: {
    sampleCount: number;
    averageMs: number;
    medianMs: number;
    p95Ms: number;
    maxMs: number;
  };
  renderer: {
    submittedFrames: number;
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
    pixelRatio: number;
    drawingBufferWidth: number;
    drawingBufferHeight: number;
    shadowMapEnabled: boolean;
    activeLocalLights: number;
  };
  heap:
    | {
        supported: true;
        usedBytes: number;
        totalBytes: number;
        limitBytes: number;
      }
    | { supported: false };
  lifecycle: {
    disposed: boolean;
    sceneChildren: number;
    entityRoots: number;
    listenerRegistrations: number;
    pooledObjects: number;
    activePooledObjects: number;
  };
};

const resetSamples = (page: Page) =>
  page.evaluate(() =>
    window.__ashfallDiagnostics!.resetPerformanceSamples()
  );

const sample = (page: Page) =>
  page.evaluate(
    () => window.__ashfallDiagnostics!.snapshot().performance,
  ) as Promise<PerformanceSnapshot>;

const waitForSampleCount = (page: Page, minimum = 30) =>
  expect.poll(async () => (await sample(page)).frame.sampleCount).toBeGreaterThanOrEqual(
    minimum,
  );

const waitForWorkSampleCount = (page: Page, minimum = 30) =>
  expect.poll(async () => (await sample(page)).work.sampleCount).toBeGreaterThanOrEqual(
    minimum,
  );

const assertMeasurableSnapshot = (
  reading: PerformanceSnapshot,
  quality: "high" | "medium" | "low",
) => {
  expect(reading.qualityTier).toBe(quality);
  expect(reading.frame.sampleCount).toBeGreaterThanOrEqual(30);
  expect(reading.frame.averageMs).toBeGreaterThan(0);
  expect(reading.frame.maxMs).toBeLessThan(250);
  expect(reading.renderer.calls).toBeGreaterThan(0);
  expect(reading.renderer.submittedFrames).toBeGreaterThan(0);
  expect(reading.renderer.calls).toBeLessThan(200);
  expect(reading.renderer.triangles).toBeGreaterThan(0);
  expect(reading.renderer.triangles).toBeLessThan(250_000);
  expect(reading.renderer.geometries).toBeGreaterThan(0);
  expect(reading.renderer.geometries).toBeLessThan(200);
  expect(reading.renderer.textures).toBeGreaterThanOrEqual(0);
  expect(reading.renderer.textures).toBeLessThan(32);
  expect(reading.renderer.pixelRatio).toBeGreaterThan(0);
  expect(reading.renderer.drawingBufferWidth).toBeGreaterThan(0);
  expect(reading.renderer.drawingBufferHeight).toBeGreaterThan(0);
  expect(reading.renderer.shadowMapEnabled).toBe(false);
  expect(reading.lifecycle.sceneChildren).toBeGreaterThan(0);
  expect(reading.lifecycle.entityRoots).toBeGreaterThan(0);
  expect(reading.lifecycle.listenerRegistrations).toBeGreaterThan(0);
  expect(reading.lifecycle.pooledObjects).toBeGreaterThan(0);
  expect(reading.lifecycle.activePooledObjects).toBeGreaterThanOrEqual(0);
  if (reading.heap.supported) {
    expect(reading.heap.usedBytes).toBeGreaterThan(0);
    expect(reading.heap.usedBytes).toBeLessThanOrEqual(
      reading.heap.totalBytes,
    );
    expect(reading.heap.totalBytes).toBeLessThanOrEqual(
      reading.heap.limitBytes,
    );
  }
};

const assertRepresentativeSample = (
  reading: PerformanceSnapshot,
  quality: "high" | "medium" | "low",
) => {
  assertMeasurableSnapshot(reading, quality);
  expect(reading.frame.averageMs).toBeLessThan(50);
  expect(reading.frame.medianMs).toBeLessThan(50);
  expect(reading.frame.p95Ms).toBeLessThan(100);
};

const assertBoundedLiveWork = (reading: PerformanceSnapshot) => {
  expect(reading.performanceControl).toBe("live");
  expect(reading.work.sampleCount).toBeGreaterThanOrEqual(30);
  expect(reading.work.averageMs).toBeGreaterThanOrEqual(0);
  expect(reading.work.medianMs).toBeLessThanOrEqual(12);
  expect(reading.work.p95Ms).toBeLessThanOrEqual(24);
  expect(reading.work.maxMs).toBeLessThan(100);
};

test("auto quality reacts to real rAF while live update/render work stays bounded", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const drawCallBudgets = {
    "wave-one": 125,
    boss: 100,
  };
  for (const fixture of ["wave-one", "boss"] as const) {
    await page.goto(`/?fixture=${fixture}&reviewControls=1`);
    await expect.poll(async () =>
      page.evaluate(
        () =>
          window.__ashfallDiagnostics!.snapshot().enemyModelRootCount,
      ),
    ).toBeGreaterThan(0);
    await expect.poll(async () => {
      const current = await sample(page);
      return current.qualityTier === "low" ||
        (
          current.quality.lastWindowMedianMs > 0 &&
          current.quality.sampleCount >= 30
        );
    }, { timeout: 15_000 }).toBe(true);
    await resetSamples(page);
    await waitForSampleCount(page);
    await waitForWorkSampleCount(page);
    const reading = await sample(page);
    expect(reading.qualityMode).toBe("auto");
    assertMeasurableSnapshot(reading, reading.qualityTier);
    assertBoundedLiveWork(reading);
    if (reading.quality.transitionCount === 0) {
      expect(reading.qualityTier).toBe("high");
      expect(reading.quality.lastWindowMedianMs).toBeLessThanOrEqual(24);
      expect(reading.quality.lastWindowP95Ms).toBeLessThanOrEqual(34);
    } else {
      expect(reading.quality).toMatchObject({
        reason: "sustained-slow-frame",
      });
      expect(reading.quality.transitions[0]).toMatchObject({
        from: "high",
        to: "medium",
      });
      if (reading.qualityTier === "low") {
        expect(reading.quality.transitions[1]).toMatchObject({
          from: "medium",
          to: "low",
        });
      }
    }
    expect(reading.renderer.calls).toBeLessThanOrEqual(
      drawCallBudgets[fixture],
    );
    test.info().annotations.push({
      type: `${fixture}-auto-performance`,
      description: JSON.stringify(reading),
    });
  }
  expect(errors).toEqual([]);
});

test("review-only empty control records the same-page rAF baseline without product work", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&reviewPerformance=empty&quality=low&manualEnemyAi=1",
  );
  await resetSamples(page);
  await waitForSampleCount(page);
  await waitForWorkSampleCount(page);
  const reading = await sample(page);
  expect(reading.performanceControl).toBe("empty");
  expect(reading.qualityMode).toBe("low");
  expect(reading.renderer.submittedFrames).toBe(0);
  expect(reading.frame.sampleCount).toBeGreaterThanOrEqual(30);
  expect(reading.frame.maxMs).toBeLessThan(250);
  expect(reading.work.sampleCount).toBeGreaterThanOrEqual(30);
  expect(reading.work.p95Ms).toBeLessThanOrEqual(1);
  test.info().annotations.push({
    type: "same-page-empty-rAF-baseline",
    description: JSON.stringify(reading),
  });
});

test("same desktop environment proves fixed high versus low and never overrides the user", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&reviewPerformance=empty&quality=low&manualEnemyAi=1",
  );
  await resetSamples(page);
  await waitForSampleCount(page);
  await waitForWorkSampleCount(page);
  const emptyBaseline = await sample(page);
  expect(emptyBaseline.performanceControl).toBe("empty");
  expect(emptyBaseline.renderer.submittedFrames).toBe(0);
  expect(emptyBaseline.work.p95Ms).toBeLessThanOrEqual(1);

  const readings = {} as Record<"high" | "low", PerformanceSnapshot>;
  for (const tier of ["high", "low"] as const) {
    await page.goto(
      `/?fixture=wave-one&reviewControls=1&quality=${tier}&manualEnemyAi=1`,
    );
    await page.waitForTimeout(700);
    await resetSamples(page);
    await page.waitForTimeout(1_200);
    await waitForSampleCount(page);
    const reading = await sample(page);
    assertMeasurableSnapshot(reading, tier);
    assertBoundedLiveWork(reading);
    if (tier === "low") {
      expect(
        reading.frame.medianMs - emptyBaseline.frame.medianMs,
      ).toBeLessThanOrEqual(24);
      expect(
        reading.frame.p95Ms - emptyBaseline.frame.p95Ms,
      ).toBeLessThanOrEqual(34);
    }
    expect(reading.quality).toMatchObject({
      mode: tier,
      tier,
      reason: "user-fixed",
      transitionCount: 0,
    });
    readings[tier] = reading;
    test.info().annotations.push({
      type: `desktop-fixed-${tier}-performance`,
      description: JSON.stringify(reading),
    });
  }
  test.info().annotations.push({
    type: "desktop-fixed-empty-baseline",
    description: JSON.stringify(emptyBaseline),
  });

  expect(readings.low.renderer.pixelRatio).toBeLessThan(
    readings.high.renderer.pixelRatio,
  );
  expect(
    readings.low.renderer.drawingBufferWidth *
      readings.low.renderer.drawingBufferHeight,
  ).toBeLessThan(
    readings.high.renderer.drawingBufferWidth *
      readings.high.renderer.drawingBufferHeight,
  );
  expect(readings.high.renderer.activeLocalLights).toBe(4);
  expect(readings.low.renderer.activeLocalLights).toBe(0);
});

test("390x844 touch, reduced motion, gamepad, audio recovery, and low quality remain measurable", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    let resumeAttempts = 0;
    const NativeAudioContext =
      window.AudioContext ??
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (NativeAudioContext) {
      const WrappedAudioContext = function () {
        const context = new NativeAudioContext();
        const nativeResume = context.resume.bind(context);
        context.resume = () => {
          resumeAttempts += 1;
          if (resumeAttempts === 1) {
            return Promise.reject(
              new DOMException("blocked for release sampling"),
            );
          }
          return nativeResume();
        };
        return context;
      } as unknown as typeof AudioContext;
      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: WrappedAudioContext,
      });
    }

    const buttons = Array.from({ length: 16 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    const pad = {
      axes: [0, 0, 0, 0],
      buttons,
      connected: true,
      id: "Ashfall release standard pad",
      index: 0,
      mapping: "standard",
      timestamp: 1,
      vibrationActuator: null,
      hapticActuators: [],
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    });
    (
      window as unknown as {
        __setReleaseGamepad(button: number | null): void;
      }
    ).__setReleaseGamepad = (button) => {
      for (const entry of buttons) {
        entry.pressed = false;
        entry.value = 0;
      }
      if (button !== null) {
        buttons[button]!.pressed = true;
        buttons[button]!.value = 1;
      }
    };
  });

  await page.goto(
    "/?fixture=wave-one&reviewControls=1&quality=low&manualEnemyAi=1",
  );
  const touchAttack = page.locator(
    '[data-touch-action="attackPressed"]',
  );
  await touchAttack.dispatchEvent("pointerdown", {
    pointerId: 9301,
    pointerType: "touch",
    button: 0,
  });
  await touchAttack.dispatchEvent("pointerup", {
    pointerId: 9301,
    pointerType: "touch",
    button: 0,
  });
  await page.evaluate(() =>
    (
      window as unknown as {
        __setReleaseGamepad(button: number | null): void;
      }
    ).__setReleaseGamepad(10),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-input-mode",
    "gamepad",
  );
  await page.evaluate(() =>
    (
      window as unknown as {
        __setReleaseGamepad(button: number | null): void;
      }
    ).__setReleaseGamepad(null),
  );

  await page.keyboard.press("Shift");
  await expect.poll(async () =>
    page.evaluate(
      () =>
        (
          window.__review!.getDiagnostics() as {
            audio: { blocked: boolean };
          }
        ).audio.blocked,
    ),
  ).toBe(true);
  await page.keyboard.press("Shift");
  await expect.poll(async () =>
    page.evaluate(
      () =>
        (
          window.__review!.getDiagnostics() as {
            audio: { blocked: boolean; unlocked: boolean };
          }
        ).audio,
    ),
  ).toMatchObject({ blocked: false, unlocked: true });

  await resetSamples(page);
  await page.waitForTimeout(1_200);
  const reading = await sample(page);
  assertRepresentativeSample(reading, "low");
  expect(reading.quality).toMatchObject({
    mode: "low",
    tier: "low",
    reason: "user-fixed",
    transitionCount: 0,
  });
  test.info().annotations.push({
    type: "mobile-low-performance",
    description: JSON.stringify(reading),
  });
  expect(
    await page.evaluate(
      () => window.__ashfallDiagnostics!.snapshot().camera.reducedMotion,
    ),
  ).toBe(true);
});

test("renderer resources, pools, and listeners stay bounded across retry and dispose", async ({
  page,
}) => {
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1&quality=medium",
  );
  for (const enemyId of [
    "wave-one-crawler-a",
    "wave-one-crawler-b",
    "wave-one-warden",
  ]) {
    await page.evaluate((id) =>
      window.__ashfallDiagnostics!.drivePlayerStrike(id), enemyId);
  }
  await expect.poll(async () =>
    page.evaluate(
      () => window.__ashfallDiagnostics!.snapshot().status,
    ),
  ).toBe("upgrade");
  await page.locator('[data-upgrade-id="vitality"]').click();
  await expect.poll(async () =>
    page.evaluate(
      () => window.__ashfallDiagnostics!.snapshot().encounterPhase,
    ),
  ).toBe("elite");
  const defeatAndRetry = async () => {
    await page.evaluate(() =>
      window.__ashfallDiagnostics!.drivePlayerDefeat(
        "elite-bell",
      )
    );
    await expect.poll(async () =>
      page.evaluate(
        () => window.__ashfallDiagnostics!.snapshot().status,
      ),
    ).toBe("defeated");
    expect(
      await page.evaluate(() =>
        window.__ashfallDiagnostics!.retryLatestCheckpoint()
      ),
    ).toBe(true);
    await page.waitForTimeout(500);
  };

  await page.waitForTimeout(500);
  const cold = await sample(page);
  await defeatAndRetry();
  const baseline = await sample(page);
  const retrySnapshots: PerformanceSnapshot[] = [];
  expect(baseline.renderer.geometries).toBeLessThanOrEqual(
    cold.renderer.geometries + 4,
  );
  expect(baseline.lifecycle.listenerRegistrations).toBe(
    cold.lifecycle.listenerRegistrations,
  );
  expect(baseline.lifecycle.pooledObjects).toBe(
    cold.lifecycle.pooledObjects,
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await defeatAndRetry();
    const retried = await sample(page);
    retrySnapshots.push(retried);
    expect(retried.renderer.geometries).toBeLessThanOrEqual(
      baseline.renderer.geometries,
    );
    expect(retried.renderer.textures).toBeLessThanOrEqual(
      baseline.renderer.textures,
    );
    expect(retried.lifecycle).toMatchObject({
      sceneChildren: baseline.lifecycle.sceneChildren,
      entityRoots: baseline.lifecycle.entityRoots,
      listenerRegistrations: baseline.lifecycle.listenerRegistrations,
      pooledObjects: baseline.lifecycle.pooledObjects,
    });
  }

  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide"))
  );
  const disposed = await page.evaluate(
    () =>
      (
        window as unknown as {
          __ashfallReleaseDisposalSnapshot: PerformanceSnapshot;
        }
      ).__ashfallReleaseDisposalSnapshot,
  );
  expect(disposed.lifecycle).toMatchObject({
    disposed: true,
    entityRoots: 0,
    listenerRegistrations: 0,
    activePooledObjects: 0,
  });
  expect(disposed.renderer.geometries).toBe(0);
  expect(disposed.renderer.textures).toBe(0);
  test.info().annotations.push({
    type: "retry-dispose-lifecycle",
    description: JSON.stringify({
      cold,
      baseline,
      retries: retrySnapshots,
      disposed,
    }),
  });
});
