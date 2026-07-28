import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const baseURL = "http://127.0.0.1:4174";
const evidenceDir = path.join(packageRoot, "test-results", "scripted");

const capabilities = [
  {
    label: "沉浸式叙事",
    title: "让产品故事可以被亲手探索",
    href: "../isle-of-quiet-signals/",
  },
  {
    label: "互动活动",
    title: "让访客参与，而不只是观看",
    href: "../world-cup-letter-flags-demo/",
  },
  {
    label: "产品原型",
    title: "让决策在真实界面中发生",
    href: "../fabrica-template-detail-clone/",
  },
];

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

async function serverIsReady() {
  try {
    const response = await fetch(baseURL);
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await serverIsReady()) return null;

  const viteEntry = path.join(
    packageRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  const child = spawn(
    process.execPath,
    [viteEntry, "--host", "127.0.0.1", "--port", "4174"],
    {
      cwd: packageRoot,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  let serverError = "";
  child.stderr.on("data", (chunk) => {
    serverError += chunk.toString();
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverIsReady()) return child;
    if (child.exitCode !== null) {
      throw new Error(`Vite 服务启动失败：${serverError.trim()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill();
  throw new Error(`等待 Vite 服务超时：${serverError.trim()}`);
}

async function verify() {
  await mkdir(evidenceDir, { recursive: true });
  const server = await startServer();
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "gpu", {
        configurable: true,
        get: () => undefined,
      });
    });

    await page.goto(baseURL, { waitUntil: "networkidle" });

    for (const capability of capabilities) {
      await page
        .getByRole("region", { name: "能力展品" })
        .getByRole("button", { name: capability.label, exact: true })
        .click();
      await page
        .getByRole("heading", { name: capability.title })
        .waitFor({ state: "visible" });

      const caseHref = await page
        .getByRole("link", { name: "查看案例" })
        .getAttribute("href");
      requireValue(
        caseHref === capability.href,
        `${capability.label} 的案例链接不正确：${caseHref}`,
      );
      await access(path.resolve(packageRoot, caseHref));
    }

    for (const view of ["概览", "交互", "案例"]) {
      const button = page.getByRole("button", { name: view });
      await button.click();
      requireValue(
        (await button.getAttribute("aria-pressed")) === "true",
        `无法切换到${view}视角`,
      );
    }

    const canvas = page.locator("canvas");
    await canvas.waitFor({ state: "visible" });
    const bounds = requireValue(await canvas.boundingBox(), "找不到可拖动的三维画布");
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width * 0.66,
      bounds.y + bounds.height * 0.42,
      { steps: 10 },
    );
    await page.mouse.up();

    const captureButton = page.getByRole("button", { name: "保存当前画面" });
    await captureButton.waitFor({ state: "visible" });
    requireValue(await captureButton.isEnabled(), "保存当前画面按钮不可用");
    const downloadPromise = page.waitForEvent("download");
    await captureButton.click();
    const download = await downloadPromise;
    requireValue(
      download.suggestedFilename().endsWith(".png"),
      "保存当前画面没有生成 PNG 文件",
    );

    await page.screenshot({
      path: path.join(evidenceDir, "desktop-showroom.png"),
      fullPage: true,
    });

    if (consoleErrors.length > 0) {
      throw new Error(`浏览器控制台出现错误：\n${consoleErrors.join("\n")}`);
    }

    console.log(
      `Showcase verified: ${capabilities.length} capabilities, 3 views, drag, PNG capture, 0 console errors.`,
    );
  } finally {
    await browser?.close();
    server?.kill();
  }
}

verify().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
