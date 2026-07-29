import { expect, test } from "@playwright/test";

test("production dist renders and advances the real arena runtime", async ({
  page,
}) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  const failedResponses: string[] = [];
  const productionAssets = new Set<string>();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.url()}: ${request.failure()?.errorText ?? "unknown"}`,
    );
  });
  page.on("response", (assetResponse) => {
    const url = assetResponse.url();
    if (url.includes("/assets/")) {
      productionAssets.add(url);
    }
    if (assetResponse.status() >= 400) {
      failedResponses.push(`${assetResponse.status()} ${url}`);
    }
  });

  const response = await page.goto(
    "/?fixture=fresh&reviewControls=1&capture=1",
  );
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /灰烬竞技场/ })).toBeVisible();
  await expect(page.locator("[data-game-canvas]")).toHaveCount(1);
  await expect(page.locator("[data-runtime-fallback]")).toHaveCount(0);

  const signature = await page.locator("[data-game-canvas]").evaluate(
    (canvas: HTMLCanvasElement) => {
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return { colors: 0, opaque: 0 };
      const pixels = new Uint8Array(
        gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
      );
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      const colors = new Set<string>();
      let opaque = 0;
      const stride = Math.max(
        4,
        Math.floor(pixels.length / 10_000 / 4) * 4,
      );
      for (let index = 0; index < pixels.length; index += stride) {
        const alpha = pixels[index + 3] ?? 0;
        if (alpha > 0) opaque += 1;
        colors.add(
          `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${alpha}`,
        );
      }
      return { colors: colors.size, opaque };
    },
  );
  expect(signature.colors).toBeGreaterThan(8);
  expect(signature.opaque).toBeGreaterThan(100);

  const before = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot(),
  );
  expect(before.playerRootCount).toBe(1);
  expect(before.canvasCount).toBe(1);
  await page.keyboard.down("w");
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__ashfallDiagnostics!.snapshot().player.z,
      ),
    )
    .toBeGreaterThan(before.player.z + 0.5);
  await page.keyboard.up("w");
  const after = await page.evaluate(() =>
    window.__ashfallDiagnostics!.snapshot(),
  );
  expect(after.frameCount).toBeGreaterThan(before.frameCount);
  expect(after.playerRootCount).toBe(1);
  expect(productionAssets.size).toBeGreaterThanOrEqual(5);
  expect(failedRequests).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(errors).toEqual([]);
});
