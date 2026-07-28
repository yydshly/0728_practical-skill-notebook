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

test("fresh start renders a live arena and moves authoritative state", async ({
  page,
}) => {

  await page.goto("/?fixture=fresh");
  await expect(page.getByRole("heading", { name: /灰烬竞技场/ })).toBeVisible();
  await expect(page.getByText("进入第一个琥珀训练环")).toBeVisible();
  await expect(page.getByText("105 / 105")).toBeVisible();
  await expect(page.locator("[data-game-canvas]")).toHaveCount(1);

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

  const before = await page.evaluate(() => window.__ashfallDiagnostics.snapshot());
  await page.keyboard.down("w");
  await page.waitForTimeout(350);
  await page.keyboard.up("w");
  const after = await page.evaluate(() => window.__ashfallDiagnostics.snapshot());
  expect(after.player.z).toBeGreaterThan(before.player.z + 0.5);
  expect(after.cameraTarget.z).toBeGreaterThan(before.cameraTarget.z);
  expect(after.canvasCount).toBe(1);
  expect(after.localLights).toHaveLength(4);
  expect(
    after.localLights.every(
      ({ attached, emitterVisible, emitterId }) =>
        attached && emitterVisible && emitterId.startsWith("emitter-"),
    ),
  ).toBe(true);
});

test("touch baseline has reachable controls and no portrait overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?fixture=fresh");

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
  await page.addInitScript(() => {
    let active = false;
    const buttons = Array.from({ length: 16 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    const gamepad = {
      axes: [0, -1, 0, 0],
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
    window.__setAshfallTestGamepad = (enabled: boolean) => {
      active = enabled;
    };
  });
  await page.goto("/?fixture=fresh");

  await page.keyboard.down("Escape");
  await page.waitForTimeout(120);
  expect(
    (await page.evaluate(() => window.__ashfallDiagnostics.snapshot())).paused,
  ).toBe(true);
  await page.waitForTimeout(450);
  expect(
    (await page.evaluate(() => window.__ashfallDiagnostics.snapshot())).paused,
  ).toBe(true);
  await page.keyboard.up("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  expect(
    (await page.evaluate(() => window.__ashfallDiagnostics.snapshot())).paused,
  ).toBe(false);

  await page.keyboard.down("w");
  await page.waitForTimeout(120);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const afterBlur = await page.evaluate(() =>
    window.__ashfallDiagnostics.snapshot(),
  );
  await page.waitForTimeout(220);
  const settledAfterBlur = await page.evaluate(() =>
    window.__ashfallDiagnostics.snapshot(),
  );
  expect(settledAfterBlur.player.z - afterBlur.player.z).toBeLessThan(0.1);
  await page.keyboard.up("w");

  await page.evaluate(() => window.__setAshfallTestGamepad(true));
  const beforePad = await page.evaluate(() =>
    window.__ashfallDiagnostics.snapshot(),
  );
  await page.waitForTimeout(220);
  const withPad = await page.evaluate(() =>
    window.__ashfallDiagnostics.snapshot(),
  );
  expect(withPad.player.z).toBeGreaterThan(beforePad.player.z + 0.4);

  await page.evaluate(() => {
    window.__setAshfallTestGamepad(false);
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  const disconnected = await page.evaluate(() =>
    window.__ashfallDiagnostics.snapshot(),
  );
  await page.waitForTimeout(220);
  const afterDisconnect = await page.evaluate(() =>
    window.__ashfallDiagnostics.snapshot(),
  );
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
  await page.goto("/?fixture=fresh");
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
    __ashfallDiagnostics: {
      snapshot(): {
        player: { x: number; z: number };
        cameraTarget: { x: number; z: number };
        canvasCount: number;
        tick: number;
        droppedSeconds: number;
        paused: boolean;
        localLights: Array<{
          id: string;
          emitterId: string;
          attached: boolean;
          emitterVisible: boolean;
        }>;
      };
    };
    __setAshfallTestGamepad(enabled: boolean): void;
    __ashfallCancelledFrames: number;
  }
}
