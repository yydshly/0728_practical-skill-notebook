import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  copyFile,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as recording from "../scripts/lib/r3f-scroll-rig-recording.mjs";
import {
  CAPTURE_VIEWPORT,
  ORIGINAL_SCROLL_STOPS,
  RECORDINGS,
  SHOWCASE_SCROLL_STOPS,
  UPSTREAM_COMMIT,
  UPSTREAM_REPOSITORY_VERSION,
  assertGifFile,
  assertLegacySource,
  buildScrollFrames,
  navigateLighthousePage,
  navigateOriginalPage,
  scrollPageTo,
  waitForLighthouseHeading,
  waitForOriginalReadiness,
} from "../scripts/lib/r3f-scroll-rig-recording.mjs";

async function createLoopbackProcessFixture(pid) {
  const server = createServer((_request, response) => response.end("ready"));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const child = new EventEmitter();
  child.pid = pid;
  child.exitCode = null;
  const url = `http://127.0.0.1:${server.address().port}/`;
  return {
    child,
    server,
    url,
    terminate() {
      server.close(() => {
        child.exitCode = 0;
        child.emit("exit", 0, null);
      });
    },
    async cleanup() {
      if (!server.listening) return;
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function createGifFixture({
  signature = "GIF89a",
  width = 960,
  height = 640,
  frameCount = 40,
  frameDelays = Array.from({ length: frameCount }, () => 20),
  loopCount = 0,
  paddingByte = 0,
  truncateBytes = 0,
} = {}) {
  const chunks = [];
  const word = (value) => Buffer.from([value & 0xff, (value >> 8) & 0xff]);
  chunks.push(
    Buffer.from(signature, "ascii"),
    word(width),
    word(height),
    Buffer.from([0x80, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0xff, 0xff, 0xff]),
    Buffer.from([0x21, 0xff, 0x0b]),
    Buffer.from("NETSCAPE2.0", "ascii"),
    Buffer.from([0x03, 0x01, loopCount & 0xff, (loopCount >> 8) & 0xff, 0x00]),
  );
  for (let index = 0; index < frameCount; index += 1) {
    const delay = frameDelays[index] ?? 20;
    chunks.push(
      Buffer.from([0x21, 0xf9, 0x04, 0x00]),
      word(delay),
      Buffer.from([0x00, 0x00]),
      Buffer.from([
        0x2c,
        0x00, 0x00,
        0x00, 0x00,
        0x01, 0x00,
        0x01, 0x00,
        0x00,
        0x02,
        0x02, 0x44, 0x01,
        0x00,
      ]),
    );
  }
  chunks.push(Buffer.from([0x21, 0xfe]));
  let padding = 10_500;
  while (padding > 0) {
    const blockLength = Math.min(255, padding);
    chunks.push(
      Buffer.from([blockLength]),
      Buffer.alloc(blockLength, paddingByte),
    );
    padding -= blockLength;
  }
  chunks.push(Buffer.from([0x00, 0x3b]));
  const complete = Buffer.concat(chunks);
  return truncateBytes === 0
    ? complete
    : complete.subarray(0, complete.length - truncateBytes);
}

async function writeGifFixture(directory, name, options) {
  const filePath = path.join(directory, name);
  await writeFile(filePath, createGifFixture(options));
  return filePath;
}

async function createGifPairFixture(directory) {
  const outputs = [
    await writeGifFixture(directory, "original.gif", { paddingByte: 1 }),
    await writeGifFixture(directory, "lighthouse.gif", { paddingByte: 2 }),
  ];
  const priorBytes = await Promise.all(outputs.map((filePath) => readFile(filePath)));
  return { outputs, priorBytes };
}

async function assertFilePairEquals(outputs, expectedBytes) {
  const actualBytes = await Promise.all(outputs.map((filePath) => readFile(filePath)));
  assert.deepEqual(actualBytes, expectedBytes);
}

test("recording contract pins source, outputs, viewport, and story stops", () => {
  assert.equal(UPSTREAM_COMMIT, "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63");
  assert.equal(UPSTREAM_REPOSITORY_VERSION, "7.0.7");
  assert.deepEqual(CAPTURE_VIEWPORT, { width: 960, height: 640 });
  assert.deepEqual(RECORDINGS.map(({ output }) => output), [
    "docs/demos/08-r3f-scroll-rig-original.gif",
    "docs/demos/08-r3f-scroll-rig-lighthouse.gif",
  ]);
  assert.deepEqual(ORIGINAL_SCROLL_STOPS, [0, 1280, 2560, 3600]);
  assert.deepEqual(SHOWCASE_SCROLL_STOPS, [0, 1100, 2200, 3800]);
});

test("GIF validation rejects a non-GIF artifact", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-test-"));
  try {
    const invalid = path.join(directory, "invalid.gif");
    await writeFile(invalid, "not a gif");
    await assert.rejects(() => assertGifFile(invalid), /GIF artifact is invalid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF validation requires the exact GIF89a signature", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-signature-"));
  try {
    const invalid = await writeGifFixture(directory, "gif87a.gif", {
      signature: "GIF87a",
    });
    await assert.rejects(() => assertGifFile(invalid), /GIF89a signature/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF validation requires the exact logical screen dimensions", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-screen-"));
  try {
    const invalid = await writeGifFixture(directory, "wrong-screen.gif", {
      width: 959,
    });
    await assert.rejects(() => assertGifFile(invalid), /960x640 logical screen/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF validation requires exactly 40 image frames", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-frames-"));
  try {
    const invalid = await writeGifFixture(directory, "wrong-frames.gif", {
      frameCount: 39,
    });
    await assert.rejects(() => assertGifFile(invalid), /exactly 40 image frames/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF validation requires 20 centisecond frame delays and 800 centiseconds total", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-delay-"));
  try {
    const frameDelays = Array.from({ length: 40 }, () => 20);
    frameDelays[17] = 19;
    const invalid = await writeGifFixture(directory, "wrong-delay.gif", {
      frameDelays,
    });
    await assert.rejects(
      () => assertGifFile(invalid),
      /20 centiseconds.*800 centiseconds/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF validation requires an infinite animation loop", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-loop-"));
  try {
    const invalid = await writeGifFixture(directory, "finite-loop.gif", {
      loopCount: 2,
    });
    await assert.rejects(() => assertGifFile(invalid), /infinite loop/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("GIF validation rejects a truncated sub-block without a final trailer", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-gif-truncated-"));
  try {
    const invalid = await writeGifFixture(directory, "truncated.gif", {
      truncateBytes: 10,
    });
    await assert.rejects(() => assertGifFile(invalid), /truncated.*sub-block|trailer/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("production GIF validation accepts both tracked final recordings", async () => {
  await Promise.all(RECORDINGS.map(({ output }) => assertGifFile(
    path.resolve(output),
  )));
});

test("dual GIF publication leaves the prior pair untouched when the second encode fails", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-publish-encode-"));
  try {
    const { outputs, priorBytes } = await createGifPairFixture(directory);
    const temporaryRoot = await mkdtemp(path.join(directory, "temporary-"));
    let encodeCount = 0;

    await assert.rejects(
      () => recording.encodeAndPublishGifs({
        temporaryRoot,
        frameDirectories: ["original-frames", "lighthouse-frames"],
        outputs,
        encodeGifImpl: async (_frameDirectory, temporaryOutput) => {
          encodeCount += 1;
          if (encodeCount === 2) throw new Error("second encode failed");
          await writeFile(
            temporaryOutput,
            createGifFixture({ paddingByte: 3 }),
          );
        },
      }),
      /second encode failed/,
    );

    assert.equal(encodeCount, 2);
    await assertFilePairEquals(outputs, priorBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dual GIF publication leaves the prior pair untouched when the second temporary GIF fails validation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-publish-validate-"));
  try {
    const { outputs, priorBytes } = await createGifPairFixture(directory);
    const temporaryRoot = await mkdtemp(path.join(directory, "temporary-"));
    let encodeCount = 0;

    await assert.rejects(
      () => recording.encodeAndPublishGifs({
        temporaryRoot,
        frameDirectories: ["original-frames", "lighthouse-frames"],
        outputs,
        encodeGifImpl: async (_frameDirectory, temporaryOutput) => {
          encodeCount += 1;
          await writeFile(
            temporaryOutput,
            createGifFixture(encodeCount === 2
              ? { width: 959, paddingByte: 4 }
              : { paddingByte: 3 }),
          );
        },
      }),
      /960x640 logical screen/,
    );

    assert.equal(encodeCount, 2);
    await assertFilePairEquals(outputs, priorBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("dual GIF publication restores the complete prior pair when the second publish fails", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "r3f-publish-rollback-"));
  try {
    const { outputs, priorBytes } = await createGifPairFixture(directory);
    const temporaryRoot = await mkdtemp(path.join(directory, "temporary-"));
    let encodeCount = 0;
    let publishCount = 0;

    await assert.rejects(
      () => recording.encodeAndPublishGifs({
        temporaryRoot,
        frameDirectories: ["original-frames", "lighthouse-frames"],
        outputs,
        encodeGifImpl: async (_frameDirectory, temporaryOutput) => {
          encodeCount += 1;
          await writeFile(
            temporaryOutput,
            createGifFixture({ paddingByte: encodeCount + 2 }),
          );
        },
        publishFileImpl: async (temporaryOutput, output) => {
          publishCount += 1;
          if (publishCount === 2) throw new Error("second publish failed");
          await copyFile(temporaryOutput, output);
        },
      }),
      /second publish failed/,
    );

    assert.equal(publishCount, 2);
    await assertFilePairEquals(outputs, priorBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("legacy source validation requires the pinned commit and versions", () => {
  const source = {
    legacyDir: "C:/temporary/r3f-scroll-rig",
    head: UPSTREAM_COMMIT,
    repositoryVersion: UPSTREAM_REPOSITORY_VERSION,
    resolvedVersion: "6.0.5",
  };
  assert.doesNotThrow(() => assertLegacySource(source));
  assert.throws(
    () => assertLegacySource({ ...source, head: "wrong-commit" }),
    /legacy source commit/,
  );
  assert.throws(
    () => assertLegacySource({ ...source, repositoryVersion: "7.0.6" }),
    /legacy source repository version/,
  );
  assert.throws(
    () => assertLegacySource({ ...source, resolvedVersion: "latest" }),
    /legacy source resolved version/,
  );
  assert.throws(
    () => assertLegacySource({ ...source, resolvedVersion: "8.15.0" }),
    /legacy source resolved version/,
  );
});

test("legacy source inspection rejects tracked unstaged and staged changes", async () => {
  const readJsonImpl = async (filePath) => ({
    version: filePath.includes(`${path.sep}node_modules${path.sep}`)
      ? "6.0.5"
      : UPSTREAM_REPOSITORY_VERSION,
  });

  for (const status of [
    " M examples/src/App.js",
    "M  package.json",
  ]) {
    await assert.rejects(
      () => recording.inspectLegacySource("C:\\legacy", {
        runCommandImpl: async (_command, args) => (
          args.includes("rev-parse") ? UPSTREAM_COMMIT : status
        ),
        readJsonImpl,
      }),
      /tracked staged or unstaged changes/,
    );
  }
});

test("original opening, sticky, inline, and viewport stops anchor continuous frames", () => {
  assert.deepEqual(buildScrollFrames(ORIGINAL_SCROLL_STOPS, 10), [
    0, 128, 256, 384, 512, 640, 768, 896, 1024, 1152,
    1280, 1408, 1536, 1664, 1792, 1920, 2048, 2176, 2304, 2432,
    2560, 2664, 2768, 2872, 2976, 3080, 3184, 3288, 3392, 3496,
    3600, 3600, 3600, 3600, 3600, 3600, 3600, 3600, 3600, 3600,
  ]);
});

test("historical scroll capture bypasses the demo's smoothing override", async () => {
  const calls = [];
  let paintFrames = 0;
  let positionChecks = 0;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const page = {
    evaluate: async (callback, top) => {
      if (top === undefined) {
        globalThis.requestAnimationFrame = (next) => {
          paintFrames += 1;
          next();
        };
      } else {
        globalThis.window = {
          scrollTo: (...args) => calls.push(args),
        };
      }
      try {
        await callback(top);
      } finally {
        globalThis.window = previousWindow;
        globalThis.requestAnimationFrame = previousRequestAnimationFrame;
      }
    },
    waitForFunction: async (callback, top, options) => {
      globalThis.window = { innerHeight: 640, scrollY: 13_159 };
      globalThis.document = {
        documentElement: { scrollHeight: 13_799 },
      };
      try {
        positionChecks += 1;
        assert.equal(callback(top), true);
        assert.deepEqual(options, { timeout: 10_000 });
      } finally {
        globalThis.window = previousWindow;
        globalThis.document = previousDocument;
      }
    },
  };

  await scrollPageTo(page, 15_000);

  assert.deepEqual(calls, [[0, 15_000, 1]]);
  assert.equal(positionChecks, 1);
  assert.equal(paintFrames, 2);
});

test("original demo starts npm source entry through the Windows command interpreter", async () => {
  const child = { pid: 4321, exitCode: null };
  let spawnCall;
  let waitCall;
  let stoppedChild;
  const server = await recording.startOriginalServer("C:\\legacy", {
    platform: "win32",
    spawnImpl: (command, args, options) => {
      spawnCall = { command, args, options };
      return child;
    },
    waitForServerImpl: async (url, spawnedChild) => {
      waitCall = { url, spawnedChild };
    },
    stopProcessTreeImpl: async (spawnedChild) => {
      stoppedChild = spawnedChild;
    },
  });

  assert.equal(spawnCall.command, process.env.ComSpec ?? "cmd.exe");
  assert.deepEqual(spawnCall.args, ["/d", "/s", "/c", "npm start"]);
  assert.equal(spawnCall.options.cwd, path.join("C:\\legacy", "examples"));
  assert.deepEqual(
    {
      PORT: spawnCall.options.env.PORT,
      HOST: spawnCall.options.env.HOST,
      BROWSER: spawnCall.options.env.BROWSER,
      CI: spawnCall.options.env.CI,
      NODE_OPTIONS: spawnCall.options.env.NODE_OPTIONS,
    },
    {
      PORT: "5223",
      HOST: "127.0.0.1",
      BROWSER: "none",
      CI: "true",
      NODE_OPTIONS: "--openssl-legacy-provider",
    },
  );
  assert.deepEqual(waitCall, {
    url: "http://127.0.0.1:5223/",
    spawnedChild: child,
  });
  await server.close();
  assert.equal(stoppedChild, child);
});

test("original demo startup failure stops the spawned process tree", async () => {
  const child = { pid: 4321, exitCode: null };
  let stoppedChild;

  await assert.rejects(
    () => recording.startOriginalServer("C:\\legacy", {
      platform: "win32",
      spawnImpl: () => child,
      waitForServerImpl: async () => {
        throw new Error("source compile failed");
      },
      stopProcessTreeImpl: async (spawnedChild) => {
        stoppedChild = spawnedChild;
      },
    }),
    /source compile failed/,
  );

  assert.equal(stoppedChild, child);
});

test("original startup preserves its readiness error when child cleanup fails", async () => {
  const child = { pid: 4321, exitCode: null, signalCode: null };
  const readinessError = new Error("source readiness failed");
  const reports = [];

  await assert.rejects(
    () => recording.startOriginalServer("C:\\legacy", {
      platform: "win32",
      spawnImpl: () => child,
      waitForServerImpl: async () => {
        throw readinessError;
      },
      stopProcessTreeImpl: async () => {
        throw new Error("source cleanup failed");
      },
      reportCleanupErrorImpl: (name, error) => {
        reports.push({ name, message: error.message });
      },
    }),
    (error) => {
      assert.equal(error, readinessError);
      assert.deepEqual(
        error.cleanupErrors.map(({ message }) => message),
        ["source cleanup failed"],
      );
      return true;
    },
  );

  assert.deepEqual(reports, [
    { name: "original", message: "source cleanup failed" },
  ]);
});

test("Windows cleanup terminates the original demo and all descendants", async () => {
  let runCall;

  await recording.stopProcessTree(
    { pid: 4321, exitCode: null },
    {
      platform: "win32",
      runCommandImpl: async (command, args) => {
        runCall = { command, args };
      },
    },
  );

  assert.deepEqual(runCall, {
    command: "taskkill",
    args: ["/PID", "4321", "/T", "/F"],
  });
});

test("an already signaled child is treated as exited", async () => {
  let taskkillCalled = false;

  await recording.stopProcessTree(
    { pid: 4321, exitCode: null, signalCode: "SIGTERM" },
    {
      platform: "win32",
      runCommandImpl: async () => {
        taskkillCalled = true;
      },
    },
  );

  assert.equal(taskkillCalled, false);
});

test("POSIX source entry keeps NODE_OPTIONS platform-neutral", async () => {
  const child = new EventEmitter();
  child.pid = 4321;
  child.exitCode = null;
  let spawnCall;
  let stoppedChild;
  const server = await recording.startOriginalServer("/legacy", {
    platform: "linux",
    spawnImpl: (command, args, options) => {
      spawnCall = { command, args, options };
      return child;
    },
    waitForServerImpl: async () => {},
    stopProcessTreeImpl: async (spawnedChild) => {
      stoppedChild = spawnedChild;
    },
  });

  assert.equal(spawnCall.command, "npm");
  assert.deepEqual(spawnCall.args, ["start"]);
  assert.equal(spawnCall.options.detached, true);
  assert.notEqual(
    spawnCall.options.env.NODE_OPTIONS,
    "--openssl-legacy-provider",
  );
  await server.close();
  assert.equal(stoppedChild, child);
});

test("POSIX successful close waits until the listening process exits", async () => {
  const fixture = await createLoopbackProcessFixture(43_210);
  const signals = [];
  try {
    assert.equal((await fetch(fixture.url)).status, 200);
    const originalServer = await recording.startOriginalServer("/legacy", {
      platform: "linux",
      spawnImpl: () => fixture.child,
      waitForServerImpl: async () => {},
      stopProcessTreeImpl: (child, { platform }) => recording.stopProcessTree(
        child,
        {
          platform,
          terminationTimeoutMs: 50,
          killProcessGroupImpl: (processGroupId, signal) => {
            signals.push({ processGroupId, signal });
            fixture.terminate();
          },
        },
      ),
    });

    await originalServer.close();

    assert.deepEqual(signals, [
      { processGroupId: -43_210, signal: "SIGTERM" },
    ]);
    await assert.rejects(
      () => fetch(fixture.url, { signal: AbortSignal.timeout(500) }),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("POSIX readiness failure waits for port release before rejecting", async () => {
  const fixture = await createLoopbackProcessFixture(43_211);
  try {
    assert.equal((await fetch(fixture.url)).status, 200);

    await assert.rejects(
      () => recording.startOriginalServer("/legacy", {
        platform: "linux",
        spawnImpl: () => fixture.child,
        waitForServerImpl: async () => {
          throw new Error("source readiness failed");
        },
        stopProcessTreeImpl: (child, { platform }) => recording.stopProcessTree(
          child,
          {
            platform,
            terminationTimeoutMs: 50,
            killProcessGroupImpl: (_processGroupId, signal) => {
              assert.equal(signal, "SIGTERM");
              fixture.terminate();
            },
          },
        ),
      }),
      /source readiness failed/,
    );

    await assert.rejects(
      () => fetch(fixture.url, { signal: AbortSignal.timeout(500) }),
    );
  } finally {
    await fixture.cleanup();
  }
});

test("POSIX cleanup escalates to SIGKILL and still waits for exit", async () => {
  const child = new EventEmitter();
  child.pid = 43_212;
  child.exitCode = null;
  const signals = [];

  await recording.stopProcessTree(child, {
    platform: "linux",
    terminationTimeoutMs: 5,
    killProcessGroupImpl: (_processGroupId, signal) => {
      signals.push(signal);
      if (signal === "SIGKILL") {
        child.exitCode = 137;
        child.emit("exit", null, "SIGKILL");
      }
    },
    processGroupExistsImpl: () => child.exitCode === null,
  });

  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(child.exitCode, 137);
});

test("POSIX cleanup outlives an exited npm-like leader and releases its descendant port", async () => {
  const descendant = createServer((_request, response) => response.end("descendant"));
  await new Promise((resolve, reject) => {
    descendant.once("error", reject);
    descendant.listen(0, "127.0.0.1", resolve);
  });
  const child = new EventEmitter();
  child.pid = 43_213;
  child.exitCode = 0;
  child.signalCode = null;
  let groupExists = true;
  const signals = [];
  const port = descendant.address().port;

  try {
    assert.equal(
      (await fetch(`http://127.0.0.1:${port}/`)).status,
      200,
    );

    await recording.stopProcessTree(child, {
      platform: "linux",
      port,
      terminationTimeoutMs: 20,
      pollIntervalMs: 2,
      processGroupExistsImpl: () => groupExists,
      killProcessGroupImpl: (_processGroupId, signal) => {
        signals.push(signal);
        if (signal === "SIGKILL") {
          groupExists = false;
          descendant.close();
        }
      },
    });

    assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
    await assert.rejects(
      () => fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(500),
      }),
    );
  } finally {
    if (descendant.listening) {
      await new Promise((resolve) => descendant.close(resolve));
    }
  }
});

test("showcase cleanup returns immediately for an already signaled child", async () => {
  const child = new EventEmitter();
  child.pid = 43_214;
  child.exitCode = null;
  child.signalCode = "SIGTERM";
  child.kill = () => {
    throw new Error("kill must not run for an exited child");
  };

  await recording.stopShowcaseServer({ child });
});

test("recording cleanup bounds failures while still releasing every independent resource", async () => {
  const originalError = new Error("capture failed");
  const calls = [];
  const reports = [];
  const browser = {
    close: async () => {
      calls.push("browser");
      throw new Error("browser close failed");
    },
  };
  const showcaseServer = { child: { pid: 43_215 } };
  const originalServer = {
    close: async () => {
      calls.push("original");
    },
  };

  await assert.rejects(
    () => recording.cleanupRecordingResources(
      {
        browser,
        showcaseServer,
        originalServer,
        temporaryRoot: "C:\\task-owned-recording-temp",
      },
      {
        operationError: originalError,
        cleanupTimeoutMs: 20,
        stopShowcaseServerImpl: async () => {
          calls.push("showcase");
          await new Promise(() => {});
        },
        removeTemporaryRootImpl: async () => {
          calls.push("temporary");
        },
        reportCleanupErrorImpl: (name, error) => {
          reports.push({ name, message: error.message });
        },
      },
    ),
    (error) => {
      assert.equal(error, originalError);
      assert.equal(error.cleanupErrors.length, 2);
      return true;
    },
  );

  assert.deepEqual(calls.sort(), [
    "browser",
    "original",
    "showcase",
    "temporary",
  ]);
  assert.deepEqual(
    reports.map(({ name }) => name).sort(),
    ["browser", "showcase"],
  );
});

test("signal cleanup awaits a delayed browser launch and closes the late browser", async () => {
  const signalError = new Error("Recording interrupted by SIGTERM");
  signalError.signal = "SIGTERM";
  let resolveBrowserLaunch;
  let browserClosed = false;
  const browserLaunchPromise = new Promise((resolve) => {
    resolveBrowserLaunch = resolve;
  });

  const cleanupPromise = recording.cleanupRecordingResources(
    { browserLaunchPromise },
    {
      operationError: signalError,
      cleanupTimeoutMs: 100,
      reportCleanupErrorImpl: () => {},
    },
  );
  resolveBrowserLaunch({
    close: async () => {
      browserClosed = true;
    },
  });

  await assert.rejects(cleanupPromise, (error) => error === signalError);
  assert.equal(browserClosed, true);
});

test("CLI SIGINT and SIGTERM abort recording, await cleanup, and set conventional statuses", async () => {
  for (const [signalName, expectedStatus] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    const processImpl = new EventEmitter();
    processImpl.exitCode = null;
    let finishCleanup;
    let cleanupFinished = false;
    let receivedSignal;
    const recorderPromise = recording.runRecorderCli({
      processImpl,
      recordImpl: ({ signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          receivedSignal = signal.reason.signal;
          finishCleanup = () => {
            cleanupFinished = true;
            reject(signal.reason);
          };
        }, { once: true });
      }),
      logImpl: () => {},
      errorImpl: () => {},
    });

    processImpl.emit(signalName);
    assert.equal(receivedSignal, signalName);
    assert.equal(processImpl.exitCode, null);
    assert.equal(cleanupFinished, false);

    finishCleanup();
    assert.equal(await recorderPromise, expectedStatus);
    assert.equal(cleanupFinished, true);
    assert.equal(processImpl.exitCode, expectedStatus);
    assert.equal(processImpl.listenerCount("SIGINT"), 0);
    assert.equal(processImpl.listenerCount("SIGTERM"), 0);
  }
});

test("CLI keeps the signal status when recorder cleanup resolves instead of rejecting", async () => {
  const processImpl = new EventEmitter();
  processImpl.exitCode = null;
  let finishCleanup;
  const logs = [];
  const recorderPromise = recording.runRecorderCli({
    processImpl,
    recordImpl: ({ signal }) => new Promise((resolve) => {
      signal.addEventListener("abort", () => {
        finishCleanup = () => resolve(["should-not-log.gif"]);
      }, { once: true });
    }),
    logImpl: (message) => logs.push(message),
    errorImpl: () => {},
  });

  processImpl.emit("SIGTERM");
  finishCleanup();

  assert.equal(await recorderPromise, 143);
  assert.equal(processImpl.exitCode, 143);
  assert.deepEqual(logs, []);
});

test("original demo navigation waits for DOM content instead of an idle network", async () => {
  let call;
  const page = {
    goto: async (url, options) => {
      call = { url, options };
    },
  };

  await navigateOriginalPage(page);

  assert.deepEqual(call, {
    url: "http://127.0.0.1:5223/",
    options: { waitUntil: "domcontentloaded" },
  });
});

test("original readiness waits for both rendered copy and the loading overlay to leave", async () => {
  const calls = [];
  const locator = (label) => ({
    waitFor: async (options) => {
      calls.push({ label, options });
    },
  });
  const page = {
    getByText: (text, options) => locator(
      typeof text === "string"
        ? { text, options }
        : { pattern: text.source },
    ),
  };

  await waitForOriginalReadiness(page);

  assert.deepEqual(calls, [
    {
      label: {
        text: "A ScrollScene with a Cube mesh inside using global lights.",
        options: { exact: true },
      },
      options: { timeout: 60_000 },
    },
    {
      label: { pattern: "^Loading\\s+\\d+(?:\\.\\d+)?%$" },
      options: { state: "hidden", timeout: 60_000 },
    },
  ]);
});

test("lighthouse navigation waits for DOM content instead of an idle network", async () => {
  let call;
  const page = {
    goto: async (url, options) => {
      call = { url, options };
    },
  };

  await navigateLighthousePage(page);

  assert.deepEqual(call, {
    url: "http://127.0.0.1:5224/",
    options: { waitUntil: "domcontentloaded" },
  });
});

test("lighthouse readiness targets the exact rendered heading", async () => {
  let call;
  const locator = {
    waitFor: async () => {},
  };
  const page = {
    getByRole: (role, options) => {
      call = { role, options };
      return locator;
    },
  };

  await waitForLighthouseHeading(page);

  assert.deepEqual(call, {
    role: "heading",
    options: { name: "雾屿灯塔", exact: true },
  });
});
