import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
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

function gifHeader(width = GIF_WIDTH, height = 480) {
  const bytes = Buffer.alloc(16);
  bytes.write("GIF89a", 0, "ascii");
  bytes.writeUInt16LE(width, 6);
  bytes.writeUInt16LE(height, 8);
  return bytes;
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

test("GIF inspection rejects signatures, widths, and files over 5 MiB", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mengto-gif-test-"));
  try {
    const valid = path.join(directory, "valid.gif");
    const invalid = path.join(directory, "invalid.gif");
    const wrongWidth = path.join(directory, "wrong-width.gif");
    const oversized = path.join(directory, "oversized.gif");
    await writeFile(valid, gifHeader());
    await writeFile(invalid, Buffer.from("not a gif"));
    await writeFile(wrongWidth, gifHeader(640));
    await writeFile(oversized, Buffer.concat([gifHeader(), Buffer.alloc(MAX_GIF_BYTES + 1 - gifHeader().length)]));
    assert.deepEqual(await assertGifFile(valid), { signature: "GIF89a", width: 720, size: 16 });
    await assert.rejects(() => assertGifFile(invalid), /GIF signature/);
    await assert.rejects(() => assertGifFile(wrongWidth), /720/);
    await assert.rejects(() => assertGifFile(oversized), /5 MiB/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an invalid candidate cannot overwrite an existing final GIF", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "mengto-gif-publish-test-"),
  );
  try {
    const candidate = path.join(directory, "candidate.gif");
    const output = path.join(directory, "final.gif");
    await writeFile(candidate, Buffer.from("not a gif"));
    await writeFile(output, gifHeader());
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
