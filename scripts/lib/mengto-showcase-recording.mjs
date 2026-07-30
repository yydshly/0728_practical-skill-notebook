import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SHOWCASE_GIF = "docs/demos/07-mengto-skills-showcase.gif";
export const MAX_GIF_BYTES = 5 * 1024 * 1024;
export const FRAME_RATE = 4;
export const GIF_WIDTH = 720;
export const PREVIEW_PORT = 5277;

export const CAPTURE_STAGES = Object.freeze([
  Object.freeze({ id: "showcase-hub", frames: 12, path: "/" }),
  Object.freeze({
    id: "monster-forge",
    frames: 16,
    path: "/monster-forge/?review=ash-warden",
  }),
  Object.freeze({
    id: "ashfall-arena",
    frames: 16,
    path: "/ashfall-arena/?fixture=fresh&reviewControls=1&safeTraining=1&capture=1&quality=high",
  }),
  Object.freeze({
    id: "mech-atelier",
    frames: 16,
    path: "/mech-atelier/?review=default",
  }),
]);

export function commandInvocation(command, platform = process.platform) {
  const windowsNpm = platform === "win32" && command === "npm";
  return {
    command: windowsNpm ? "npm.cmd" : command,
    shell: windowsNpm,
  };
}

export function resolveChromium(playwrightModule) {
  const chromium =
    playwrightModule.chromium ?? playwrightModule.default?.chromium;
  if (!chromium) {
    throw new Error("Playwright Chromium launcher is unavailable.");
  }
  return chromium;
}

export function resolveFfmpegCommand(environment = process.env) {
  const configured = environment.MENGTO_SHOWCASE_FFMPEG?.trim();
  return configured || "ffmpeg";
}

export function createGifCommands({
  framePattern,
  palettePath,
  outputPath,
}) {
  const scaled = `fps=${FRAME_RATE},scale=${GIF_WIDTH}:-2:flags=lanczos`;
  return [
    [
      "-y",
      "-framerate",
      String(FRAME_RATE),
      "-i",
      framePattern,
      "-vf",
      `${scaled},palettegen=max_colors=64:stats_mode=diff`,
      palettePath,
    ],
    [
      "-y",
      "-framerate",
      String(FRAME_RATE),
      "-i",
      framePattern,
      "-i",
      palettePath,
      "-lavfi",
      `${scaled}[frames];[frames][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      "-loop",
      "0",
      outputPath,
    ],
  ];
}

export async function assertGifFile(
  filePath,
  {
    maxBytes = MAX_GIF_BYTES,
    expectedWidth = GIF_WIDTH,
  } = {},
) {
  const [metadata, bytes] = await Promise.all([
    stat(filePath),
    readFile(filePath),
  ]);
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (!["GIF87a", "GIF89a"].includes(signature)) {
    throw new Error(`Invalid GIF signature: ${filePath}`);
  }
  if (bytes.length < 10) {
    throw new Error(`GIF header is truncated: ${filePath}`);
  }
  const width = bytes.readUInt16LE(6);
  if (width !== expectedWidth) {
    throw new Error(
      `GIF width must be ${expectedWidth}, received ${width}.`,
    );
  }
  if (metadata.size === 0 || metadata.size > maxBytes) {
    throw new Error(
      `GIF must be non-empty and no larger than 5 MiB: ${filePath}`,
    );
  }
  return { signature, width, size: metadata.size };
}

export async function publishGifCandidate(candidatePath, outputPath) {
  await assertGifFile(candidatePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await copyFile(candidatePath, outputPath);
  return assertGifFile(outputPath);
}

async function runCommand(command, args, { cwd }) {
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
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${code}.\n${output}`,
    );
  }
  return output;
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function observedChildTermination(child) {
  const exitCode = child.exitCode ?? null;
  const signalCode = child.signalCode ?? null;
  if (exitCode === null && signalCode === null) {
    return null;
  }
  return { exitCode, signalCode, error: null };
}

export function createPreviewLifecycle(child, output = () => "") {
  let termination = null;
  let resolveCompletion;
  const completion = new Promise((resolve) => {
    resolveCompletion = resolve;
  });
  const settle = (nextTermination) => {
    if (termination !== null) {
      return;
    }
    termination = nextTermination;
    resolveCompletion(nextTermination);
  };

  child.on("error", (error) => {
    settle({
      exitCode: child.exitCode ?? null,
      signalCode: child.signalCode ?? null,
      error,
    });
  });
  child.once("close", (exitCode, signalCode) => {
    settle({
      exitCode: exitCode ?? child.exitCode ?? null,
      signalCode: signalCode ?? child.signalCode ?? null,
      error: null,
    });
  });

  const alreadyTerminated = observedChildTermination(child);
  if (alreadyTerminated) {
    settle(alreadyTerminated);
  }

  return {
    child,
    completion,
    output,
    get termination() {
      return termination;
    },
  };
}

function previewTermination(preview) {
  return preview.termination ?? observedChildTermination(preview.child);
}

function previewExitError(url, preview) {
  const termination = previewTermination(preview);
  const lifecycleDetails = termination?.error
    ? termination.error.message
    : termination?.signalCode
      ? `Preview terminated by signal ${termination.signalCode}.`
      : termination?.exitCode !== null &&
          termination?.exitCode !== undefined
        ? `Preview exited with code ${termination.exitCode}.`
        : "";
  const details = [preview.output().trim(), lifecycleDetails]
    .filter(Boolean)
    .join("\n");
  return new Error(
    `Vite exited before ${url} became ready.` +
      (details ? `\n${details}` : ""),
  );
}

const ansiEscape = /\u001B\[[0-?]*[ -/]*[@-~]/g;
const showcaseHubMarker =
  /<meta\s+name=["']showcase-app["']\s+content=["']showcase-hub["']\s*\/?>/i;

class ReadinessOperationTimeout extends Error {}

async function raceReadinessOperation({
  operation,
  preview,
  timeoutMs,
  controller,
  url,
}) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new ReadinessOperationTimeout());
    }, Math.max(1, timeoutMs));
  });
  const contenders = [Promise.resolve().then(operation), timeout];
  if (preview.completion) {
    contenders.push(
      preview.completion.then(() => {
        controller?.abort();
        throw previewExitError(url, preview);
      }),
    );
  }
  try {
    return await Promise.race(contenders);
  } finally {
    clearTimeout(timeoutId);
  }
}

function hasOwnPreviewReadyMarker(url, preview) {
  const output = preview.output().replace(ansiEscape, "");
  const expected = new URL(url);
  return (
    output.includes("Local:") &&
    output.includes(`${expected.protocol}//${expected.host}`)
  );
}

export async function waitForServer(
  url,
  preview,
  {
    fetchImpl = globalThis.fetch,
    sleep = delay,
    readinessTimeoutMs = 30_000,
    requestTimeoutMs = 2_000,
  } = {},
) {
  const deadline = Date.now() + readinessTimeoutMs;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (previewTermination(preview)) {
      throw previewExitError(url, preview);
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    let response;
    let html = "";
    const controller = new AbortController();
    try {
      response = await raceReadinessOperation({
        operation: () => fetchImpl(url, { signal: controller.signal }),
        preview,
        timeoutMs: Math.min(requestTimeoutMs, remaining),
        controller,
        url,
      });
      if (response.ok) {
        html = await raceReadinessOperation({
          operation: () => response.text(),
          preview,
          timeoutMs: Math.min(
            requestTimeoutMs,
            Math.max(1, deadline - Date.now()),
          ),
          controller,
          url,
        });
      }
    } catch {
      if (previewTermination(preview)) {
        throw previewExitError(url, preview);
      }
      const retryDelay = Math.min(250, Math.max(0, deadline - Date.now()));
      if (retryDelay > 0) {
        await sleep(retryDelay);
      }
      continue;
    }
    if (
      response.ok &&
      showcaseHubMarker.test(html) &&
      hasOwnPreviewReadyMarker(url, preview)
    ) {
      const settleDelay = Math.min(
        250,
        Math.max(0, deadline - Date.now()),
      );
      if (settleDelay > 0) {
        await sleep(settleDelay);
      }
      if (previewTermination(preview)) {
        throw previewExitError(url, preview);
      }
      return;
    }
    const retryDelay = Math.min(250, Math.max(0, deadline - Date.now()));
    if (retryDelay > 0) {
      await sleep(retryDelay);
    }
  }
  const details = preview.output().trim();
  throw new Error(
    `Timed out waiting for ${url}.` +
      (details ? `\n${details}` : ""),
  );
}

async function saveFrames(page, frameDirectory, frameState, count) {
  await mkdir(frameDirectory, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    const file = path.join(
      frameDirectory,
      `frame-${String(frameState.index).padStart(3, "0")}.png`,
    );
    await page.screenshot({ path: file });
    frameState.index += 1;
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
}

function startPreview({ workspaceDir, port }) {
  let output = "";
  const viteEntry = path.join(
    workspaceDir,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  const child = spawn(
    process.execPath,
    [
      viteEntry,
      "preview",
      "--config",
      path.join(workspaceDir, "vite.showcase-preview.config.ts"),
      "--host=127.0.0.1",
      `--port=${port}`,
      "--strictPort",
    ],
    {
      cwd: workspaceDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const preview = createPreviewLifecycle(child, () => output);
  const appendOutput = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-16_384);
  };
  child.stdout.on("data", appendOutput);
  child.stderr.on("data", appendOutput);
  return preview;
}

const stopTimedOut = Symbol("stopTimedOut");

async function waitForPreviewStop(preview, timeoutMs) {
  const termination = previewTermination(preview);
  if (termination) {
    return termination;
  }
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(stopTimedOut), timeoutMs);
  });
  try {
    return await Promise.race([preview.completion, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function signalPreview(preview, signal) {
  try {
    if (signal) {
      preview.child.kill(signal);
    } else {
      preview.child.kill();
    }
  } catch (error) {
    const termination = previewTermination(preview);
    if (termination) {
      return termination;
    }
    throw error;
  }
  return previewTermination(preview);
}

export async function stopPreview(
  preview,
  {
    graceTimeoutMs = 2_000,
    forceTimeoutMs = 2_000,
  } = {},
) {
  const existingTermination = previewTermination(preview);
  if (existingTermination) {
    return existingTermination;
  }

  const gracefulTermination = signalPreview(preview);
  if (gracefulTermination) {
    return gracefulTermination;
  }
  let termination = await waitForPreviewStop(preview, graceTimeoutMs);
  if (termination !== stopTimedOut) {
    return termination;
  }
  if (previewTermination(preview)) {
    return previewTermination(preview);
  }

  const forcedTermination = signalPreview(preview, "SIGKILL");
  if (forcedTermination) {
    return forcedTermination;
  }
  termination = await waitForPreviewStop(preview, forceTimeoutMs);
  if (termination !== stopTimedOut) {
    return termination;
  }
  throw new Error("Preview did not close after forced termination.");
}

async function captureStage({
  page,
  stage,
  baseUrl,
  frameDirectory,
  frameState,
}) {
  await page.goto(new URL(stage.path, baseUrl).href, {
    waitUntil: "networkidle",
  });
  await page.locator('meta[name="showcase-app"]').waitFor({
    state: "attached",
  });
  const marker = await page
    .locator('meta[name="showcase-app"]')
    .getAttribute("content");
  if (marker !== stage.id) {
    throw new Error(`Expected ${stage.id} marker, received ${marker}.`);
  }

  if (stage.id === "showcase-hub") {
    await page.locator("[data-product-card]").first().waitFor({
      state: "visible",
    });
    const previews = page.locator("[data-product-card] img");
    if ((await previews.count()) !== 3) {
      throw new Error("Showcase Hub must expose three product previews.");
    }
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll("[data-product-card] img")].every(
          (image) => image.complete && image.naturalWidth > 0,
        ),
      null,
      { timeout: 10_000 },
    );
    await saveFrames(page, frameDirectory, frameState, 6);
    await page.locator("#product-monster-forge").scrollIntoViewIfNeeded();
    await saveFrames(page, frameDirectory, frameState, 6);
    return;
  }

  if (stage.id === "monster-forge") {
    await page
      .getByRole("button", {
        name: "开始体验",
        exact: true,
      })
      .click();
    await page.locator("[data-inspector] canvas").waitFor({
      state: "visible",
    });
    await page
      .locator(".live-status", {
        hasText: "实时模型已就绪",
      })
      .waitFor({ state: "visible" });
    await saveFrames(page, frameDirectory, frameState, 4);
    const crawler = page.getByRole("button", { name: /Glass Crawler/ });
    await crawler.click();
    await crawler.waitFor({
      state: "visible",
    });
    if ((await crawler.getAttribute("aria-pressed")) !== "true") {
      throw new Error(
        "Glass Crawler did not become the active review asset.",
      );
    }
    await saveFrames(page, frameDirectory, frameState, 6);
    await page.getByRole("checkbox", { name: /显示骨架/ }).check();
    await page
      .locator("[data-overlay-status]", {
        hasText: "骨架已显示",
      })
      .waitFor({ state: "visible" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await saveFrames(page, frameDirectory, frameState, 6);
    return;
  }

  if (stage.id === "ashfall-arena") {
    const canvas = page.locator("[data-game-canvas]");
    await canvas.waitFor({ state: "visible" });
    if ((await page.locator(".runtime-fallback").count()) !== 0) {
      throw new Error("Ashfall entered its information fallback.");
    }
    await page.waitForFunction(
      () => window.__ashfallDiagnostics?.snapshot().frameCount > 3,
      null,
      { timeout: 10_000 },
    );
    await canvas.focus();
    await saveFrames(page, frameDirectory, frameState, 4);
    await page.keyboard.down("KeyW");
    try {
      await saveFrames(page, frameDirectory, frameState, 6);
    } finally {
      await page.keyboard.up("KeyW");
    }
    await page.keyboard.press("KeyJ");
    await saveFrames(page, frameDirectory, frameState, 6);
    return;
  }

  await page
    .getByRole("button", {
      name: "开始体验",
      exact: true,
    })
    .click();
  await page.locator("[data-product-canvas]").waitFor({
    state: "visible",
  });
  await page.waitForFunction(
    () => window.__MECH_ATELIER_DEBUG__?.nonEmptyPixelCount() > 120,
    null,
    { timeout: 10_000 },
  );
  await saveFrames(page, frameDirectory, frameState, 4);
  await page.getByRole("radio", { name: /光环头部/ }).check();
  await page
    .locator("[data-summary-price]", {
      hasText: "194,000",
    })
    .waitFor({ state: "visible" });
  await saveFrames(page, frameDirectory, frameState, 6);
  await page.locator("[data-summary]").scrollIntoViewIfNeeded();
  await saveFrames(page, frameDirectory, frameState, 6);
}

const defaultRootDir = fileURLToPath(new URL("../..", import.meta.url));

export async function recordMengToShowcaseDemo({
  rootDir = defaultRootDir,
  port = PREVIEW_PORT,
} = {}) {
  const workspaceDir = path.join(rootDir, "mengto-skills-showcase");
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "mengto-showcase-recording-"),
  );
  const frameDirectory = path.join(temporaryRoot, "frames");
  const palettePath = path.join(temporaryRoot, "palette.png");
  const candidatePath = path.join(temporaryRoot, "candidate.gif");
  const outputPath = path.join(rootDir, SHOWCASE_GIF);
  const baseUrl = `http://127.0.0.1:${port}/`;
  let browser = null;
  let preview = null;

  try {
    await runCommand("npm", ["run", "build:showcase"], {
      cwd: workspaceDir,
    });
    preview = startPreview({ workspaceDir, port });
    await waitForServer(baseUrl, preview);

    const playwrightEntry = path.join(
      workspaceDir,
      "node_modules",
      "playwright",
      "index.js",
    );
    const playwrightModule = await import(
      pathToFileURL(playwrightEntry).href
    );
    browser = await resolveChromium(playwrightModule).launch({
      headless: true,
    });
    const context = await browser.newContext({
      viewport: { width: 960, height: 640 },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    const frameState = { index: 0 };

    for (const stage of CAPTURE_STAGES) {
      await captureStage({
        page,
        stage,
        baseUrl,
        frameDirectory,
        frameState,
      });
    }
    if (frameState.index !== 60) {
      throw new Error(
        `Expected 60 frames, captured ${frameState.index}.`,
      );
    }

    const [paletteArgs, gifArgs] = createGifCommands({
      framePattern: path.join(frameDirectory, "frame-%03d.png"),
      palettePath,
      outputPath: candidatePath,
    });
    const ffmpeg = resolveFfmpegCommand();
    await runCommand(ffmpeg, paletteArgs, { cwd: rootDir });
    await runCommand(ffmpeg, gifArgs, { cwd: rootDir });
    const artifact = await publishGifCandidate(candidatePath, outputPath);
    return {
      output: SHOWCASE_GIF,
      ...artifact,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => undefined);
    }
    let previewCleanupError = null;
    if (preview) {
      try {
        await stopPreview(preview);
      } catch (error) {
        previewCleanupError = error;
      }
    }
    await rm(temporaryRoot, { recursive: true, force: true });
    if (previewCleanupError) {
      throw previewCleanupError;
    }
  }
}
