import { chromium } from "@playwright/test";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PNG } from "pngjs";

const ids = ["ash-warden", "glass-crawler", "bell-knight", "mire-hound"];
const argument = process.argv.find((value) => value.startsWith("--base-url="))?.slice("--base-url=".length);
const configuredBaseUrl = argument ?? process.env.MONSTER_FORGE_CAPTURE_BASE_URL ?? "http://127.0.0.1:4173";
const baseUrl = new URL(configuredBaseUrl);
if (!(["127.0.0.1", "localhost"].includes(baseUrl.hostname) && ["http:", "https:"].includes(baseUrl.protocol))) {
  throw new Error("Capture base URL must be a local http(s) address on 127.0.0.1 or localhost.");
}
baseUrl.pathname = "/";
baseUrl.search = "";
baseUrl.hash = "";

const output = resolve("public/asset-catalog/monsters");
const staging = join(tmpdir(), `monster-forge-catalog-${process.pid}-${Date.now()}`);
await mkdir(staging, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  for (const id of ids) {
    const reviewUrl = new URL(baseUrl);
    reviewUrl.searchParams.set("review", id);
    reviewUrl.searchParams.set("capture", "1");
    await page.goto(reviewUrl.toString(), { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.documentElement.dataset.captureReady === "true");
    const canvas = page.locator("[data-inspector] canvas");
    const stagedPng = join(staging, `${id}.png`);
    const box = await canvas.boundingBox();
    if (!box || Math.round(box.width) !== 512 || Math.round(box.height) !== 512) throw new Error(`${id} capture canvas was not 512x512.`);
    // Keep a Playwright capture in the staging area for capture-path auditing.
    await page.screenshot({ path: stagedPng, clip: box, omitBackground: true });
    const dataUrl = await canvas.evaluate((node) => node.toDataURL("image/png"));
    const encoded = dataUrl.split(",", 2)[1];
    if (!encoded) throw new Error(`${id} canvas did not produce a PNG data URL.`);
    await writeFile(stagedPng, Buffer.from(encoded, "base64"));
    const decoded = PNG.sync.read(await readFile(stagedPng));
    await writeFile(stagedPng, PNG.sync.write(decoded, { colorType: 6, inputColorType: 6 }));
  }
  if (pageErrors.length) throw new Error(`Capture page errors: ${pageErrors.join(" | ")}`);
  await mkdir(output, { recursive: true });
  for (const id of ids) await cp(join(staging, `${id}.png`), join(output, `${id}.png`));
  console.log(`Captured ${ids.length} transparent catalog previews from ${baseUrl.toString()}`);
} finally {
  await browser.close();
  await rm(staging, { recursive: true, force: true });
}
