import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";

export const UPSTREAM_REPOSITORY = "https://github.com/14islands/r3f-scroll-rig";
export const UPSTREAM_COMMIT = "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63";
export const UPSTREAM_REPOSITORY_VERSION = "7.0.7";
export const UPSTREAM_RESOLVED_VERSION = "6.0.5";
export const CAPTURE_VIEWPORT = { width: 960, height: 640 };
export const ORIGINAL_SCROLL_STOPS = [0, 2560, 3600, 5368];
export const SHOWCASE_SCROLL_STOPS = [0, 1100, 2200, 3800];
export const RECORDINGS = [
  { id: "original", output: "docs/demos/08-r3f-scroll-rig-original.gif" },
  { id: "lighthouse", output: "docs/demos/08-r3f-scroll-rig-lighthouse.gif" },
];

const ORIGINAL_URL = "http://127.0.0.1:5223/";
const SHOWCASE_URL = "http://127.0.0.1:5224/";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function assertGifFile(filePath) {
  const [metadata, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (
    metadata.size < 10_000 ||
    metadata.size > 8_000_000 ||
    (signature !== "GIF87a" && signature !== "GIF89a")
  ) {
    throw new Error(`GIF artifact is invalid: ${filePath}`);
  }
}

export function assertLegacySource({
  legacyDir,
  head,
  repositoryVersion,
  resolvedVersion,
}) {
  if (head !== UPSTREAM_COMMIT) {
    throw new Error(`legacy source commit must be ${UPSTREAM_COMMIT}: ${legacyDir}`);
  }
  if (repositoryVersion !== UPSTREAM_REPOSITORY_VERSION) {
    throw new Error(
      `legacy source repository version must be ${UPSTREAM_REPOSITORY_VERSION}: ${legacyDir}`,
    );
  }
  if (resolvedVersion !== UPSTREAM_RESOLVED_VERSION) {
    throw new Error(
      `legacy source resolved version must be ${UPSTREAM_RESOLVED_VERSION}: ${legacyDir}`,
    );
  }
}

export function buildScrollFrames(stops, framesPerStage = 10) {
  return Array.from({ length: stops.length * framesPerStage }, (_, frameIndex) => {
    const stageIndex = Math.floor(frameIndex / framesPerStage);
    const target = stops[stageIndex];
    const next = stops[stageIndex + 1] ?? target;
    const progress = (frameIndex % framesPerStage) / framesPerStage;
    return Math.round(target + (next - target) * progress);
  });
}

function run(command, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}\n${stdout}${stderr}`));
    });
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function resolveLegacyDirectory(rootDir, legacyDir) {
  return path.resolve(
    legacyDir ?? process.env.R3F_LEGACY_DIR ?? path.join(rootDir, "..", "..", "r3f-scroll-rig-legacy-demo"),
  );
}

async function inspectLegacySource(legacyDir) {
  const head = await run("git", [
    "-c",
    `safe.directory=${legacyDir.replaceAll("\\", "/")}`,
    "-C",
    legacyDir,
    "rev-parse",
    "HEAD",
  ]);
  const repositoryVersion = (await readJson(path.join(legacyDir, "package.json"))).version;
  const resolvedVersion = (
    await readJson(
      path.join(
        legacyDir,
        "examples",
        "node_modules",
        "@14islands",
        "r3f-scroll-rig",
        "package.json",
      ),
    )
  ).version;
  assertLegacySource({ legacyDir, head, repositoryVersion, resolvedVersion });
}

function childOutput(child) {
  return `stdout:\n${child.stdoutText}\nstderr:\n${child.stderrText}`;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before serving ${url}\n${childOutput(child)}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server may not have finished binding its port yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for server at ${url}\n${childOutput(child)}`);
}

export async function stopProcessTree(
  child,
  {
    platform = process.platform,
    runCommandImpl = run,
  } = {},
) {
  if (!child?.pid || child.exitCode !== null) return;
  if (platform === "win32") {
    await runCommandImpl("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export async function startOriginalServer(
  legacyDir,
  {
    platform = process.platform,
    spawnImpl = spawn,
    waitForServerImpl = waitForServer,
    stopProcessTreeImpl = stopProcessTree,
  } = {},
) {
  const environment = {
    ...process.env,
    PORT: "5223",
    HOST: "127.0.0.1",
    BROWSER: "none",
    CI: "true",
  };
  if (platform === "win32") {
    environment.NODE_OPTIONS = "--openssl-legacy-provider";
  }
  const child = spawnImpl(
    platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm",
    platform === "win32" ? ["/d", "/s", "/c", "npm start"] : ["start"],
    {
      cwd: path.join(legacyDir, "examples"),
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: platform !== "win32",
    },
  );
  child.stdoutText = "";
  child.stderrText = "";
  child.stdout?.on("data", (chunk) => { child.stdoutText += chunk; });
  child.stderr?.on("data", (chunk) => { child.stderrText += chunk; });
  const close = () => stopProcessTreeImpl(child, { platform });
  try {
    await waitForServerImpl(ORIGINAL_URL, child);
    return { url: ORIGINAL_URL, child, close };
  } catch (error) {
    await close();
    throw error;
  }
}

async function stopShowcaseServer(server) {
  if (!server?.child || server.child.exitCode !== null) return;
  await new Promise((resolve) => {
    server.child.once("exit", resolve);
    server.child.kill();
  });
}

async function startShowcaseServer(rootDir) {
  const showcaseDir = path.join(rootDir, "r3f-scroll-rig-showcase");
  const child = spawn(
    process.execPath,
    [path.join(showcaseDir, "node_modules", "vite", "bin", "vite.js"),
      "--host=127.0.0.1", "--port=5224", "--strictPort"],
    {
      cwd: showcaseDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdoutText = "";
  child.stderrText = "";
  child.stdout.on("data", (chunk) => { child.stdoutText += chunk; });
  child.stderr.on("data", (chunk) => { child.stderrText += chunk; });
  try {
    await waitForServer(SHOWCASE_URL, child);
    return { url: SHOWCASE_URL, child };
  } catch (error) {
    await stopShowcaseServer({ child });
    throw error;
  }
}

async function loadChromium(rootDir) {
  const playwrightPath = path.join(
    rootDir,
    "r3f-scroll-rig-showcase",
    "node_modules",
    "playwright",
    "index.mjs",
  );
  return import(pathToFileURL(playwrightPath).href);
}

async function captureFrames(page, stops, frameDirectory) {
  for (const [index, top] of buildScrollFrames(stops, 10).entries()) {
    await scrollPageTo(page, top);
    await page.waitForTimeout(120);
    await page.screenshot({
      path: path.join(frameDirectory, `frame-${String(index + 1).padStart(3, "0")}.png`),
    });
  }
}

export function navigateOriginalPage(page) {
  return page.goto(ORIGINAL_URL, { waitUntil: "domcontentloaded" });
}

export function navigateLighthousePage(page) {
  return page.goto(SHOWCASE_URL, { waitUntil: "domcontentloaded" });
}

export function waitForLighthouseHeading(page) {
  return page.getByRole("heading", { name: "雾屿灯塔", exact: true }).waitFor();
}

export async function scrollPageTo(page, top) {
  await page.evaluate((scrollTop) => window.scrollTo(0, scrollTop, 1), top);
  await page.waitForFunction(
    (scrollTop) => {
      const maximum = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const target = Math.min(Math.max(scrollTop, 0), maximum);
      return Math.abs(window.scrollY - target) <= 1;
    },
    top,
    { timeout: 10_000 },
  );
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

export async function waitForOriginalReadiness(page) {
  await page.getByText(
    "A ScrollScene with a Cube mesh inside using global lights.",
    { exact: true },
  ).waitFor({ timeout: 60_000 });
  await page.getByText(
    /^Loading\s+\d+(?:\.\d+)?%$/,
  ).waitFor({ state: "hidden", timeout: 60_000 });
}

async function captureOriginal(browser, frameDirectory) {
  const page = await browser.newPage({ viewport: CAPTURE_VIEWPORT });
  try {
    await navigateOriginalPage(page);
    await waitForOriginalReadiness(page);
    await captureFrames(page, ORIGINAL_SCROLL_STOPS, frameDirectory);
  } finally {
    await page.close();
  }
}

async function captureLighthouse(browser, frameDirectory) {
  const page = await browser.newPage({ viewport: CAPTURE_VIEWPORT });
  try {
    await navigateLighthousePage(page);
    await waitForLighthouseHeading(page);
    await page.getByRole("button", { name: "稳定构图", exact: true }).waitFor();
    await page.waitForFunction(
      () => document.documentElement.classList.contains("webgl-ready"),
      null,
      { timeout: 60_000 },
    );
    await captureFrames(page, SHOWCASE_SCROLL_STOPS, frameDirectory);
  } finally {
    await page.close();
  }
}

async function framesToGif(frameDirectory, outputFile) {
  await run("ffmpeg", [
    "-y",
    "-framerate", "5",
    "-i", "frame-%03d.png",
    "-filter_complex",
    "[0:v]fps=5,scale=960:-2:flags=lanczos,split[p][s];[s]palettegen=max_colors=128:stats_mode=diff[pal];[p][pal]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
    "-loop", "0",
    outputFile,
  ], { cwd: frameDirectory });
}

export async function recordR3fScrollRigDemos({
  rootDir = repositoryRoot,
  legacyDir,
} = {}) {
  const resolvedLegacyDir = resolveLegacyDirectory(rootDir, legacyDir);
  await inspectLegacySource(resolvedLegacyDir);
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "r3f-scroll-rig-recording-"),
  );
  let originalServer;
  let showcaseServer;
  let browser;
  try {
    originalServer = await startOriginalServer(resolvedLegacyDir);
    showcaseServer = await startShowcaseServer(rootDir);
    browser = await (await loadChromium(rootDir)).chromium.launch({
      headless: true,
      args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"],
    });
    await captureOriginal(browser, path.join(temporaryRoot, "original"));
    await captureLighthouse(browser, path.join(temporaryRoot, "lighthouse"));
    const outputs = RECORDINGS.map(({ output }) => path.join(rootDir, output));
    await framesToGif(path.join(temporaryRoot, "original"), outputs[0]);
    await framesToGif(path.join(temporaryRoot, "lighthouse"), outputs[1]);
    await Promise.all(outputs.map(assertGifFile));
    return outputs;
  } finally {
    await browser?.close();
    await stopShowcaseServer(showcaseServer);
    await originalServer?.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}
