import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

test("recording contract pins source, outputs, viewport, and story stops", () => {
  assert.equal(UPSTREAM_COMMIT, "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63");
  assert.equal(UPSTREAM_REPOSITORY_VERSION, "7.0.7");
  assert.deepEqual(CAPTURE_VIEWPORT, { width: 960, height: 640 });
  assert.deepEqual(RECORDINGS.map(({ output }) => output), [
    "docs/demos/08-r3f-scroll-rig-original.gif",
    "docs/demos/08-r3f-scroll-rig-lighthouse.gif",
  ]);
  assert.deepEqual(ORIGINAL_SCROLL_STOPS, [0, 2560, 3600, 5368]);
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

test("original story stops form forty continuous frames with exact ten-frame anchors", () => {
  assert.deepEqual(buildScrollFrames(ORIGINAL_SCROLL_STOPS, 10), [
    0, 256, 512, 768, 1024, 1280, 1536, 1792, 2048, 2304,
    2560, 2664, 2768, 2872, 2976, 3080, 3184, 3288, 3392, 3496,
    3600, 3777, 3954, 4130, 4307, 4484, 4661, 4838, 5014, 5191,
    5368, 5368, 5368, 5368, 5368, 5368, 5368, 5368, 5368, 5368,
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
