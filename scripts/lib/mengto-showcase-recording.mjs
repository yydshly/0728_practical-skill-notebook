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
export const GIF_HEIGHT = 480;
export const PREVIEW_PORT = 5277;
const GIF_FRAME_COUNT = 60;
const GIF_FRAME_DELAY_CENTISECONDS = 100 / FRAME_RATE;
const GIF_DURATION_CENTISECONDS =
  GIF_FRAME_COUNT * GIF_FRAME_DELAY_CENTISECONDS;

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

class GifReader {
  constructor(bytes, filePath) {
    this.bytes = bytes;
    this.filePath = filePath;
    this.offset = 0;
  }

  fail(message, offset = this.offset) {
    throw new Error(
      `GIF ${message} at byte ${offset}: ${this.filePath}`,
    );
  }

  take(length, context) {
    const start = this.offset;
    if (
      !Number.isInteger(length) ||
      length < 0 ||
      start + length > this.bytes.length
    ) {
      this.fail(`${context} is truncated`, start);
    }
    this.offset += length;
    return this.bytes.subarray(start, this.offset);
  }

  byte(context) {
    return this.take(1, context)[0];
  }

  uint16(context) {
    return this.take(2, context).readUInt16LE(0);
  }
}

function readGifSubBlocks(reader, context) {
  const blocks = [];
  let totalLength = 0;
  while (true) {
    const length = reader.byte(`${context} sub-block length`);
    if (length === 0) {
      break;
    }
    const block = reader.take(length, `${context} sub-block`);
    blocks.push(block);
    totalLength += length;
  }
  return {
    blocks,
    data: Buffer.concat(blocks, totalLength),
  };
}

function gifColorTableSize(packedFields) {
  return 1 << ((packedFields & 0x07) + 1);
}

function validateGifLzw({
  data,
  minCodeSize,
  expectedPixels,
  paletteSize,
  frame,
  filePath,
}) {
  const fail = (message) => {
    throw new Error(
      `GIF LZW frame ${frame} ${message}: ${filePath}`,
    );
  };
  if (minCodeSize < 2 || minCodeSize > 8) {
    fail(`minimum code size must be between 2 and 8, received ${minCodeSize}`);
  }

  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const firstDictionaryCode = endCode + 1;
  const prefix = new Int16Array(4096);
  const suffix = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  let nextCode = firstDictionaryCode;
  let codeSize = minCodeSize + 1;
  let previousCode = -1;
  let bitOffset = 0;
  let decodedPixels = 0;
  let sawEndCode = false;

  const reset = () => {
    nextCode = firstDictionaryCode;
    codeSize = minCodeSize + 1;
    previousCode = -1;
  };

  const readCode = () => {
    if (bitOffset + codeSize > data.length * 8) {
      return null;
    }
    let code = 0;
    for (let bit = 0; bit < codeSize; bit += 1) {
      code |=
        ((data[bitOffset >> 3] >> (bitOffset & 0x07)) & 0x01) << bit;
      bitOffset += 1;
    }
    return code;
  };

  const expand = (code) => {
    let depth = 0;
    let current = code;
    while (current >= clearCode) {
      if (
        current < firstDictionaryCode ||
        current >= nextCode ||
        depth >= 4096
      ) {
        fail(`contains an invalid dictionary code ${current}`);
      }
      stack[depth] = suffix[current];
      depth += 1;
      current = prefix[current];
    }
    stack[depth] = current;
    return depth + 1;
  };

  const emit = (paletteIndex) => {
    if (paletteIndex >= paletteSize) {
      fail(
        `emits palette index ${paletteIndex}, but the active table has ${paletteSize} entries`,
      );
    }
    decodedPixels += 1;
    if (decodedPixels > expectedPixels) {
      fail(`decodes more than ${expectedPixels} pixels`);
    }
  };

  while (true) {
    const code = readCode();
    if (code === null) {
      break;
    }
    if (code === clearCode) {
      reset();
      continue;
    }
    if (code === endCode) {
      sawEndCode = true;
      break;
    }

    let depth;
    let firstCharacter;
    const specialCode = code === nextCode && previousCode >= 0;
    if (code < nextCode) {
      depth = expand(code);
      firstCharacter = stack[depth - 1];
    } else if (specialCode) {
      depth = expand(previousCode);
      firstCharacter = stack[depth - 1];
    } else {
      fail(`contains invalid code ${code} before dictionary entry ${nextCode}`);
    }

    for (let index = depth - 1; index >= 0; index -= 1) {
      emit(stack[index]);
    }
    if (specialCode) {
      emit(firstCharacter);
    }

    if (previousCode >= 0 && nextCode < 4096) {
      prefix[nextCode] = previousCode;
      suffix[nextCode] = firstCharacter;
      nextCode += 1;
      if (nextCode === 1 << codeSize && codeSize < 12) {
        codeSize += 1;
      }
    }
    previousCode = code;
  }

  if (!sawEndCode) {
    fail("is missing an end code");
  }
  const remainingBits = data.length * 8 - bitOffset;
  if (remainingBits < 1 || remainingBits > 8) {
    fail(
      `must have between 1 and 8 padding bits after the end code, received ${remainingBits}`,
    );
  }
  for (let paddingBit = bitOffset; paddingBit < data.length * 8; paddingBit += 1) {
    if (
      ((data[paddingBit >> 3] >> (paddingBit & 0x07)) & 0x01) !== 0
    ) {
      fail("contains non-zero padding after the end code");
    }
  }
  if (decodedPixels !== expectedPixels) {
    fail(
      `decoded ${decodedPixels} pixels, expected ${expectedPixels}`,
    );
  }
}

function inspectGif(bytes, filePath) {
  const reader = new GifReader(bytes, filePath);
  const signature = reader.take(6, "header").toString("ascii");
  if (!["GIF87a", "GIF89a"].includes(signature)) {
    throw new Error(`Invalid GIF signature: ${filePath}`);
  }

  const width = reader.uint16("logical screen width");
  const height = reader.uint16("logical screen height");
  const logicalPackedFields = reader.byte(
    "logical screen packed fields",
  );
  const backgroundIndex = reader.byte("background color index");
  reader.byte("pixel aspect ratio");
  const hasGlobalColorTable = (logicalPackedFields & 0x80) !== 0;
  const globalColorTableSize = hasGlobalColorTable
    ? gifColorTableSize(logicalPackedFields)
    : 0;
  if (hasGlobalColorTable) {
    reader.take(
      globalColorTableSize * 3,
      "global color table",
    );
    if (backgroundIndex >= globalColorTableSize) {
      reader.fail(
        `background index ${backgroundIndex} is outside the global color table`,
      );
    }
  }

  let frames = 0;
  let totalDelayCentiseconds = 0;
  let loopCount = null;
  let pendingGraphicControl = null;
  let sawImage = false;
  let sawTrailer = false;

  while (reader.offset < bytes.length) {
    const blockOffset = reader.offset;
    const introducer = reader.byte("block introducer");
    if (introducer === 0x3b) {
      if (pendingGraphicControl) {
        reader.fail(
          "Graphics Control Extension has no following image",
          blockOffset,
        );
      }
      if (reader.offset !== bytes.length) {
        reader.fail("has bytes after the trailer", reader.offset);
      }
      sawTrailer = true;
      break;
    }

    if (introducer === 0x21) {
      const label = reader.byte("extension label");
      if (label === 0xf9) {
        if (pendingGraphicControl) {
          reader.fail(
            "has multiple Graphics Control Extensions before one image",
            blockOffset,
          );
        }
        const blockSize = reader.byte(
          "Graphics Control Extension block size",
        );
        if (blockSize !== 4) {
          reader.fail(
            `Graphics Control Extension block size must be 4, received ${blockSize}`,
            blockOffset,
          );
        }
        const control = reader.take(
          4,
          "Graphics Control Extension",
        );
        if (reader.byte("Graphics Control Extension terminator") !== 0) {
          reader.fail(
            "Graphics Control Extension terminator must be zero",
            blockOffset,
          );
        }
        if ((control[0] & 0xe0) !== 0) {
          reader.fail(
            "Graphics Control Extension reserved bits must be zero",
            blockOffset,
          );
        }
        if ((control[0] & 0x02) !== 0) {
          reader.fail(
            "Graphics Control Extension cannot wait for user input",
            blockOffset,
          );
        }
        pendingGraphicControl = {
          delayCentiseconds: control.readUInt16LE(1),
          transparent: (control[0] & 0x01) !== 0,
          transparentIndex: control[3],
        };
        continue;
      }

      if (label === 0xff) {
        const blockSize = reader.byte("Application Extension block size");
        if (blockSize !== 11) {
          reader.fail(
            `Application Extension block size must be 11, received ${blockSize}`,
            blockOffset,
          );
        }
        const identifier = reader
          .take(11, "Application Extension identifier")
          .toString("ascii");
        const applicationData = readGifSubBlocks(
          reader,
          "Application Extension data",
        );
        if (
          identifier === "NETSCAPE2.0" ||
          identifier === "ANIMEXTS1.0"
        ) {
          if (sawImage) {
            reader.fail(
              "loop extension must precede all images",
              blockOffset,
            );
          }
          if (loopCount !== null) {
            reader.fail("has multiple loop extensions", blockOffset);
          }
          if (
            applicationData.blocks.length !== 1 ||
            applicationData.blocks[0].length !== 3 ||
            applicationData.blocks[0][0] !== 1
          ) {
            reader.fail("loop extension data is malformed", blockOffset);
          }
          loopCount = applicationData.blocks[0].readUInt16LE(1);
        }
        continue;
      }

      if (label === 0xfe) {
        readGifSubBlocks(reader, "Comment Extension data");
        continue;
      }

      if (label === 0x01) {
        const blockSize = reader.byte("Plain Text Extension block size");
        if (blockSize !== 12) {
          reader.fail(
            `Plain Text Extension block size must be 12, received ${blockSize}`,
            blockOffset,
          );
        }
        reader.take(12, "Plain Text Extension header");
        readGifSubBlocks(reader, "Plain Text Extension data");
        reader.fail(
          "Plain Text Extension is unsupported in the archive manifest",
          blockOffset,
        );
      }

      readGifSubBlocks(reader, "unknown Extension data");
      reader.fail(
        `uses unsupported extension label 0x${label.toString(16)}`,
        blockOffset,
      );
    }

    if (introducer !== 0x2c) {
      reader.fail(
        `has unsupported block introducer 0x${introducer.toString(16)}`,
        blockOffset,
      );
    }
    if (!pendingGraphicControl) {
      reader.fail(
        `image ${frames + 1} is missing a Graphics Control Extension`,
        blockOffset,
      );
    }

    const left = reader.uint16("image left position");
    const top = reader.uint16("image top position");
    const imageWidth = reader.uint16("image width");
    const imageHeight = reader.uint16("image height");
    const imagePackedFields = reader.byte("image packed fields");
    if (
      imageWidth === 0 ||
      imageHeight === 0 ||
      left + imageWidth > width ||
      top + imageHeight > height
    ) {
      reader.fail(
        `image ${frames + 1} lies outside the logical screen`,
        blockOffset,
      );
    }
    const hasLocalColorTable = (imagePackedFields & 0x80) !== 0;
    const localColorTableSize = hasLocalColorTable
      ? gifColorTableSize(imagePackedFields)
      : 0;
    if (hasLocalColorTable) {
      reader.take(
        localColorTableSize * 3,
        `image ${frames + 1} local color table`,
      );
    }
    const activeColorTableSize =
      localColorTableSize || globalColorTableSize;
    if (activeColorTableSize === 0) {
      reader.fail(
        `image ${frames + 1} has no active color table`,
        blockOffset,
      );
    }
    if (
      pendingGraphicControl.transparent &&
      pendingGraphicControl.transparentIndex >= activeColorTableSize
    ) {
      reader.fail(
        `image ${frames + 1} transparency index is outside the active color table`,
        blockOffset,
      );
    }

    const minCodeSize = reader.byte(
      `image ${frames + 1} LZW minimum code size`,
    );
    const imageData = readGifSubBlocks(
      reader,
      `image ${frames + 1} data`,
    );
    validateGifLzw({
      data: imageData.data,
      minCodeSize,
      expectedPixels: imageWidth * imageHeight,
      paletteSize: activeColorTableSize,
      frame: frames + 1,
      filePath,
    });
    frames += 1;
    sawImage = true;
    totalDelayCentiseconds +=
      pendingGraphicControl.delayCentiseconds;
    if (
      pendingGraphicControl.delayCentiseconds !==
      GIF_FRAME_DELAY_CENTISECONDS
    ) {
      throw new Error(
        `GIF frame ${frames} delay must be ${GIF_FRAME_DELAY_CENTISECONDS} centiseconds, received ${pendingGraphicControl.delayCentiseconds}: ${filePath}`,
      );
    }
    pendingGraphicControl = null;
  }

  if (!sawTrailer) {
    reader.fail("trailer is missing or truncated");
  }
  if (width !== GIF_WIDTH || height !== GIF_HEIGHT) {
    throw new Error(
      `GIF logical screen must be ${GIF_WIDTH}x${GIF_HEIGHT}, received ${width}x${height}: ${filePath}`,
    );
  }
  if (frames !== GIF_FRAME_COUNT) {
    throw new Error(
      `GIF must contain exactly ${GIF_FRAME_COUNT} frames, received ${frames}: ${filePath}`,
    );
  }
  if (totalDelayCentiseconds !== GIF_DURATION_CENTISECONDS) {
    throw new Error(
      `GIF duration must be ${GIF_DURATION_CENTISECONDS} centiseconds, received ${totalDelayCentiseconds}: ${filePath}`,
    );
  }
  if (loopCount !== 0) {
    const received =
      loopCount === null ? "no explicit loop extension" : loopCount;
    throw new Error(
      `GIF loop count must be 0 for infinite looping, received ${received}: ${filePath}`,
    );
  }
  return {
    signature,
    width,
    height,
    frameRate: FRAME_RATE,
    frames,
    durationSeconds: totalDelayCentiseconds / 100,
    loopCount,
  };
}

export async function assertGifFile(
  filePath,
  {
    maxBytes = MAX_GIF_BYTES,
  } = {},
) {
  const metadata = await stat(filePath);
  if (metadata.size === 0 || metadata.size > maxBytes) {
    throw new Error(
      `GIF must be non-empty and no larger than 5 MiB: ${filePath}`,
    );
  }
  const bytes = await readFile(filePath);
  if (bytes.length === 0 || bytes.length > maxBytes) {
    throw new Error(
      `GIF must be non-empty and no larger than 5 MiB: ${filePath}`,
    );
  }
  return {
    ...inspectGif(bytes, filePath),
    size: bytes.length,
  };
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
  let lastError = null;
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
    lastError = error;
    const confirmedTermination = observedChildTermination(child);
    if (confirmedTermination) {
      settle({ ...confirmedTermination, error });
    } else if (child.pid == null) {
      settle({
        exitCode: null,
        signalCode: null,
        error,
      });
    }
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
    get lastError() {
      return lastError;
    },
  };
}

function previewTermination(preview) {
  return preview.termination ?? observedChildTermination(preview.child);
}

function previewExitError(url, preview) {
  const termination = previewTermination(preview);
  const observedError = termination?.error ?? preview.lastError;
  const lifecycleDetails = observedError
    ? observedError.message
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

export async function settleRecordingAttempt({
  result,
  recordingError = null,
  browser,
  preview,
  temporaryRoot,
  closeBrowser = async (target) => target.close(),
  stopPreviewImpl = stopPreview,
  removeTemporaryRoot = async (root) =>
    rm(root, { recursive: true, force: true }),
}) {
  const errors = recordingError ? [recordingError] : [];
  if (browser) {
    try {
      await closeBrowser(browser);
    } catch (error) {
      errors.push(error);
    }
  }
  if (preview) {
    try {
      await stopPreviewImpl(preview);
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    await removeTemporaryRoot(temporaryRoot);
  } catch (error) {
    errors.push(error);
  }

  if (errors.length === 1) {
    throw errors[0];
  }
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      "MengTo showcase recording and cleanup failed.",
      { cause: recordingError ?? errors[0] },
    );
  }
  return result;
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
  let result;
  let recordingError = null;

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
    result = {
      output: SHOWCASE_GIF,
      ...artifact,
    };
  } catch (error) {
    recordingError = error;
  }
  return settleRecordingAttempt({
    result,
    recordingError,
    browser,
    preview,
    temporaryRoot,
  });
}
