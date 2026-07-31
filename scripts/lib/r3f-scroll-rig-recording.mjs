import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { connect } from "node:net";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
} from "node:fs/promises";

export const UPSTREAM_REPOSITORY = "https://github.com/14islands/r3f-scroll-rig";
export const UPSTREAM_COMMIT = "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63";
export const UPSTREAM_REPOSITORY_VERSION = "7.0.7";
export const UPSTREAM_RESOLVED_VERSION = "6.0.5";
export const CAPTURE_VIEWPORT = { width: 960, height: 640 };
export const ORIGINAL_SCROLL_STOPS = [0, 1280, 2560, 3600];
export const SHOWCASE_SCROLL_STOPS = [0, 1100, 2200, 3800];
export const RECORDINGS = [
  { id: "original", output: "docs/demos/08-r3f-scroll-rig-original.gif" },
  { id: "lighthouse", output: "docs/demos/08-r3f-scroll-rig-lighthouse.gif" },
];

const ORIGINAL_URL = "http://127.0.0.1:5223/";
const SHOWCASE_URL = "http://127.0.0.1:5224/";
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function invalidGif(filePath, reason) {
  return new Error(`GIF artifact is invalid (${reason}): ${filePath}`);
}

function parseGif(bytes, filePath) {
  let offset = 0;
  const requireBytes = (length, description) => {
    if (offset + length > bytes.length) {
      throw invalidGif(filePath, `truncated ${description}`);
    }
  };
  const readByte = (description) => {
    requireBytes(1, description);
    const value = bytes[offset];
    offset += 1;
    return value;
  };
  const readSubBlocks = (description) => {
    const blocks = [];
    while (true) {
      const blockLength = readByte(`${description} sub-block length`);
      if (blockLength === 0) return Buffer.concat(blocks);
      requireBytes(blockLength, `${description} sub-block`);
      blocks.push(bytes.subarray(offset, offset + blockLength));
      offset += blockLength;
    }
  };

  requireBytes(6, "GIF89a signature");
  const signature = bytes.subarray(offset, offset + 6).toString("ascii");
  offset += 6;
  if (signature !== "GIF89a") {
    throw invalidGif(filePath, "expected exact GIF89a signature");
  }

  requireBytes(7, "logical screen descriptor");
  const width = bytes.readUInt16LE(offset);
  const height = bytes.readUInt16LE(offset + 2);
  const screenPacked = bytes[offset + 4];
  offset += 7;
  if (screenPacked & 0x80) {
    const tableLength = 3 * (2 ** ((screenPacked & 0x07) + 1));
    requireBytes(tableLength, "global color table");
    offset += tableLength;
  }

  const frameDelays = [];
  const loopCounts = [];
  let pendingFrameDelay = null;
  let sawTrailer = false;

  while (offset < bytes.length) {
    const marker = readByte("block marker");
    if (marker === 0x3b) {
      sawTrailer = true;
      if (offset !== bytes.length) {
        throw invalidGif(filePath, "bytes remain after final trailer");
      }
      break;
    }

    if (marker === 0x21) {
      const extensionType = readByte("extension label");
      if (extensionType === 0xf9) {
        const blockLength = readByte("graphic control extension length");
        if (blockLength !== 4) {
          throw invalidGif(filePath, "graphic control extension length is not 4");
        }
        requireBytes(blockLength, "graphic control extension");
        pendingFrameDelay = bytes.readUInt16LE(offset + 1);
        offset += blockLength;
        if (readByte("graphic control extension terminator") !== 0) {
          throw invalidGif(filePath, "graphic control extension lacks a terminator");
        }
        continue;
      }

      if (extensionType === 0xff) {
        const blockLength = readByte("application extension length");
        requireBytes(blockLength, "application extension identifier");
        const identifier = bytes
          .subarray(offset, offset + blockLength)
          .toString("ascii");
        offset += blockLength;
        const applicationData = readSubBlocks("application extension");
        if (identifier === "NETSCAPE2.0" || identifier === "ANIMEXTS1.0") {
          if (applicationData.length < 3 || applicationData[0] !== 1) {
            throw invalidGif(filePath, "malformed animation loop extension");
          }
          loopCounts.push(applicationData.readUInt16LE(1));
        }
        continue;
      }

      if (extensionType === 0x01) {
        const blockLength = readByte("plain text extension length");
        requireBytes(blockLength, "plain text extension");
        offset += blockLength;
        readSubBlocks("plain text extension");
        pendingFrameDelay = null;
        continue;
      }

      readSubBlocks("extension");
      continue;
    }

    if (marker === 0x2c) {
      requireBytes(9, "image descriptor");
      const imagePacked = bytes[offset + 8];
      offset += 9;
      if (imagePacked & 0x80) {
        const tableLength = 3 * (2 ** ((imagePacked & 0x07) + 1));
        requireBytes(tableLength, "local color table");
        offset += tableLength;
      }
      readByte("LZW minimum code size");
      readSubBlocks("image data");
      frameDelays.push(pendingFrameDelay ?? 0);
      pendingFrameDelay = null;
      continue;
    }

    throw invalidGif(
      filePath,
      `unexpected block marker 0x${marker.toString(16).padStart(2, "0")}`,
    );
  }

  if (!sawTrailer) {
    throw invalidGif(filePath, "missing final trailer");
  }
  return { width, height, frameDelays, loopCounts };
}

export async function assertGifFile(filePath) {
  const [metadata, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  if (metadata.size < 10_000 || metadata.size > 8_000_000) {
    throw invalidGif(filePath, "size must be between 10 KB and 8 MB");
  }
  const { width, height, frameDelays, loopCounts } = parseGif(bytes, filePath);
  if (width !== CAPTURE_VIEWPORT.width || height !== CAPTURE_VIEWPORT.height) {
    throw invalidGif(filePath, "expected a 960x640 logical screen");
  }
  if (frameDelays.length !== 40) {
    throw invalidGif(filePath, "expected exactly 40 image frames");
  }
  const duration = frameDelays.reduce((total, delay) => total + delay, 0);
  if (frameDelays.some((delay) => delay !== 20) || duration !== 800) {
    throw invalidGif(
      filePath,
      "every frame delay must be 20 centiseconds and total duration must be 800 centiseconds",
    );
  }
  if (loopCounts.length === 0 || loopCounts.some((loopCount) => loopCount !== 0)) {
    throw invalidGif(filePath, "expected an infinite loop extension");
  }
}

export function assertLegacySource({
  legacyDir,
  head,
  repositoryVersion,
  resolvedVersion,
  trackedChanges = "",
}) {
  if (trackedChanges.trim() !== "") {
    throw new Error(
      `legacy source has tracked staged or unstaged changes: ${legacyDir}`,
    );
  }
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

function run(command, args, { cwd, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      signal,
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

export async function inspectLegacySource(
  legacyDir,
  {
    signal,
    runCommandImpl = run,
    readJsonImpl = readJson,
  } = {},
) {
  const gitPrefix = [
    "-c",
    `safe.directory=${legacyDir.replaceAll("\\", "/")}`,
    "-C",
    legacyDir,
  ];
  const [head, trackedChanges] = await Promise.all([
    runCommandImpl("git", [
      ...gitPrefix,
      "rev-parse",
      "HEAD",
    ], { signal }),
    runCommandImpl("git", [
      ...gitPrefix,
      "status",
      "--porcelain=v1",
      "--untracked-files=no",
    ], { signal }),
  ]);
  const repositoryVersion = (
    await readJsonImpl(path.join(legacyDir, "package.json"))
  ).version;
  const resolvedVersion = (
    await readJsonImpl(
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
  assertLegacySource({
    legacyDir,
    head,
    repositoryVersion,
    resolvedVersion,
    trackedChanges,
  });
}

function childOutput(child) {
  return `stdout:\n${child.stdoutText}\nstderr:\n${child.stderrText}`;
}

function childHasExited(child) {
  return child.exitCode != null || child.signalCode != null;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error("Recording aborted");
  }
}

async function waitForServer(url, child, { signal } = {}) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    if (childHasExited(child)) {
      throw new Error(`Server exited before serving ${url}\n${childOutput(child)}`);
    }
    try {
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(1_000)])
        : AbortSignal.timeout(1_000);
      const response = await fetch(url, { signal: requestSignal });
      if (response.ok) return;
    } catch {
      // The server may not have finished binding its port yet.
    }
    throwIfAborted(signal);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for server at ${url}\n${childOutput(child)}`);
}

function createChildExitWait(child, timeoutMs) {
  if (childHasExited(child)) {
    return { promise: Promise.resolve(true), cancel() {} };
  }
  let finish;
  const promise = new Promise((resolve) => {
    const onExit = () => finish(true);
    const timeout = setTimeout(() => finish(false), timeoutMs);
    finish = (exited) => {
      clearTimeout(timeout);
      child.off("exit", onExit);
      resolve(exited);
    };
    child.once("exit", onExit);
  });
  return { promise, cancel: () => finish(false) };
}

function processGroupExists(processGroupId) {
  try {
    process.kill(processGroupId, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

function portIsReleased(port, host = "127.0.0.1") {
  if (port === undefined || port === null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let settled = false;
    const finish = (released) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(released);
    };
    socket.once("connect", () => finish(false));
    socket.once("error", (error) => {
      finish(error.code === "ECONNREFUSED");
    });
    socket.setTimeout(250, () => finish(false));
  });
}

async function waitForProcessGroupAndPort({
  processGroupId,
  port,
  host,
  timeoutMs,
  pollIntervalMs,
  processGroupExistsImpl,
  portIsReleasedImpl,
}) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const [groupExists, released] = await Promise.all([
      processGroupExistsImpl(processGroupId),
      portIsReleasedImpl(port, host),
    ]);
    if (!groupExists && released) return true;
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(
      resolve,
      Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())),
    ));
  }
}

function signalProcessGroup(processGroupId, signal, killProcessGroupImpl) {
  try {
    killProcessGroupImpl(processGroupId, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

export async function stopProcessTree(
  child,
  {
    platform = process.platform,
    runCommandImpl = run,
    terminationTimeoutMs = 5_000,
    killProcessGroupImpl = process.kill,
    processGroupExistsImpl = processGroupExists,
    portIsReleasedImpl = portIsReleased,
    port,
    host = "127.0.0.1",
    pollIntervalMs = 25,
  } = {},
) {
  if (!child?.pid) return;
  if (platform === "win32") {
    if (childHasExited(child)) return;
    await runCommandImpl("taskkill", ["/PID", String(child.pid), "/T", "/F"]);
    return;
  }

  const processGroupId = -child.pid;
  const waitOptions = {
    processGroupId,
    port,
    host,
    timeoutMs: terminationTimeoutMs,
    pollIntervalMs,
    processGroupExistsImpl,
    portIsReleasedImpl,
  };
  signalProcessGroup(processGroupId, "SIGTERM", killProcessGroupImpl);
  if (await waitForProcessGroupAndPort(waitOptions)) return;

  if (await processGroupExistsImpl(processGroupId)) {
    signalProcessGroup(processGroupId, "SIGKILL", killProcessGroupImpl);
  }
  if (!await waitForProcessGroupAndPort(waitOptions)) {
    const groupExists = await processGroupExistsImpl(processGroupId);
    const released = await portIsReleasedImpl(port, host);
    throw new Error(
      `Process group ${child.pid} cleanup incomplete after SIGKILL `
      + `(groupExists=${groupExists}, portReleased=${released})`,
    );
  }
}

export async function startOriginalServer(
  legacyDir,
  {
    platform = process.platform,
    spawnImpl = spawn,
    waitForServerImpl = waitForServer,
    stopProcessTreeImpl = stopProcessTree,
    signal,
    startupCleanupTimeoutMs = 10_000,
    reportCleanupErrorImpl = reportCleanupError,
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
  const close = () => stopProcessTreeImpl(child, { platform, port: 5223 });
  try {
    await waitForServerImpl(ORIGINAL_URL, child, { signal });
    return { url: ORIGINAL_URL, child, close };
  } catch (error) {
    await cleanupRecordingResources(
      { originalServer: { close } },
      {
        operationError: error,
        cleanupTimeoutMs: startupCleanupTimeoutMs,
        reportCleanupErrorImpl,
      },
    );
  }
}

export async function stopShowcaseServer(server) {
  if (!server?.child || childHasExited(server.child)) return;
  await new Promise((resolve) => {
    server.child.once("exit", resolve);
    server.child.kill();
  });
}

async function startShowcaseServer(rootDir, { signal } = {}) {
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
    await waitForServer(SHOWCASE_URL, child, { signal });
    return { url: SHOWCASE_URL, child };
  } catch (error) {
    await cleanupRecordingResources(
      { showcaseServer: { child } },
      { operationError: error },
    );
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

async function framesToGif(frameDirectory, outputFile, { signal } = {}) {
  await run("ffmpeg", [
    "-y",
    "-framerate", "5",
    "-i", "frame-%03d.png",
    "-filter_complex",
    "[0:v]fps=5,scale=960:-2:flags=lanczos,split[p][s];[s]palettegen=max_colors=128:stats_mode=diff[pal];[p][pal]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
    "-loop", "0",
    outputFile,
  ], { cwd: frameDirectory, signal });
}

export async function encodeAndPublishGifs({
  temporaryRoot,
  frameDirectories,
  outputs,
  signal,
  encodeGifImpl = framesToGif,
  validateGifImpl = assertGifFile,
  copyFileImpl = copyFile,
  publishFileImpl = copyFile,
  removeFileImpl = rm,
} = {}) {
  if (
    !temporaryRoot
    || frameDirectories?.length !== 2
    || outputs?.length !== 2
  ) {
    throw new Error("Dual GIF publication requires two frames and two outputs");
  }

  const encodedDirectory = path.join(temporaryRoot, "encoded");
  const backupDirectory = path.join(temporaryRoot, "prior");
  await Promise.all([
    mkdir(encodedDirectory, { recursive: true }),
    mkdir(backupDirectory, { recursive: true }),
  ]);
  const temporaryOutputs = outputs.map((output, index) => path.join(
    encodedDirectory,
    `${index + 1}-${path.basename(output)}`,
  ));

  for (let index = 0; index < temporaryOutputs.length; index += 1) {
    throwIfAborted(signal);
    await encodeGifImpl(
      frameDirectories[index],
      temporaryOutputs[index],
      { signal },
    );
  }
  throwIfAborted(signal);
  await Promise.all(temporaryOutputs.map((temporaryOutput) => (
    validateGifImpl(temporaryOutput)
  )));

  const priorOutputs = [];
  for (let index = 0; index < outputs.length; index += 1) {
    const backup = path.join(
      backupDirectory,
      `${index + 1}-${path.basename(outputs[index])}`,
    );
    try {
      await copyFileImpl(outputs[index], backup);
      priorOutputs.push({ existed: true, backup });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      priorOutputs.push({ existed: false, backup });
    }
  }

  try {
    for (let index = 0; index < outputs.length; index += 1) {
      throwIfAborted(signal);
      await publishFileImpl(temporaryOutputs[index], outputs[index]);
    }
    await Promise.all(outputs.map((output) => validateGifImpl(output)));
    throwIfAborted(signal);
  } catch (publishError) {
    const rollbackResults = await Promise.allSettled(outputs.map(
      (output, index) => (
        priorOutputs[index].existed
          ? copyFileImpl(priorOutputs[index].backup, output)
          : removeFileImpl(output, { force: true })
      ),
    ));
    const rollbackErrors = rollbackResults
      .filter(({ status }) => status === "rejected")
      .map(({ reason }) => reason);
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [publishError, ...rollbackErrors],
        "Dual GIF publication failed and rollback was incomplete",
        { cause: publishError },
      );
    }
    throw publishError;
  }

  return outputs;
}

function awaitWithAbort(promise, signal) {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason instanceof Error
        ? signal.reason
        : new Error("Recording aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

async function runCleanupWithTimeout(name, close, cleanupTimeoutMs) {
  let timeout;
  try {
    await Promise.race([
      Promise.resolve().then(close),
      new Promise((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(
            `${name} cleanup timed out after ${cleanupTimeoutMs}ms`,
          ));
        }, cleanupTimeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function reportCleanupError(name, error) {
  console.error(
    `Recording cleanup failed for ${name}: ${error.stack || error.message}`,
  );
}

export async function cleanupRecordingResources(
  {
    browser,
    browserLaunchPromise,
    showcaseServer,
    originalServer,
    temporaryRoot,
  },
  {
    operationError,
    cleanupTimeoutMs = 10_000,
    stopShowcaseServerImpl = stopShowcaseServer,
    removeTemporaryRootImpl = rm,
    reportCleanupErrorImpl = reportCleanupError,
  } = {},
) {
  const cleanupSteps = [
    browser && { name: "browser", close: () => browser.close() },
    !browser && browserLaunchPromise && {
      name: "browser-launch",
      close: async () => {
        const lateBrowser = await browserLaunchPromise;
        await lateBrowser.close();
      },
    },
    showcaseServer && {
      name: "showcase",
      close: () => stopShowcaseServerImpl(showcaseServer),
    },
    originalServer && {
      name: "original",
      close: () => originalServer.close(),
    },
    temporaryRoot && {
      name: "temporary",
      close: () => removeTemporaryRootImpl(
        temporaryRoot,
        { recursive: true, force: true },
      ),
    },
  ].filter(Boolean);

  const results = await Promise.all(cleanupSteps.map(async ({ name, close }) => {
    try {
      await runCleanupWithTimeout(name, close, cleanupTimeoutMs);
      return null;
    } catch (error) {
      return { name, error };
    }
  }));
  const failures = results.filter(Boolean);
  for (const { name, error } of failures) {
    reportCleanupErrorImpl(name, error);
  }

  if (operationError) {
    operationError.cleanupErrors = [
      ...(operationError.cleanupErrors ?? []),
      ...failures.map(({ error }) => error),
    ];
    throw operationError;
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map(({ error }) => error),
      "Recording cleanup failed",
    );
  }
}

export async function recordR3fScrollRigDemos({
  rootDir = repositoryRoot,
  legacyDir,
  signal,
} = {}) {
  const resolvedLegacyDir = resolveLegacyDirectory(rootDir, legacyDir);
  await inspectLegacySource(resolvedLegacyDir, { signal });
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), "r3f-scroll-rig-recording-"),
  );
  let originalServer;
  let showcaseServer;
  let browser;
  let browserLaunchPromise;
  let outputs;
  let operationError;
  try {
    originalServer = await startOriginalServer(resolvedLegacyDir, { signal });
    showcaseServer = await startShowcaseServer(rootDir, { signal });
    const { chromium } = await awaitWithAbort(loadChromium(rootDir), signal);
    browserLaunchPromise = chromium.launch({
      headless: true,
      args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"],
    });
    browser = await awaitWithAbort(
      browserLaunchPromise,
      signal,
    );
    await awaitWithAbort(
      captureOriginal(browser, path.join(temporaryRoot, "original")),
      signal,
    );
    await awaitWithAbort(
      captureLighthouse(browser, path.join(temporaryRoot, "lighthouse")),
      signal,
    );
    outputs = RECORDINGS.map(({ output }) => path.join(rootDir, output));
    await encodeAndPublishGifs({
      temporaryRoot,
      frameDirectories: [
        path.join(temporaryRoot, "original"),
        path.join(temporaryRoot, "lighthouse"),
      ],
      outputs,
      signal,
    });
  } catch (error) {
    operationError = error;
  }
  await cleanupRecordingResources(
    {
      browser,
      browserLaunchPromise: signal?.aborted && !browser
        ? browserLaunchPromise
        : undefined,
      showcaseServer,
      originalServer,
      temporaryRoot,
    },
    { operationError },
  );
  return outputs;
}

export async function runRecorderCli({
  processImpl = process,
  recordImpl = recordR3fScrollRigDemos,
  logImpl = console.log,
  errorImpl = console.error,
} = {}) {
  const controller = new AbortController();
  let receivedSignal;
  const handlers = new Map();
  for (const signalName of ["SIGINT", "SIGTERM"]) {
    const handler = () => {
      if (receivedSignal) return;
      receivedSignal = signalName;
      const error = new Error(`Recording interrupted by ${signalName}`);
      error.name = "AbortError";
      error.signal = signalName;
      controller.abort(error);
    };
    handlers.set(signalName, handler);
    processImpl.on(signalName, handler);
  }

  try {
    const files = await recordImpl({ signal: controller.signal });
    if (receivedSignal) {
      const exitCode = 128 + os.constants.signals[receivedSignal];
      processImpl.exitCode = exitCode;
      return exitCode;
    }
    logImpl(`Recorded r3f-scroll-rig GIFs:\n${files.join("\n")}`);
    return 0;
  } catch (error) {
    if (receivedSignal) {
      const exitCode = 128 + os.constants.signals[receivedSignal];
      processImpl.exitCode = exitCode;
      return exitCode;
    }
    errorImpl(error.stack || error.message);
    processImpl.exitCode = 1;
    return 1;
  } finally {
    for (const [signalName, handler] of handlers) {
      processImpl.off(signalName, handler);
    }
  }
}
