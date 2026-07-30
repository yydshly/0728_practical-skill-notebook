import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as recordingModule from "../scripts/lib/mengto-showcase-recording.mjs";
import {
  CAPTURE_STAGES,
  FRAME_RATE,
  GIF_WIDTH,
  MAX_GIF_BYTES,
  SHOWCASE_GIF,
  assertGifFile,
  commandInvocation,
  createPreviewLifecycle,
  createGifCommands,
  publishGifCandidate,
  recordMengToShowcaseDemo,
  resolveChromium,
  resolveFfmpegCommand,
  stopPreview,
  waitForServer,
} from "../scripts/lib/mengto-showcase-recording.mjs";

const oneFrameLoopingGif = Buffer.from(
  "R0lGODlh0ALgAYAAAAAAAP///yH/C05FVFNDQVBFMi4wAwEAAAAh+QQAGQAAACwAAAAAAQABAAACAkQBADs=",
  "base64",
);

function gifHeaderStub(width = GIF_WIDTH, height = 480) {
  const bytes = Buffer.alloc(16);
  bytes.write("GIF89a", 0, "ascii");
  bytes.writeUInt16LE(width, 6);
  bytes.writeUInt16LE(height, 8);
  return bytes;
}

function archiveGif({
  frames = 60,
  delayCentiseconds = 25,
  loopCount = 0,
  width = GIF_WIDTH,
  height = 480,
  invalidLzw = false,
  paddingBytes = null,
} = {}) {
  const gceMarker = Buffer.from([0x21, 0xf9, 0x04]);
  const gceOffset = oneFrameLoopingGif.indexOf(gceMarker);
  const trailerOffset = oneFrameLoopingGif.lastIndexOf(0x3b);
  const prefix = Buffer.from(oneFrameLoopingGif.subarray(0, gceOffset));
  let frame = Buffer.from(
    oneFrameLoopingGif.subarray(gceOffset, trailerOffset),
  );
  prefix.writeUInt16LE(width, 6);
  prefix.writeUInt16LE(height, 8);
  const loopDataOffset = prefix.indexOf(
    Buffer.from([0x03, 0x01, 0x00, 0x00, 0x00]),
  );
  prefix.writeUInt16LE(loopCount, loopDataOffset + 2);
  frame.writeUInt16LE(delayCentiseconds, 4);
  if (invalidLzw) {
    const imageDataOffset = frame.indexOf(
      Buffer.from([0x02, 0x02, 0x44, 0x01, 0x00]),
    );
    frame[imageDataOffset + 2] = 0x7c;
  }
  if (paddingBytes) {
    const imageData = Buffer.from([0x02, 0x02, 0x44, 0x01, 0x00]);
    const imageDataOffset = frame.indexOf(imageData);
    frame.writeUInt16LE(3, 13);
    frame = Buffer.concat([
      frame.subarray(0, imageDataOffset),
      Buffer.from([
        0x02,
        0x03 + paddingBytes.length,
        0x04,
        0x41,
        0xb0,
        ...paddingBytes,
        0x00,
      ]),
      frame.subarray(imageDataOffset + imageData.length),
    ]);
  }
  return Buffer.concat([
    prefix,
    ...Array.from({ length: frames }, () => frame),
    Buffer.from([0x3b]),
  ]);
}

async function settlementAttempt({
  result = { output: SHOWCASE_GIF },
  recordingError = null,
  browserError = null,
  previewError = null,
  tempError = null,
} = {}) {
  const order = [];
  const browser = { id: "browser" };
  const preview = { id: "preview" };
  const temporaryRoot = "fixture-temporary-root";
  const promise = recordingModule.settleRecordingAttempt({
    result,
    recordingError,
    browser,
    preview,
    temporaryRoot,
    closeBrowser: async (received) => {
      assert.equal(received, browser);
      order.push("browser");
      if (browserError) throw browserError;
    },
    stopPreviewImpl: async (received) => {
      assert.equal(received, preview);
      order.push("preview");
      if (previewError) throw previewError;
    },
    removeTemporaryRoot: async (received) => {
      assert.equal(received, temporaryRoot);
      order.push("temp");
      if (tempError) throw tempError;
    },
  });
  return { order, promise };
}

function fakeChild() {
  const child = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.killSignals = [];
  child.kill = (signal = "SIGTERM") => {
    child.killSignals.push(signal);
    return true;
  };
  return child;
}

test("recording manifest fixes one 15-second four-stage GIF", () => {
  assert.equal(SHOWCASE_GIF, "docs/demos/07-mengto-skills-showcase.gif");
  assert.deepEqual(CAPTURE_STAGES.map(({ id }) => id), [
    "showcase-hub", "monster-forge", "ashfall-arena", "mech-atelier",
  ]);
  assert.equal(CAPTURE_STAGES.reduce((sum, stage) => sum + stage.frames, 0), 60);
  assert.equal(60 / FRAME_RATE, 15);
  assert.equal(GIF_WIDTH, 720);
  assert.equal(MAX_GIF_BYTES, 5 * 1024 * 1024);
});

test("capture paths use only the same-origin composite preview", () => {
  for (const stage of CAPTURE_STAGES) {
    assert.match(stage.path, /^\//);
    assert.doesNotMatch(stage.path, /417[2-5]|localhost|vesperfall/i);
  }
  assert.equal(
    CAPTURE_STAGES.find(({ id }) => id === "monster-forge")?.path,
    "/monster-forge/?review=ash-warden",
  );
  assert.match(
    CAPTURE_STAGES.find(({ id }) => id === "ashfall-arena")?.path ?? "",
    /fixture=fresh.*safeTraining=1.*capture=1/,
  );
});

test("preview readiness cannot be borrowed from an old service", async () => {
  let exitCode = null;
  const preview = {
    child: {
      get exitCode() {
        return exitCode;
      },
    },
    output: () => "Port 5277 is already in use",
  };
  await assert.rejects(
    () => waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => ({
        ok: true,
        text: async () =>
          '<meta name="showcase-app" content="showcase-hub">',
      }),
      sleep: async () => {
        exitCode = 1;
      },
    }),
    /Port 5277 is already in use/,
  );
});

test("an old Hub cannot pass while the new child is still starting", async () => {
  let exitCode = null;
  let sleeps = 0;
  const preview = {
    child: {
      get exitCode() {
        return exitCode;
      },
    },
    output: () => "loading Vite config",
  };
  await assert.rejects(
    () => waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => ({
        ok: true,
        text: async () =>
          '<meta name="showcase-app" content="showcase-hub">',
      }),
      sleep: async () => {
        sleeps += 1;
        if (sleeps === 3) {
          exitCode = 1;
        }
      },
    }),
    /Vite exited before/,
  );
  assert.equal(sleeps, 3);
});

test("readiness needs this child's Local URL and the Hub marker", async () => {
  const preview = {
    child: { exitCode: null },
    output: () => "➜  Local: http://127.0.0.1:5277/",
  };
  await waitForServer("http://127.0.0.1:5277/", preview, {
    fetchImpl: async () => ({
      ok: true,
      text: async () =>
        '<meta name="showcase-app" content="showcase-hub">',
    }),
    sleep: async () => undefined,
  });
});

test("readiness accepts Vite's self-closing Hub marker", async () => {
  const preview = {
    child: { exitCode: null },
    output: () =>
      "\u001B[32m➜\u001B[39m  Local: http://127.0.0.1:\u001B[1m5277\u001B[22m/",
  };
  await waitForServer("http://127.0.0.1:5277/", preview, {
    fetchImpl: async () => ({
      ok: true,
      text: async () =>
        '<meta name="showcase-app" content="showcase-hub" />',
    }),
    sleep: async () => undefined,
  });
});

test("readiness rejects a same-origin page without the Hub marker", async () => {
  const preview = {
    child: { exitCode: null, signalCode: null },
    output: () => "➜  Local: http://127.0.0.1:5277/",
  };
  await assert.rejects(
    () => waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => ({
        ok: true,
        text: async () =>
          '<meta name="showcase-app" content="not-showcase-hub">',
      }),
      sleep: async () => undefined,
      readinessTimeoutMs: 20,
      requestTimeoutMs: 5,
    }),
    /Timed out waiting/,
  );
});

test("a signal-terminated preview fails readiness immediately", async () => {
  const preview = {
    child: { exitCode: null, signalCode: "SIGTERM" },
    output: () => "terminated",
  };
  await assert.rejects(
    () => waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => ({
        ok: false,
        text: async () => "",
      }),
      sleep: async () => undefined,
    }),
    /Vite exited before.*terminated/s,
  );
});

test("readiness has a real deadline when fetch never settles", async () => {
  const preview = {
    child: { exitCode: null, signalCode: null },
    output: () => "➜  Local: http://127.0.0.1:5277/",
  };
  const guard = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("fetch test guard expired")), 200);
  });
  await assert.rejects(
    Promise.race([
      waitForServer("http://127.0.0.1:5277/", preview, {
        fetchImpl: async () => new Promise(() => undefined),
        sleep: async () => undefined,
        readinessTimeoutMs: 30,
        requestTimeoutMs: 10,
      }),
      guard,
    ]),
    /Timed out waiting/,
  );
});

test("readiness has a real deadline when response text never settles", async () => {
  const preview = {
    child: { exitCode: null, signalCode: null },
    output: () => "➜  Local: http://127.0.0.1:5277/",
  };
  const guard = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("response text test guard expired")), 200);
  });
  await assert.rejects(
    Promise.race([
      waitForServer("http://127.0.0.1:5277/", preview, {
        fetchImpl: async () => ({
          ok: true,
          text: async () => new Promise(() => undefined),
        }),
        sleep: async () => undefined,
        readinessTimeoutMs: 30,
        requestTimeoutMs: 10,
      }),
      guard,
    ]),
    /Timed out waiting/,
  );
});

test("hung fetch loses the race when this preview closes by signal", async () => {
  const child = fakeChild();
  const preview = createPreviewLifecycle(
    child,
    () => "➜  Local: http://127.0.0.1:5277/",
  );
  setTimeout(() => {
    child.signalCode = "SIGTERM";
    child.emit("close", null, "SIGTERM");
  }, 5);
  await assert.rejects(
    waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => new Promise(() => undefined),
      readinessTimeoutMs: 1_000,
      requestTimeoutMs: 1_000,
    }),
    /Vite exited before.*SIGTERM/s,
  );
});

test("hung response text loses the race when this preview closes", async () => {
  const child = fakeChild();
  const preview = createPreviewLifecycle(
    child,
    () => "➜  Local: http://127.0.0.1:5277/",
  );
  setTimeout(() => {
    child.exitCode = 1;
    child.emit("close", 1, null);
  }, 5);
  await assert.rejects(
    waitForServer("http://127.0.0.1:5277/", preview, {
      fetchImpl: async () => ({
        ok: true,
        text: async () => new Promise(() => undefined),
      }),
      readinessTimeoutMs: 1_000,
      requestTimeoutMs: 1_000,
    }),
    /Vite exited before/,
  );
});

test("preview lifecycle keeps spawn errors handled after termination", async () => {
  const child = fakeChild();
  const preview = createPreviewLifecycle(child, () => "");
  assert.doesNotThrow(() => {
    child.emit("error", new Error("spawn ENOENT"));
  });
  const termination = await preview.completion;
  assert.equal(termination.error.message, "spawn ENOENT");
  assert.doesNotThrow(() => {
    child.emit("error", new Error("late spawn error"));
  });
  await stopPreview(preview, {
    graceTimeoutMs: 5,
    forceTimeoutMs: 5,
  });
  assert.deepEqual(child.killSignals, []);
});

test("cleanup returns immediately after close already happened", async () => {
  const child = fakeChild();
  const preview = createPreviewLifecycle(child, () => "");
  child.signalCode = "SIGTERM";
  child.emit("close", null, "SIGTERM");
  await preview.completion;
  await stopPreview(preview, {
    graceTimeoutMs: 5,
    forceTimeoutMs: 5,
  });
  assert.deepEqual(child.killSignals, []);
});

test("cleanup tolerates close winning the race with kill", async () => {
  const child = fakeChild();
  child.kill = () => {
    child.signalCode = "SIGTERM";
    child.emit("close", null, "SIGTERM");
    throw new Error("kill raced with close");
  };
  const preview = createPreviewLifecycle(child, () => "");
  await stopPreview(preview, {
    graceTimeoutMs: 5,
    forceTimeoutMs: 5,
  });
  assert.equal((await preview.completion).signalCode, "SIGTERM");
});

test("cleanup escalates to a bounded forced termination", async () => {
  const child = fakeChild();
  child.kill = (signal = "SIGTERM") => {
    child.killSignals.push(signal);
    if (signal === "SIGKILL") {
      child.signalCode = "SIGKILL";
      queueMicrotask(() => child.emit("close", null, "SIGKILL"));
    }
    return true;
  };
  const preview = createPreviewLifecycle(child, () => "");
  await stopPreview(preview, {
    graceTimeoutMs: 5,
    forceTimeoutMs: 50,
  });
  assert.deepEqual(child.killSignals, ["SIGTERM", "SIGKILL"]);
});

test("a kill error on a live preview still escalates to SIGKILL", async () => {
  const child = fakeChild();
  child.pid = 42_424;
  let completionSettled = false;
  let completionSettledBeforeForce = null;
  child.kill = (signal = "SIGTERM") => {
    child.killSignals.push(signal);
    if (signal === "SIGTERM") {
      queueMicrotask(() => {
        child.emit("error", new Error("kill EPERM"));
      });
    } else {
      completionSettledBeforeForce = completionSettled;
      queueMicrotask(() => {
        child.signalCode = "SIGKILL";
        child.emit("close", null, "SIGKILL");
      });
    }
    return true;
  };
  const preview = createPreviewLifecycle(child, () => "");
  preview.completion.then(() => {
    completionSettled = true;
  });

  const termination = await stopPreview(preview, {
    graceTimeoutMs: 5,
    forceTimeoutMs: 50,
  });

  assert.deepEqual(child.killSignals, ["SIGTERM", "SIGKILL"]);
  assert.equal(completionSettledBeforeForce, false);
  assert.equal(termination.signalCode, "SIGKILL");
  assert.equal(preview.lastError.message, "kill EPERM");
});

test("a live preview that ignores SIGKILL fails cleanup within bounds", async () => {
  const child = fakeChild();
  child.pid = 42_425;
  let completionSettled = false;
  child.kill = (signal = "SIGTERM") => {
    child.killSignals.push(signal);
    if (signal === "SIGTERM") {
      queueMicrotask(() => {
        child.emit("error", new Error("kill EACCES"));
      });
    }
    return true;
  };
  const preview = createPreviewLifecycle(child, () => "");
  preview.completion.then(() => {
    completionSettled = true;
  });

  await assert.rejects(
    () => stopPreview(preview, {
      graceTimeoutMs: 5,
      forceTimeoutMs: 5,
    }),
    /did not close after forced termination/,
  );
  assert.deepEqual(child.killSignals, ["SIGTERM", "SIGKILL"]);
  assert.equal(completionSettled, false);
  assert.equal(preview.termination, null);
  assert.equal(preview.lastError.message, "kill EACCES");
});

test("Windows npm and a configured FFmpeg executable resolve explicitly", () => {
  assert.deepEqual(commandInvocation("npm", "win32"), { command: "npm.cmd", shell: true });
  assert.deepEqual(commandInvocation("node", "win32"), { command: "node", shell: false });
  assert.equal(resolveFfmpegCommand({ MENGTO_SHOWCASE_FFMPEG: "C:\\tools\\ffmpeg.exe" }), "C:\\tools\\ffmpeg.exe");
  assert.equal(resolveFfmpegCommand({}), "ffmpeg");
});

test("CommonJS Playwright default export exposes Chromium", () => {
  const chromium = { launch: () => undefined };
  assert.equal(resolveChromium({ default: { chromium } }), chromium);
});

test("GIF commands use a two-pass 720px looping palette pipeline", () => {
  const commands = createGifCommands({ framePattern: "frame-%03d.png", palettePath: "palette.png", outputPath: "showcase.gif" });
  assert.equal(commands.length, 2);
  assert.match(commands[0].join(" "), /palettegen/);
  assert.match(commands[1].join(" "), /paletteuse/);
  assert.match(commands[1].join(" "), /scale=720:-2/);
  assert.deepEqual(commands[1].slice(-3), ["-loop", "0", "showcase.gif"]);
});

test("GIF inspection returns the locked archive manifest", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-test-"));
  try {
    const valid = path.join(directory, "valid.gif");
    const bytes = archiveGif();
    await writeFile(valid, bytes);
    assert.deepEqual(await assertGifFile(valid), {
      signature: "GIF89a",
      width: 720,
      height: 480,
      frameRate: 4,
      frames: 60,
      durationSeconds: 15,
      loopCount: 0,
      size: bytes.length,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF inspection rejects a header-only stub and truncation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-structure-"));
  try {
    const stub = path.join(directory, "stub.gif");
    const truncated = path.join(directory, "truncated.gif");
    await writeFile(stub, gifHeaderStub());
    await writeFile(truncated, archiveGif().subarray(0, -1));
    await assert.rejects(() => assertGifFile(stub), /GIF/);
    await assert.rejects(() => assertGifFile(truncated), /GIF/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF inspection rejects a one-frame or wrong-delay manifest", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-timing-"));
  try {
    const oneFrame = path.join(directory, "one-frame.gif");
    const wrongDelay = path.join(directory, "wrong-delay.gif");
    await writeFile(oneFrame, archiveGif({ frames: 1 }));
    await writeFile(
      wrongDelay,
      archiveGif({ delayCentiseconds: 24 }),
    );
    await assert.rejects(() => assertGifFile(oneFrame), /GIF.*60/i);
    await assert.rejects(() => assertGifFile(wrongDelay), /GIF.*25/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF inspection rejects finite looping and invalid LZW", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-data-"));
  try {
    const finiteLoop = path.join(directory, "finite-loop.gif");
    const invalidLzw = path.join(directory, "invalid-lzw.gif");
    await writeFile(finiteLoop, archiveGif({ loopCount: 1 }));
    await writeFile(invalidLzw, archiveGif({ invalidLzw: true }));
    await assert.rejects(() => assertGifFile(finiteLoop), /GIF.*loop/i);
    await assert.rejects(() => assertGifFile(invalidLzw), /GIF.*LZW/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF inspection permits only one zero byte after an aligned LZW end code", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-padding-"));
  try {
    const allowed = path.join(directory, "one-zero-byte.gif");
    const nonzero = path.join(directory, "nonzero-byte.gif");
    const overlong = path.join(directory, "two-zero-bytes.gif");
    await writeFile(allowed, archiveGif({ paddingBytes: [0x00] }));
    await writeFile(nonzero, archiveGif({ paddingBytes: [0x01] }));
    await writeFile(
      overlong,
      archiveGif({ paddingBytes: [0x00, 0x00] }),
    );
    await assert.doesNotReject(() => assertGifFile(allowed));
    await assert.rejects(() => assertGifFile(nonzero), /GIF.*LZW/i);
    await assert.rejects(() => assertGifFile(overlong), /GIF.*LZW/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF inspection rejects wrong dimensions and files over 5 MiB", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-limits-"));
  try {
    const wrongWidth = path.join(directory, "wrong-width.gif");
    const wrongHeight = path.join(directory, "wrong-height.gif");
    const oversized = path.join(directory, "oversized.gif");
    await writeFile(wrongWidth, archiveGif({ width: 640 }));
    await writeFile(wrongHeight, archiveGif({ height: 400 }));
    await writeFile(
      oversized,
      Buffer.concat([
        archiveGif(),
        Buffer.alloc(MAX_GIF_BYTES + 1 - archiveGif().length),
      ]),
    );
    await assert.rejects(() => assertGifFile(wrongWidth), /GIF.*720/i);
    await assert.rejects(() => assertGifFile(wrongHeight), /GIF.*480/i);
    await assert.rejects(() => assertGifFile(oversized), /5 MiB/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("recording settlement returns the result after ordered cleanup", async () => {
  const result = { output: SHOWCASE_GIF };
  const attempt = await settlementAttempt({ result });
  assert.equal(await attempt.promise, result);
  assert.deepEqual(attempt.order, ["browser", "preview", "temp"]);
});

for (const cleanup of ["browser", "preview", "temp"]) {
  test(`recording settlement preserves a lone ${cleanup} cleanup failure`, async () => {
    const failure = new Error(`${cleanup} cleanup failed`);
    const attempt = await settlementAttempt({
      [`${cleanup}Error`]: failure,
    });
    const caught = await attempt.promise.then(
      () => assert.fail("expected settlement to reject"),
      (error) => error,
    );
    assert.equal(caught, failure);
    assert.deepEqual(attempt.order, ["browser", "preview", "temp"]);
  });
}

test("recording settlement aggregates primary and cleanup failures in order", async () => {
  const failures = [
    new Error("recording failed"),
    new Error("browser cleanup failed"),
    new Error("preview cleanup failed"),
    new Error("temp cleanup failed"),
  ];
  const attempt = await settlementAttempt({
    recordingError: failures[0],
    browserError: failures[1],
    previewError: failures[2],
    tempError: failures[3],
  });
  const caught = await attempt.promise.then(
    () => assert.fail("expected settlement to reject"),
    (error) => error,
  );
  assert.ok(caught instanceof AggregateError);
  assert.deepEqual(caught.errors, failures);
  assert.equal(caught.cause, failures[0]);
  assert.deepEqual(attempt.order, ["browser", "preview", "temp"]);
});

test("recording settlement aggregates simultaneous cleanup failures", async () => {
  const failures = [
    new Error("browser cleanup failed"),
    new Error("preview cleanup failed"),
    new Error("temp cleanup failed"),
  ];
  const attempt = await settlementAttempt({
    browserError: failures[0],
    previewError: failures[1],
    tempError: failures[2],
  });
  const caught = await attempt.promise.then(
    () => assert.fail("expected settlement to reject"),
    (error) => error,
  );
  assert.ok(caught instanceof AggregateError);
  assert.deepEqual(caught.errors, failures);
  assert.equal(caught.cause, failures[0]);
  assert.deepEqual(attempt.order, ["browser", "preview", "temp"]);
});

test("an invalid candidate cannot overwrite an existing final GIF", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "mengto-gif-publish-test-"),
  );
  try {
    const candidate = path.join(directory, "candidate.gif");
    const output = path.join(directory, "final.gif");
    await writeFile(candidate, Buffer.from("not a gif"));
    await writeFile(output, archiveGif());
    const before = await readFile(output);

    await assert.rejects(
      () => publishGifCandidate(candidate, output),
      /GIF signature/,
    );
    assert.deepEqual(await readFile(output), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
