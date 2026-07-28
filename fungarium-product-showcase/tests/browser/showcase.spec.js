import { test, expect } from "@playwright/test";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const capabilities = [
  {
    button: "沉浸式叙事",
    heading: "让产品故事可以被亲手探索",
    href: "../isle-of-quiet-signals/",
    caseTitle: /雾屿灯塔/,
  },
  {
    button: "互动活动",
    heading: "让访客参与，而不只是观看",
    href: "../world-cup-letter-flags-demo/",
    caseTitle: /Final Four/,
  },
  {
    button: "产品原型",
    heading: "让决策在真实界面中发生",
    href: "../fabrica-template-detail-clone/",
    caseTitle: /Fabrica template detail/,
  },
];

const deployedShowcase =
  "http://127.0.0.1:4178/fungarium-product-showcase/";

function collectRuntimeErrors(page, errors = []) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(
        `console: ${message.text()} (${message.location().url || "unknown"})`,
      );
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
  return errors;
}

async function useWebGlFallback(page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "gpu", {
      configurable: true,
      get: () => undefined,
    });
  });
}

if (process.env.VITEST) {
  globalThis.test.skip("Playwright browser checks run through npm run test:browser");
} else {
  test.beforeEach(async ({ page }) => {
    await useWebGlFallback(page);
  });

  test("a visitor can select every capability and preserve the active view", async ({
    page,
    context,
  }, testInfo) => {
    const errors = collectRuntimeErrors(page);

    await page.goto(deployedShowcase);
    await page.getByRole("button", { name: "案例" }).click();

    for (const capability of capabilities) {
      await page
        .getByRole("region", { name: "能力展品" })
        .getByRole("button", { name: capability.button, exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: capability.heading }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "案例" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      const caseLink = page.getByRole("link", { name: "查看案例" });
      await expect(caseLink).toHaveAttribute("href", capability.href);
      await access(path.resolve(packageRoot, capability.href));
    }

    const deploymentPage = await context.newPage();
    await useWebGlFallback(deploymentPage);
    collectRuntimeErrors(deploymentPage, errors);
    for (const capability of capabilities) {
      await deploymentPage.goto(deployedShowcase);
      await deploymentPage
        .getByRole("region", { name: "能力展品" })
        .getByRole("button", { name: capability.button, exact: true })
        .click();

      const caseLink = deploymentPage.getByRole("link", {
        name: "查看案例",
      });
      await expect(caseLink).toHaveAttribute("href", capability.href);
      const expectedCaseUrl = new URL(capability.href, deployedShowcase).href;
      const navigationPromise = deploymentPage.waitForNavigation();
      await caseLink.click();
      const response = await navigationPromise;
      expect(response?.ok()).toBe(true);
      await expect(deploymentPage).toHaveURL(expectedCaseUrl);
      await expect(deploymentPage).toHaveTitle(capability.caseTitle);
      await expect(deploymentPage.locator("body")).toBeVisible();
      expect(
        (await deploymentPage.locator("body").innerText()).trim().length,
      ).toBeGreaterThan(50);
    }
    await deploymentPage.close();

    await page
      .getByRole("region", { name: "能力展品" })
      .getByRole("button", { name: "产品原型", exact: true })
      .click();
    await page.screenshot({
      path: testInfo.outputPath("showroom.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

  test("a visitor can switch views, drag the artifact, and save the canvas", async ({
    page,
  }) => {
    const errors = collectRuntimeErrors(page);

    await page.goto(deployedShowcase);
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    for (const view of ["概览", "交互", "案例"]) {
      const viewButton = page.getByRole("button", { name: view });
      await viewButton.click();
      await expect(viewButton).toHaveAttribute("aria-pressed", "true");
    }

    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width * 0.65,
      bounds.y + bounds.height * 0.4,
      { steps: 8 },
    );
    await page.mouse.up();

    const captureButton = page.getByRole("button", { name: "保存当前画面" });
    await expect(captureButton).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await captureButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^product-showcase-.+\.png$/);

    expect(errors).toEqual([]);
  });
}
