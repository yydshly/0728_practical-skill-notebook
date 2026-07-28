import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(moduleDirectory, "..", "..");
const viewport = { width: 960, height: 640 };

export const UPSTREAM_REPOSITORY = "https://github.com/nesdesignco/fungarium";
export const UPSTREAM_COMMIT = "a139bd08fc64cf0be76bd1dae447da6848d89899";
export const RECORDINGS = [
  { id: "original", output: "docs/demos/05-fungarium-original.gif" },
  { id: "showcase", output: "docs/demos/05-fungarium-product-showcase.gif" },
];

export function commandInvocation(command) {
  const usesWindowsNpm = process.platform === "win32" && command === "npm";
  return {
    command: usesWindowsNpm ? "npm.cmd" : command,
    shell: usesWindowsNpm,
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function run(command, args, { cwd }) {
  const invocation = commandInvocation(command);
  const child = spawn(invocation.command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: invocation.shell,
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  const [code] = await once(child, "close");
  if (code !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${code}.\n${output}`);
  }
  return output;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still booting.
    }
    if (child.exitCode !== null) {
      throw new Error(`Vite exited before ${url} became ready.`);
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}

async function startVite({ cwd, port }) {
  const viteEntry = path.join(cwd, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteEntry, "--host=127.0.0.1", `--port=${port}`], {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  await waitForServer(`http://127.0.0.1:${port}/`, child);
  return child;
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await once(child, "close");
}

async function saveFrames(page, frameDirectory, frameState, count = 4) {
  await mkdir(frameDirectory, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    const framePath = path.join(frameDirectory, `frame-${String(frameState.index).padStart(3, "0")}.png`);
    await page.screenshot({ path: framePath });
    frameState.index += 1;
    await delay(180);
  }
}

async function createCapturePage(browser) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "gpu", {
      configurable: true,
      get: () => undefined,
    });
  });
  return { context, page };
}

async function captureOriginalRecording({ browser, frameDir, url }) {
  const { context, page } = await createCapturePage(browser);
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const jars = page.locator("nav[aria-label='Specimen jars'] button");
    const views = page.locator("[aria-label='Views'] button");
    if ((await jars.count()) !== 3 || (await views.count()) !== 3) {
      throw new Error("Fungarium original controls were not ready for recording.");
    }
    const frameState = { index: 0 };
    await saveFrames(page, frameDir, frameState);
    await jars.nth(1).click();
    await saveFrames(page, frameDir, frameState);
    await views.nth(2).click();
    await saveFrames(page, frameDir, frameState);
  } finally {
    await context.close();
  }
}

async function captureShowcaseRecording({ browser, frameDir, url }) {
  const { context, page } = await createCapturePage(browser);
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const interactive = page.getByRole("button", { name: "互动活动", exact: true });
    const caseView = page.getByRole("button", { name: "案例", exact: true });
    await interactive.waitFor({ state: "visible" });
    await caseView.waitFor({ state: "visible" });
    const frameState = { index: 0 };
    await saveFrames(page, frameDir, frameState);
    await interactive.click();
    await saveFrames(page, frameDir, frameState);
    await caseView.click();
    await saveFrames(page, frameDir, frameState);
  } finally {
    await context.close();
  }
}

async function framesToGif(frameDirectory, outputFile) {
  await mkdir(path.dirname(outputFile), { recursive: true });
  await run(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "5",
      "-i",
      "frame-%03d.png",
      "-vf",
      "fps=5,scale=960:-2:flags=lanczos",
      "-loop",
      "0",
      outputFile,
    ],
    { cwd: frameDirectory },
  );
}

export function resolveChromium(playwrightModule) {
  const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium;
  if (!chromium) throw new Error("Playwright Chromium launcher is unavailable.");
  return chromium;
}

async function loadChromium(rootDir) {
  const playwrightEntry = path.join(
    rootDir,
    "fungarium-product-showcase",
    "node_modules",
    "playwright",
    "index.js",
  );
  const playwright = await import(pathToFileURL(playwrightEntry).href);
  return resolveChromium(playwright);
}

export async function assertGifFile(filePath) {
  const [metadata, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (metadata.size === 0 || (signature !== "GIF87a" && signature !== "GIF89a")) {
    throw new Error(`GIF artifact is invalid: ${filePath}`);
  }
}

export function assertNoTrackedUpstreamFiles(filePaths) {
  const upstreamPath = filePaths.find(
    (filePath) =>
      filePath === "fungarium-upstream-run" ||
      filePath.startsWith("fungarium-upstream-run/") ||
      filePath === "artifacts/fungarium-upstream-run" ||
      filePath.startsWith("artifacts/fungarium-upstream-run/"),
  );
  if (upstreamPath) {
    throw new Error(`Tracked upstream checkout is forbidden: ${upstreamPath}`);
  }
}

export async function recordFungariumDemos({ rootDir = repositoryRoot } = {}) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "fungarium-recording-"));
  const upstreamDir = path.join(temporaryRoot, "upstream");
  const originalFrames = path.join(temporaryRoot, "original-frames");
  const showcaseFrames = path.join(temporaryRoot, "showcase-frames");
  let upstreamServer;
  let showcaseServer;
  let browser;

  try {
    await run("git", ["clone", UPSTREAM_REPOSITORY, upstreamDir], { cwd: temporaryRoot });
    await run("git", ["-C", upstreamDir, "checkout", UPSTREAM_COMMIT], { cwd: temporaryRoot });
    await run("npm", ["ci"], { cwd: upstreamDir });
    upstreamServer = await startVite({ cwd: upstreamDir, port: 5221 });
    showcaseServer = await startVite({ cwd: path.join(rootDir, "fungarium-product-showcase"), port: 5222 });
    const chromium = await loadChromium(rootDir);
    browser = await chromium.launch({ headless: true });
    await captureOriginalRecording({ browser, frameDir: originalFrames, url: "http://127.0.0.1:5221/" });
    await captureShowcaseRecording({ browser, frameDir: showcaseFrames, url: "http://127.0.0.1:5222/" });
    await framesToGif(originalFrames, path.join(rootDir, RECORDINGS[0].output));
    await framesToGif(showcaseFrames, path.join(rootDir, RECORDINGS[1].output));
    await Promise.all(RECORDINGS.map(({ output }) => assertGifFile(path.join(rootDir, output))));
    return RECORDINGS.map(({ output }) => path.join(rootDir, output));
  } finally {
    await browser?.close();
    await stop(upstreamServer);
    await stop(showcaseServer);
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
