import { expect, test } from "@playwright/test";

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
});

test.afterEach(() => {
  expect(errors, "browser console and page errors").toEqual([]);
});

const snapshot = (page: import("@playwright/test").Page) =>
  page.evaluate(() => window.__ashfallDiagnostics!.snapshot());

const installDeterministicGamepad = (
  page: import("@playwright/test").Page,
) =>
  page.addInitScript(() => {
    let active = false;
    const buttons = Array.from({ length: 16 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    const gamepad = {
      axes: [0, 0, 0, 0],
      buttons,
      connected: true,
      id: "Ashfall deterministic standard pad",
      index: 0,
      mapping: "standard",
      timestamp: 1,
      vibrationActuator: null,
      hapticActuators: [],
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => (active ? [gamepad] : []),
    });
    window.__setAshfallTestGamepad = (
      enabled: boolean,
      verticalAxis = 0,
      guardHeld = false,
    ) => {
      active = enabled;
      gamepad.axes[1] = verticalAxis;
      gamepad.buttons[6]!.pressed = guardHeld;
      gamepad.buttons[6]!.value = guardHeld ? 1 : 0;
    };
  });

test("fresh start renders a live arena and moves authoritative state", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1");
  await expect(page.getByRole("heading", { name: /灰烬竞技场/ })).toBeVisible();
  await expect(page.getByText("进入第一个琥珀训练环")).toBeVisible();
  await expect(page.getByText("105 / 105")).toBeVisible();
  await expect(page.locator("[data-game-canvas]")).toHaveCount(1);
  await expect(page.locator("[data-weapon]")).toHaveText("誓约刃");
  await expect(page.locator("[data-action]")).toHaveText("待机");

  await page.keyboard.press("Digit2");
  await expect(page.locator("[data-weapon]")).toHaveText("余烬弓");
  await page.locator("[data-game-canvas]").click({ position: { x: 80, y: 80 } });
  await expect(page.locator("[data-action]")).toHaveText("攻击");
  await expect
    .poll(async () => (await snapshot(page)).weaponId)
    .toBe("ember-bow");
  await expect
    .poll(async () => (await snapshot(page)).action)
    .toBe("idle");

  const pixels = await page.locator("[data-game-canvas]").evaluate(
    (canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return { colored: 0, samples: 0 };
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const data = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
      let colored = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (
          data[index] !== data[0] ||
          data[index + 1] !== data[1] ||
          data[index + 2] !== data[2]
        ) colored += 1;
      }
      return { colored, samples: width * height };
    },
  );
  expect(pixels.colored).toBeGreaterThan(pixels.samples * 0.01);

  const before = await snapshot(page);
  await page.keyboard.down("w");
  await page.waitForTimeout(350);
  await page.keyboard.up("w");
  const after = await snapshot(page);
  expect(after.player.z).toBeGreaterThan(before.player.z + 0.5);
  expect(after.cameraTarget.z).toBeGreaterThan(before.cameraTarget.z);
  expect(after.canvasCount).toBe(1);
  expect(after.preserveDrawingBuffer).toBe(true);
  expect(after.localLights).toHaveLength(4);
  expect(
    after.localLights.every(
      ({ attached, emitterVisible, emitterId }) =>
        attached && emitterVisible && emitterId.startsWith("emitter-"),
    ),
  ).toBe(true);
});

test("production defaults keep review diagnostics private and portrait controls reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=fresh");
  expect(
    await page.evaluate(() => window.__ashfallDiagnostics),
  ).toBeUndefined();
  expect(
    await page.locator("[data-game-canvas]").evaluate(
      (canvas: HTMLCanvasElement) =>
        (canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
          ?.getContextAttributes()?.preserveDrawingBuffer,
    ),
  ).toBe(false);

  await expect(page.getByLabel("移动摇杆")).toBeVisible();
  for (const name of [
    "攻击",
    "格挡",
    "闪避",
    "目标锁定",
    "切换武器",
    "治疗",
    "暂停",
  ]) {
    const control = page.getByRole("button", { name });
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("edge input and interruption paths never leave authoritative movement stuck", async ({
  page,
}) => {
  await installDeterministicGamepad(page);
  await page.goto("/?fixture=fresh&reviewControls=1");

  await page.keyboard.down("Escape");
  await page.waitForTimeout(120);
  expect((await snapshot(page)).paused).toBe(true);
  await page.waitForTimeout(450);
  expect((await snapshot(page)).paused).toBe(true);
  await page.keyboard.up("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  expect((await snapshot(page)).paused).toBe(false);

  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const afterBlur = await snapshot(page);
  await page.waitForTimeout(220);
  const settledAfterBlur = await snapshot(page);
  expect(settledAfterBlur.player.z - afterBlur.player.z).toBeLessThan(0.1);
  await page.keyboard.up("w");

  await page.evaluate(() => window.__setAshfallTestGamepad(true, -1));
  const beforePad = await snapshot(page);
  await page.waitForTimeout(220);
  const withPad = await snapshot(page);
  expect(withPad.player.z).toBeGreaterThan(beforePad.player.z + 0.4);

  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const blurredPad = await snapshot(page);
  await page.waitForTimeout(220);
  const afterPadBlur = await snapshot(page);
  expect(afterPadBlur.player.z - blurredPad.player.z).toBeLessThan(0.1);

  await page.evaluate(() => window.__setAshfallTestGamepad(true, 0));
  await page.waitForTimeout(80);
  await page.evaluate(() => window.__setAshfallTestGamepad(true, -1));
  const rearmed = await snapshot(page);
  await page.waitForTimeout(180);
  const afterRearm = await snapshot(page);
  expect(afterRearm.player.z).toBeGreaterThan(rearmed.player.z + 0.3);

  await page.evaluate(() => window.__setAshfallTestGamepad(true, 0));
  const centered = await snapshot(page);
  await page.waitForTimeout(220);
  const afterCenter = await snapshot(page);
  expect(afterCenter.player.z - centered.player.z).toBeLessThan(0.1);

  await page.evaluate(() => {
    window.__setAshfallTestGamepad(false);
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  const disconnected = await snapshot(page);
  await page.waitForTimeout(220);
  const afterDisconnect = await snapshot(page);
  expect(afterDisconnect.player.z - disconnected.player.z).toBeLessThan(0.1);

  expect(
    await page.evaluate(() => {
      const canvas = document.querySelector("[data-game-canvas]")!;
      const outside = document.querySelector(".arena-header")!;
      const canvasEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      const outsideEvent = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      canvas.dispatchEvent(canvasEvent);
      outside.dispatchEvent(outsideEvent);
      return {
        canvasPrevented: canvasEvent.defaultPrevented,
        outsidePrevented: outsideEvent.defaultPrevented,
      };
    }),
  ).toEqual({ canvasPrevented: true, outsidePrevented: false });

  await page.locator("[data-game-canvas]").dispatchEvent("pointerdown", {
    pointerId: 42,
    pointerType: "mouse",
    button: 2,
  });
  expect((await snapshot(page)).input.guardHeld).toBe(true);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 42,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );
  expect((await snapshot(page)).input.guardHeld).toBe(false);

  for (const [pointerId, interruption] of [
    [43, "pointercancel"],
    [44, "blur"],
    [45, "visibilitychange"],
  ] as const) {
    await page.locator("[data-game-canvas]").dispatchEvent("pointerdown", {
      pointerId,
      pointerType: "mouse",
      button: 2,
    });
    expect((await snapshot(page)).input.guardHeld).toBe(true);
    await page.evaluate(
      ({ id, kind }) => {
        if (kind === "pointercancel") {
          window.dispatchEvent(
            new PointerEvent("pointercancel", {
              pointerId: id,
              pointerType: "mouse",
              button: 2,
            }),
          );
        } else if (kind === "blur") {
          window.dispatchEvent(new Event("blur"));
        } else {
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "hidden",
          });
          document.dispatchEvent(new Event("visibilitychange"));
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            value: "visible",
          });
        }
      },
      { id: pointerId, kind: interruption },
    );
    expect((await snapshot(page)).input.guardHeld).toBe(false);
  }
});

test("an idle connected gamepad never cancels mouse or touch guard ownership", async ({
  page,
}) => {
  await installDeterministicGamepad(page);
  await page.goto("/?fixture=fresh&reviewControls=1");
  await page.evaluate(() => window.__setAshfallTestGamepad(true, 0, false));
  await page.waitForTimeout(100);

  await page.locator("[data-game-canvas]").dispatchEvent("pointerdown", {
    pointerId: 61,
    pointerType: "mouse",
    button: 2,
  });
  await page.waitForTimeout(240);
  expect((await snapshot(page)).input.guardHeld).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.dataset.inputMode),
  ).toBe("keyboard-mouse");
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 61,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );
  expect((await snapshot(page)).input.guardHeld).toBe(false);

  const touchGuard = page.locator("[data-touch-held='guardHeld']");
  await touchGuard.dispatchEvent("pointerdown", {
    pointerId: 62,
    pointerType: "touch",
    button: 0,
  });
  await page.waitForTimeout(240);
  expect((await snapshot(page)).input.guardHeld).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.dataset.inputMode),
  ).toBe("touch");
  await touchGuard.dispatchEvent("pointerup", {
    pointerId: 62,
    pointerType: "touch",
    button: 0,
  });
  expect((await snapshot(page)).input.guardHeld).toBe(false);

  await page.evaluate(() => window.__setAshfallTestGamepad(true, 0, true));
  await expect
    .poll(async () => (await snapshot(page)).input.guardHeld)
    .toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.dataset.inputMode),
  ).toBe("gamepad");
  await page.evaluate(() => window.__setAshfallTestGamepad(true, 0, false));
  await expect
    .poll(async () => (await snapshot(page)).input.guardHeld)
    .toBe(false);

  await page.locator("[data-game-canvas]").dispatchEvent("pointerdown", {
    pointerId: 63,
    pointerType: "mouse",
    button: 2,
  });
  await page.waitForTimeout(240);
  expect((await snapshot(page)).input.guardHeld).toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.dataset.inputMode),
  ).toBe("keyboard-mouse");
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 63,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );
  expect((await snapshot(page)).input.guardHeld).toBe(false);
});

test("mouse and touch actions atomically stop stale gamepad movement", async ({
  page,
}) => {
  await installDeterministicGamepad(page);
  await page.goto("/?fixture=fresh&reviewControls=1");
  const canvas = page.locator("[data-game-canvas]");
  const touchGuard = page.locator("[data-touch-held='guardHeld']");

  const startPadMovement = async () => {
    const before = await snapshot(page);
    await page.evaluate(() => window.__setAshfallTestGamepad(true, -1, false));
    await expect
      .poll(async () => (await snapshot(page)).player.z)
      .toBeGreaterThan(before.player.z + 0.3);
  };
  const expectStoppedWithGuard = async () => {
    const stopped = await snapshot(page);
    await page.waitForTimeout(240);
    const settled = await snapshot(page);
    expect(settled.player.z - stopped.player.z).toBeLessThan(0.1);
    expect(settled.input).toMatchObject({
      moveX: 0,
      moveY: 0,
      guardHeld: true,
    });
  };

  await startPadMovement();
  await canvas.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 71,
        pointerType: "mouse",
        button: 2,
      }),
    );
    window.__setAshfallTestGamepad(true, 0, false);
  });
  await expectStoppedWithGuard();
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 71,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );
  expect((await snapshot(page)).input.guardHeld).toBe(false);

  await startPadMovement();
  await touchGuard.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 72,
        pointerType: "touch",
        button: 0,
      }),
    );
    window.__setAshfallTestGamepad(true, 0, false);
  });
  await expectStoppedWithGuard();
  await touchGuard.dispatchEvent("pointerup", {
    pointerId: 72,
    pointerType: "touch",
    button: 0,
  });
  expect((await snapshot(page)).input.guardHeld).toBe(false);

  await startPadMovement();
  await canvas.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 73,
        pointerType: "mouse",
        button: 2,
      }),
    );
    window.__setAshfallTestGamepad(false, 0, false);
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  await expectStoppedWithGuard();
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 73,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );
  expect((await snapshot(page)).input.guardHeld).toBe(false);

  await startPadMovement();
  await touchGuard.evaluate((element) => {
    element.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 74,
        pointerType: "touch",
        button: 0,
      }),
    );
    window.__setAshfallTestGamepad(false, 0, false);
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  await expectStoppedWithGuard();
  await touchGuard.dispatchEvent("pointerup", {
    pointerId: 74,
    pointerType: "touch",
    button: 0,
  });
  expect((await snapshot(page)).input.guardHeld).toBe(false);
});

test("idle or disconnected gamepads preserve active keyboard and touch movement", async ({
  page,
}) => {
  await installDeterministicGamepad(page);
  await page.goto("/?fixture=fresh&reviewControls=1");

  await page.keyboard.down("w");
  const keyboardStart = await snapshot(page);
  await page.evaluate(() => window.__setAshfallTestGamepad(true, 0, false));
  await page.waitForTimeout(220);
  const keyboardWithIdlePad = await snapshot(page);
  expect(keyboardWithIdlePad.player.z).toBeGreaterThan(
    keyboardStart.player.z + 0.3,
  );
  await page.evaluate(() => {
    window.__setAshfallTestGamepad(false, 0, false);
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  const keyboardBeforeDisconnect = await snapshot(page);
  await page.waitForTimeout(220);
  expect((await snapshot(page)).player.z).toBeGreaterThan(
    keyboardBeforeDisconnect.player.z + 0.3,
  );
  await page.keyboard.up("w");

  const stick = page.locator(".touch-stick");
  const stickBox = await stick.boundingBox();
  expect(stickBox).not.toBeNull();
  await page.mouse.move(
    stickBox!.x + stickBox!.width / 2,
    stickBox!.y + 8,
  );
  await page.mouse.down();
  const touchStart = await snapshot(page);
  await page.evaluate(() => window.__setAshfallTestGamepad(true, 0, false));
  await page.waitForTimeout(220);
  const touchWithIdlePad = await snapshot(page);
  expect(touchWithIdlePad.player.z).toBeGreaterThan(touchStart.player.z + 0.3);
  await page.evaluate(() => {
    window.__setAshfallTestGamepad(false, 0, false);
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  const touchBeforeDisconnect = await snapshot(page);
  await page.waitForTimeout(220);
  expect((await snapshot(page)).player.z).toBeGreaterThan(
    touchBeforeDisconnect.player.z + 0.3,
  );

  await stick.dispatchEvent("pointercancel", {
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
  });
  await page.mouse.up();
  expect((await snapshot(page)).input).toMatchObject({
    moveX: 0,
    moveY: 0,
    guardHeld: false,
  });

  await page.keyboard.down("w");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });
  expect((await snapshot(page)).input).toMatchObject({
    moveX: 0,
    moveY: 0,
    guardHeld: false,
  });
  await page.keyboard.up("w");
});

test("production camera path consumes occlusion, lock, and shake events", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1");
  const initial = await snapshot(page);
  expect(initial.camera.occlusionLimited).toBe(false);
  expect(initial.camera.lockFraming).toBe(false);

  await page.keyboard.down("w");
  await expect
    .poll(async () => (await snapshot(page)).camera.occlusionLimited)
    .toBe(true);
  await page.keyboard.up("w");
  const occluded = await snapshot(page);
  expect(occluded.camera.resolvedDistance).toBeLessThan(
    occluded.camera.desiredDistance,
  );

  const canvas = page.locator("[data-game-canvas]");
  await canvas.dispatchEvent("pointerdown", {
    pointerId: 92,
    pointerType: "mouse",
    button: 2,
  });
  await expect
    .poll(async () => (await snapshot(page)).action)
    .toBe("guard");
  const unlockedTarget = occluded.camera.target;
  await page.keyboard.press("q");
  await expect
    .poll(async () => (await snapshot(page)).lockTargetId)
    .toBe("training-crawler");
  const locked = await snapshot(page);
  expect(locked.camera.lockFraming).toBe(true);
  expect(locked.camera.target).not.toEqual(unlockedTarget);

  await page.keyboard.press("q");
  await expect
    .poll(async () => (await snapshot(page)).camera.lockFraming)
    .toBe(false);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 92,
        pointerType: "mouse",
        button: 2,
      }),
    ),
  );

  await page.evaluate(() =>
    window.__ashfallDiagnostics!.triggerCameraShake(),
  );
  await expect
    .poll(async () => (await snapshot(page)).camera.shakeAmplitude)
    .toBeGreaterThan(0);
});

test("production camera reports the blocker containing its offset target", async ({
  page,
}) => {
  await page.goto("/?fixture=fresh&reviewControls=1");

  await page.keyboard.down("d");
  await expect.poll(
    async () => (await snapshot(page)).player.x,
    { intervals: [16], timeout: 5_000 },
  )
    .toBeGreaterThan(4.9);
  await page.keyboard.up("d");
  await page.keyboard.down("w");
  await expect.poll(
    async () => (await snapshot(page)).player.z,
    { intervals: [16], timeout: 5_000 },
  )
    .toBeGreaterThan(1.15);
  await page.keyboard.up("w");

  await expect
    .poll(async () => (await snapshot(page)).camera.occluderId)
    .toBe("collision-east-brazier-bank");
  const nearBlocker = await snapshot(page);
  expect(nearBlocker.player.x).toBeLessThan(5.5);
  expect(nearBlocker.player.z).toBeLessThan(1.8);
  expect(nearBlocker.camera.resolvedDistance).toBeLessThan(
    nearBlocker.camera.desiredDistance,
  );
});

test("reduced motion suppresses the real review shake event", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=fresh&reviewControls=1");
  await page.evaluate(() =>
    window.__ashfallDiagnostics!.triggerCameraShake(),
  );
  await page.waitForTimeout(80);
  const state = await snapshot(page);
  expect(state.camera.reducedMotion).toBe(true);
  expect(state.camera.shakeAmplitude).toBe(0);
});

test("pagehide stops the frame loop and releases the runtime once", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    window.__ashfallCancelledFrames = 0;
    window.cancelAnimationFrame = (handle: number) => {
      window.__ashfallCancelledFrames += 1;
      nativeCancel(handle);
    };
  });
  await page.goto("/?fixture=fresh&reviewControls=1");
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );

  const firstDispose = await page.evaluate(() => ({
    disposed: document.documentElement.dataset.runtimeDisposed,
    diagnosticsPresent: "__ashfallDiagnostics" in window,
    cancelledFrames: window.__ashfallCancelledFrames,
  }));
  expect(firstDispose).toMatchObject({
    disposed: "true",
    diagnosticsPresent: false,
  });
  expect(firstDispose.cancelledFrames).toBeGreaterThanOrEqual(1);
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  expect(await page.evaluate(() => window.__ashfallCancelledFrames)).toBe(
    firstDispose.cancelledFrames,
  );
});

declare global {
  interface Window {
    __setAshfallTestGamepad(
      enabled: boolean,
      verticalAxis?: number,
      guardHeld?: boolean,
    ): void;
    __ashfallCancelledFrames: number;
  }
}
