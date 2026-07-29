import {
  expect,
  test as base,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";
import { readPngDimensions, readPngEvidence } from "./helpers/read-png-dimensions";

const test = base.extend<{ cleanPage: Page }>({
  cleanPage: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const missingResources: string[] = [];
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() === 404) missingResources.push(response.url());
    });
    await use(page);
    expect(consoleErrors, "浏览器控制台不应出现错误").toEqual([]);
    expect(pageErrors, "页面不应抛出运行时错误").toEqual([]);
    expect(missingResources, "页面不应请求 404 资源").toEqual([]);
  },
});

test("导出真实当前装配的1600x1200 PNG且不改变现场状态", async ({
  cleanPage: page,
}, testInfo) => {
  await page.goto(
    "/?v=1&c=oracle-frame&h=halo-head&a=void-weave&lw=drone-rack&rw=rail-lance&r=field-relay&e=dusk&reviewControls=1",
  );
  const beforeUrl = page.url();
  const before = await sceneSnapshot(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出产品海报" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "mech-atelier-oracle-frame-halo-head.png",
  );
  const path = await download.path();
  if (!path) throw new Error("Poster download has no local path");
  await download.saveAs(
    process.env.MECH_POSTER_EVIDENCE ??
      testInfo.outputPath("mech-atelier-poster.png"),
  );

  expect(await readPngDimensions(path)).toEqual({ width: 1600, height: 1200 });
  const evidence = await readPngEvidence(path);
  expect(evidence.signature).toBe("89504e470d0a1a0a");
  expect(evidence.uniqueSampledColors).toBeGreaterThan(350);
  expect(evidence.productEdgePixels).toBeGreaterThan(180);
  await testInfo.attach("poster-pixel-evidence.json", {
    body: JSON.stringify(evidence, null, 2),
    contentType: "application/json",
  });

  const metadata = await page.evaluate(() => (
    window as unknown as {
      __MECH_ATELIER_DEBUG__?: {
        lastPosterMetadata(): {
          chassisId: string;
          configurationName: string;
          moduleNames: string[];
          canonicalUrl: string;
        } | null;
      };
    }
  ).__MECH_ATELIER_DEBUG__!.lastPosterMetadata());
  expect(metadata).toMatchObject({
    chassisId: "oracle-frame",
    configurationName: "神谕框架 · 光环头部方案",
    moduleNames: [
      "光环头部",
      "虚空编织装甲",
      "无人机架",
      "磁轨长枪",
      "战场中继器",
    ],
  });
  expect(metadata!.canonicalUrl).toContain(
    "?v=1&c=oracle-frame&h=halo-head&a=void-weave",
  );
  expect(page.url()).toBe(beforeUrl);
  expect(await sceneSnapshot(page)).toEqual(before);
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-poster-status]")).toHaveText(
    "产品海报已导出。",
  );
});

test("PNG 编码失败显示中文可操作错误且重试成功不产生空下载", async ({
  cleanPage: page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let shouldFail = true;
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      if (shouldFail) {
        shouldFail = false;
        args[0](null);
        return;
      }
      return original.apply(this, args);
    };
  });
  await page.goto("/?reviewControls=1");
  const button = page.getByRole("button", { name: "导出产品海报" });
  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });

  await button.click();
  await expect(page.locator("[data-poster-status]")).toContainText(
    "海报导出失败",
  );
  await expect(page.locator("[data-poster-status]")).toContainText(
    "请重试",
  );
  expect(downloads).toBe(0);
  await expect(button).toBeEnabled();
  await expect(page.locator("[data-product-canvas]")).toHaveCount(1);

  const downloadPromise = page.waitForEvent("download");
  await button.click();
  const download = await downloadPromise;
  expect(await download.path()).not.toBeNull();
  await expect(page.locator("[data-poster-status]")).toHaveText(
    "产品海报已导出。",
  );
});

interface SceneSnapshot {
  rendererId: number;
  canvasId: number;
  sceneId: number;
  assemblyId: number;
  camera: unknown;
  parts: unknown;
  exploded: unknown;
}

async function sceneSnapshot(page: Page): Promise<SceneSnapshot> {
  return page.evaluate(() => (
    window as unknown as {
      __MECH_ATELIER_DEBUG__?: { snapshot(): SceneSnapshot };
    }
  ).__MECH_ATELIER_DEBUG__!.snapshot());
}
