import { expect, test } from "@playwright/test";

test("a real WebGLRenderer construction failure keeps a truthful Chinese information fallback", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const unexpectedConsoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("Error creating WebGL context")
    ) {
      unexpectedConsoleErrors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("ashfall-arena:v1", "fallback-sentinel");
    const NativeAudioContext = window.AudioContext;
    let audioContextCreates = 0;
    const WrappedAudioContext = function () {
      audioContextCreates += 1;
      return new NativeAudioContext();
    } as unknown as typeof AudioContext;
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: WrappedAudioContext,
    });
    (
      window as unknown as {
        __fallbackAudioContextCreates(): number;
      }
    ).__fallbackAudioContextCreates = () => audioContextCreates;
    HTMLCanvasElement.prototype.getContext = function () {
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/?fixture=fresh&reviewControls=1&safeTraining=1");

  const fallback = page.locator("[data-runtime-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback.getByRole("heading")).toHaveText("3D 画面不可用");
  await expect(fallback).toContainText(
    "当前浏览器未能创建 WebGL 渲染器，实时战斗画面没有启动",
  );
  await expect(fallback).toContainText("训练阶段");
  await expect(fallback.locator("dl")).toContainText("105 / 105");
  await expect(page.getByText("进入第一个琥珀训练环")).toBeVisible();
  await expect(page.locator("[data-game-canvas]")).toBeHidden();
  await expect(page.locator("[data-health]")).toHaveText("105 / 105");
  await expect(page.locator(".audio-settings")).toHaveAttribute(
    "disabled",
    "",
  );
  for (const input of await page.locator(".audio-settings input").all()) {
    await expect(input).toBeDisabled();
  }

  const before = await page.evaluate(() => {
    const diagnostics = window.__ashfallDiagnostics!;
    const snapshot = diagnostics.snapshot();
    return {
      runtimeMode: (
        snapshot as typeof snapshot & {
          runtimeMode: "live" | "information-fallback";
        }
      ).runtimeMode,
      frameCount: snapshot.frameCount,
      tick: snapshot.tick,
      player: snapshot.player,
      state: diagnostics.getSerializableState(),
      save: localStorage.getItem("ashfall-arena:v1"),
      renderer: snapshot.performance.renderer,
      listeners: snapshot.performance.lifecycle.listenerRegistrations,
    };
  });
  expect(before).toMatchObject({
    runtimeMode: "information-fallback",
    frameCount: 0,
    tick: 0,
    save: "fallback-sentinel",
    renderer: {
      submittedFrames: 0,
      calls: 0,
      geometries: 0,
      textures: 0,
    },
  });
  expect(before.listeners).toBeLessThanOrEqual(1);

  await page.keyboard.down("KeyW");
  await page.waitForTimeout(350);
  await page.keyboard.up("KeyW");
  await page.getByRole("heading", { name: "灰烬竞技场" }).click();
  const after = await page.evaluate(() => {
    const diagnostics = window.__ashfallDiagnostics!;
    const snapshot = diagnostics.snapshot();
    let inputError = "";
    try {
      diagnostics.setManualReviewClock(true);
      diagnostics.advanceInput({ moveY: 1 }, 30);
    } catch (error) {
      inputError = error instanceof Error ? error.message : String(error);
    }
    return {
      frameCount: snapshot.frameCount,
      tick: snapshot.tick,
      player: snapshot.player,
      state: diagnostics.getSerializableState(),
      save: localStorage.getItem("ashfall-arena:v1"),
      audioContextCreates: (
        window as unknown as {
          __fallbackAudioContextCreates(): number;
        }
      ).__fallbackAudioContextCreates(),
      inputError,
    };
  });
  expect(after).toEqual({
    frameCount: before.frameCount,
    tick: before.tick,
    player: before.player,
    state: before.state,
    save: before.save,
    audioContextCreates: 0,
    inputError: expect.stringContaining("静态信息模式"),
  });

  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide"))
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-runtime-disposed",
    "true",
  );
  expect(
    await page.evaluate(() =>
      window.__ashfallReleaseDisposalSnapshot,
    ),
  ).toMatchObject({
    renderer: {
      submittedFrames: 0,
      calls: 0,
      geometries: 0,
      textures: 0,
    },
    lifecycle: {
      disposed: true,
      sceneChildren: 0,
      entityRoots: 0,
      listenerRegistrations: 0,
      activePooledObjects: 0,
    },
  });
  expect(pageErrors).toEqual([]);
  expect(unexpectedConsoleErrors).toEqual([]);
});
