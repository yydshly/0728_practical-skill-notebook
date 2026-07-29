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
  await expect.poll(() => page.evaluate(() =>
    window.__ashfallDiagnostics?.snapshot().performance.renderer.calls,
  )).toBe(0);

  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide"))
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-runtime-disposed",
    "true",
  );
  expect(pageErrors).toEqual([]);
  expect(unexpectedConsoleErrors).toEqual([]);
});
