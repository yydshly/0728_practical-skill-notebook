import { EventEmitter } from "node:events";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { runDevShowcase } from "../scripts/dev-showcase.mjs";
import {
  SHOWCASE_APPS,
  resolveServiceLaunch,
} from "../scripts/showcase-apps.mjs";
import {
  preflightPorts,
  startShowcaseProcesses,
  terminateProcessTree,
  terminateWindowsProcessTree,
} from "../scripts/showcase-processes.mjs";
import {
  cleanupFixtureResources,
  expectPidFileTreeStopped,
  expectPidStopped,
  fixtureService,
  fixtureTreeService,
  occupyTemporaryPort,
  readPidFileEventually,
  reserveTemporaryPort,
  temporaryFixtureServices,
} from "./helpers/showcase-process-fixture.mjs";

afterEach(async () => {
  await cleanupFixtureResources();
});

describe("showcase descriptors and preflight", () => {
  it("declares four fixed products and their exact readiness markers", () => {
    expect(SHOWCASE_APPS.map(({ id, port, marker }) => [id, port, marker]))
      .toEqual([
        ["showcase-hub", 4172, '<meta name="showcase-app" content="showcase-hub">'],
        ["monster-forge", 4173, '<meta name="showcase-app" content="monster-forge">'],
        ["ashfall-arena", 4174, '<meta name="showcase-app" content="ashfall-arena">'],
        ["mech-atelier", 4175, '<meta name="showcase-app" content="mech-atelier">'],
      ]);
  });

  it("passes strictPort through the three root workspace scripts", async () => {
    const manifest = JSON.parse(await readFile(
      new URL("../package.json", import.meta.url),
      "utf8",
    ));
    expect(manifest.scripts["dev:forge"]).toBe(
      "npm run dev --workspace @showcase/monster-forge -- --strictPort",
    );
    expect(manifest.scripts["dev:arena"]).toBe(
      "npm run dev --workspace @showcase/ashfall-arena -- --strictPort",
    );
    expect(manifest.scripts["dev:atelier"]).toBe(
      "npm run dev --workspace @showcase/mech-atelier -- --strictPort",
    );
  });

  it("rejects an occupied port before starting any fixture", async () => {
    const first = await fixtureTreeService("preflight-first");
    const occupied = await occupyTemporaryPort();
    const second = fixtureService({
      id: "occupied-product",
      port: occupied.port,
    });
    await expect(startShowcaseProcesses({
      services: [first, second],
      deadlineMs: 1_000,
    })).rejects.toThrow(`occupied-product port ${occupied.port} is already in use`);
    await expect(access(first.pidFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    {
      label: "duplicate ids",
      change: (first, second) => [{ ...first, id: "same" }, { ...second, id: "same" }],
      message: /duplicate showcase service id: same/,
    },
    {
      label: "duplicate ports",
      change: (first, second) => [first, { ...second, port: first.port }],
      message: /duplicate showcase service port:/,
    },
  ])("rejects $label before launch", async ({ change, message }) => {
    const [first, second] = await temporaryFixtureServices([
      { id: "first" },
      { id: "second" },
    ]);
    await expect(startShowcaseProcesses({
      services: change(first, second),
      deadlineMs: 1_000,
    })).rejects.toThrow(message);
  });

  it("resolves every launch before spawning the first descriptor", async () => {
    const first = await fixtureTreeService("resolution-first");
    const secondPort = await reserveTemporaryPort();
    const second = {
      id: "resolution-error",
      name: "resolution-error",
      port: secondPort,
      url: `http://127.0.0.1:${secondPort}/`,
      marker: '<meta name="showcase-app" content="resolution-error">',
      get command() {
        throw new Error("synchronous launch resolution failed");
      },
      args: [],
    };
    await expect(startShowcaseProcesses({
      services: [first, second],
      deadlineMs: 1_000,
    })).rejects.toThrow("synchronous launch resolution failed");
    await expect(access(first.pidFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not spawn when the external signal aborts during preflight", async () => {
    const service = await fixtureTreeService("preflight-abort");
    const controller = new AbortController();
    await expect(startShowcaseProcesses({
      services: [service],
      deadlineMs: 1_000,
      signal: controller.signal,
      preflight: async (services) => {
        await preflightPorts(services);
        controller.abort("SIGINT");
      },
    })).rejects.toMatchObject({ code: "SHOWCASE_INTERRUPTED" });
    await expect(access(service.pidFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("requires npm_execpath only for npm-script descriptors", () => {
    expect(() => resolveServiceLaunch({
      name: "scripted",
      npmScript: "dev:scripted",
    }, null)).toThrow("scripted requires npm_execpath");
  });
});

describe("semantic readiness", () => {
  it.each(["self-closing", "reordered"])(
    "accepts the expected unique meta in %s form",
    async (bodyMode) => {
      const [service] = await temporaryFixtureServices([{
        id: `valid-${bodyMode}`,
        bodyMode,
      }]);
      const supervisor = await startShowcaseProcesses({
        services: [service],
        deadlineMs: 1_500,
        writeLine: () => {},
      });
      await supervisor.stop("test-complete");
      await expect(supervisor.done).resolves.toBeUndefined();
    },
    15_000,
  );

  it.each([
    ["wrong content", { servedMarker: "another-app" }],
    ["missing marker", { bodyMode: "missing" }],
    ["comment text", { bodyMode: "comment" }],
    ["script text", { bodyMode: "script" }],
    ["style text", { bodyMode: "style" }],
    ["ordinary text", { bodyMode: "text" }],
    ["JSON marker text", { bodyMode: "json" }],
    ["plain response marker text", { bodyMode: "plain" }],
    ["conflicting markers", { bodyMode: "conflict" }],
    ["duplicate markers", { bodyMode: "duplicate" }],
  ])("does not accept %s as readiness", async (_label, config) => {
    const [service] = await temporaryFixtureServices([{
      id: "expected-app",
      ...config,
    }]);
    await expect(startShowcaseProcesses({
      services: [service],
      deadlineMs: 250,
      writeLine: () => {},
    })).rejects.toThrow(/readiness deadline.*expected-app/);
  });

  it.each([
    "script-prefixed-close",
    "style-prefixed-close",
    "script-hyphenated-close",
    "style-hyphenated-close",
  ])("does not accept a marker after a prefixed %s raw-text close", async (bodyMode) => {
    const service = await fixtureTreeService(bodyMode, {
      id: "expected-app",
      bodyMode,
      spawnGrandchild: false,
    });
    let failure;
    let supervisor;
    try {
      supervisor = await startShowcaseProcesses({
        services: [service],
        deadlineMs: 250,
        writeLine: () => {},
      });
    } catch (error) {
      failure = error;
    } finally {
      await supervisor?.stop("test-cleanup");
    }
    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toMatch(/readiness deadline.*expected-app/);
    await expectPidFileTreeStopped(service.pidFile);
    await preflightPorts([service]);
  });

  it.each([
    "script-prefixed-close-then-real-marker",
    "style-prefixed-close-then-real-marker",
  ])("accepts a marker after the real close following a prefixed %s", async (bodyMode) => {
    const service = await fixtureTreeService(bodyMode, {
      id: "expected-app",
      bodyMode,
      spawnGrandchild: false,
    });
    const supervisor = await startShowcaseProcesses({
      services: [service],
      deadlineMs: 1_500,
      writeLine: () => {},
    });
    await supervisor.stop("test-complete");
    await expect(supervisor.done).resolves.toBeUndefined();
    await expectPidFileTreeStopped(service.pidFile);
    await preflightPorts([service]);
  });

  it.each([
    "script-unicode-prefixed-close",
    "style-unicode-prefixed-close",
  ])("does not accept a raw-text marker after %s", async (bodyMode) => {
    const service = await fixtureTreeService(bodyMode, {
      id: "expected-app",
      bodyMode,
      spawnGrandchild: false,
    });
    await expect(startShowcaseProcesses({
      services: [service],
      deadlineMs: 250,
      writeLine: () => {},
    })).rejects.toThrow(/readiness deadline.*expected-app/);
    await expectPidFileTreeStopped(service.pidFile);
    await preflightPorts([service]);
  });

  it.each([
    "script-unicode-real-close-then-marker",
    "style-unicode-real-close-then-marker",
  ])("accepts a real marker after %s", async (bodyMode) => {
    const service = await fixtureTreeService(bodyMode, {
      id: "expected-app",
      bodyMode,
      spawnGrandchild: false,
    });
    const supervisor = await startShowcaseProcesses({
      services: [service],
      deadlineMs: 1_500,
      writeLine: () => {},
    });
    await supervisor.stop("test-complete");
    await expect(supervisor.done).resolves.toBeUndefined();
    await expectPidFileTreeStopped(service.pidFile);
    await preflightPorts([service]);
  });

  it("probes other pending services while one response remains held open", async () => {
    const directory = await import("node:fs/promises").then(({ mkdtemp }) =>
      mkdtemp(join(tmpdir(), "showcase-probe-hit-")));
    const hitFile = join(directory, "healthy-hit.txt");
    const services = await temporaryFixtureServices([
      { id: "held-open", bodyMode: "held-open" },
      { id: "healthy", hitFile, delayMs: 750 },
    ]);
    const controller = new AbortController();
    const startup = startShowcaseProcesses({
      services,
      deadlineMs: 8_000,
      signal: controller.signal,
      writeLine: () => {},
    });
    const startupOutcome = startup.then(
      () => {
        throw new Error("held-open startup unexpectedly became ready");
      },
      (error) => {
        throw error;
      },
    );
    try {
      await Promise.race([
        expect.poll(async () => {
          try {
            return await readFile(hitFile, "utf8");
          } catch (error) {
            if (error.code === "ENOENT") return "";
            throw error;
          }
        }, { timeout: 5_000 }).toContain("hit"),
        startupOutcome,
      ]);
    } finally {
      controller.abort("test-complete");
    }
    await expect(startup).rejects.toMatchObject({
      code: "SHOWCASE_INTERRUPTED",
    });
  }, 15_000);
});

describe("supervision and process-tree cleanup", () => {
  it("kills one live Windows root tree without enumerating descendants", async () => {
    const calls = [];
    await terminateWindowsProcessTree(424_242, {
      taskkill: async (pid) => {
        calls.push(["taskkill", pid]);
        return true;
      },
      listDescendants: async (pid) => {
        calls.push(["list", pid]);
        return [424_243];
      },
    });
    expect(calls).toEqual([["taskkill", 424_242]]);
  });

  it("enumerates descendants only after the Windows root has exited", async () => {
    const calls = [];
    await terminateWindowsProcessTree(424_242, {
      taskkill: async (pid) => {
        calls.push(["taskkill", pid]);
        return pid !== 424_242;
      },
      listDescendants: async (pid) => {
        calls.push(["list", pid]);
        return [424_244, 424_243];
      },
    });
    expect(calls).toEqual([
      ["taskkill", 424_242],
      ["list", 424_242],
      ["taskkill", 424_244],
      ["taskkill", 424_243],
    ]);
  });

  it("waits for every service, announces once in descriptor order, and resolves done only after stop", async () => {
    const services = await temporaryFixtureServices([
      { id: "one", delayMs: 20 },
      { id: "two", delayMs: 100 },
      { id: "three", delayMs: 40 },
      { id: "four", delayMs: 70 },
    ]);
    const output = [];
    const supervisor = await startShowcaseProcesses({
      services,
      deadlineMs: 2_000,
      writeLine: (line) => output.push(line),
    });
    expect(supervisor.readyServices.map(({ id }) => id))
      .toEqual(["one", "two", "three", "four"]);
    expect(output.filter((line) => line.includes("全部可访问"))).toHaveLength(1);
    expect(output.slice(-4)).toEqual(services.map(({ name, url }) => `${name}: ${url}`));
    await expect(Promise.race([
      supervisor.done.then(() => "settled", () => "settled"),
      new Promise((resolve) => setTimeout(() => resolve("pending"), 80)),
    ])).resolves.toBe("pending");
    const firstStop = supervisor.stop("test-complete");
    expect(supervisor.stop("ignored-second-reason")).toBe(firstStop);
    await expect(firstStop).resolves.toBeUndefined();
    await expect(supervisor.done).resolves.toBeUndefined();
    await Promise.all(supervisor.childPids.map(expectPidStopped));
    await preflightPorts(services);
  });

  it.each([
    ["timeout", 250],
    ["crash", 2_000],
  ])("cleans the complete child tree after %s", async (mode, deadlineMs) => {
    const service = await fixtureTreeService(mode);
    await expect(startShowcaseProcesses({
      services: [service],
      deadlineMs,
      writeLine: () => {},
    })).rejects.toThrow();
    await expectPidFileTreeStopped(service.pidFile);
    await preflightPorts([service]);
  });

  it("cleans an already spawned sibling after an asynchronous spawn error", async () => {
    const healthy = await fixtureTreeService("missing-command-sibling", {
      delayMs: 5_000,
    });
    const missingPort = await reserveTemporaryPort();
    const missing = {
      ...fixtureService({ id: "missing-command", port: missingPort }),
      command: join(tmpdir(), "showcase-command-that-does-not-exist"),
      args: [],
    };
    await expect(startShowcaseProcesses({
      services: [healthy, missing],
      deadlineMs: 2_000,
      writeLine: () => {},
    })).rejects.toThrow("missing-command failed to start");
    await expectPidFileTreeStopped(healthy.pidFile);
  });

  it("cleans an already spawned sibling after spawn throws synchronously", async () => {
    const healthy = await fixtureTreeService("sync-spawn-sibling", {
      delayMs: 5_000,
    });
    const invalidPort = await reserveTemporaryPort();
    const invalid = fixtureService({ id: "sync-spawn-error", port: invalidPort });
    invalid.args = [Symbol("invalid-spawn-argument")];
    await expect(startShowcaseProcesses({
      services: [healthy, invalid],
      deadlineMs: 2_000,
      writeLine: () => {},
    })).rejects.toThrow();
    await expectPidFileTreeStopped(healthy.pidFile);
  });

  it("keeps observing a ready child and rejects done after a later crash", async () => {
    const service = await fixtureTreeService("post-ready-crash");
    const supervisor = await startShowcaseProcesses({
      services: [service],
      deadlineMs: 2_000,
      writeLine: () => {},
    });
    await expect(supervisor.done).rejects.toThrow(
      "tree-post-ready-crash exited unexpectedly",
    );
    await expectPidFileTreeStopped(service.pidFile);
    await preflightPorts([service]);
  });

  it("preserves runtime and cleanup failures in one AggregateError", async () => {
    const service = await fixtureTreeService("post-ready-crash");
    const supervisor = await startShowcaseProcesses({
      services: [service],
      deadlineMs: 2_000,
      writeLine: () => {},
      terminateTree: async (pid) => {
        await terminateProcessTree(pid);
        throw new Error("injected cleanup failure");
      },
    });
    let failure;
    try {
      await supervisor.done;
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(AggregateError);
    expect(failure.errors.map((error) => error.message)).toEqual([
      expect.stringContaining("exited unexpectedly"),
      "injected cleanup failure",
    ]);
    await expectPidFileTreeStopped(service.pidFile);
  });
});

describe("CLI signal orchestration", () => {
  it("cleans launched children when a signal arrives before readiness", async () => {
    const signalTarget = new EventEmitter();
    const service = await fixtureTreeService("startup-signal", {
      delayMs: 5_000,
    });
    const run = runDevShowcase({
      services: [service],
      deadlineMs: 2_000,
      signalTarget,
      platform: "win32",
      writeLine: () => {},
    });
    const pids = await readPidFileEventually(service.pidFile);
    signalTarget.emit("SIGINT");
    await expect(run).resolves.toBe(0);
    await Promise.all(pids.map(expectPidStopped));
    for (const signal of ["SIGINT", "SIGBREAK", "SIGTERM"]) {
      expect(signalTarget.listenerCount(signal)).toBe(0);
    }
    await preflightPorts([service]);
  });

  it.each(["SIGINT", "SIGBREAK", "SIGTERM"])(
    "returns 0 for %s, removes every listener, and releases the port",
    async (signal) => {
      const signalTarget = new EventEmitter();
      const service = await fixtureTreeService(`interrupt-${signal.toLowerCase()}`);
      const output = [];
      const run = runDevShowcase({
        services: [service],
        deadlineMs: 2_000,
        signalTarget,
        platform: "win32",
        writeLine: (line) => output.push(line),
      });
      await expect.poll(() =>
        output.some((line) => line.includes("全部可访问"))
      ).toBe(true);
      const pids = await readPidFileEventually(service.pidFile);
      signalTarget.emit(signal);
      await expect(run).resolves.toBe(0);
      await Promise.all(pids.map(expectPidStopped));
      for (const registeredSignal of ["SIGINT", "SIGBREAK", "SIGTERM"]) {
        expect(signalTarget.listenerCount(registeredSignal)).toBe(0);
      }
      await preflightPorts([service]);
    },
    15_000,
  );

  it("returns 1 for a post-ready runtime crash", async () => {
    const service = await fixtureTreeService("post-ready-crash");
    const errors = [];
    await expect(runDevShowcase({
      services: [service],
      deadlineMs: 2_000,
      signalTarget: new EventEmitter(),
      writeLine: () => {},
      writeError: (line) => errors.push(line),
    })).resolves.toBe(1);
    expect(errors.join("\n")).toContain("exited unexpectedly");
    await expectPidFileTreeStopped(service.pidFile);
  });

  it("returns 1 instead of reporting a clean signal exit when cleanup fails", async () => {
    const signalTarget = new EventEmitter();
    const service = await fixtureTreeService("signal-cleanup-failure");
    const output = [];
    const errors = [];
    const run = runDevShowcase({
      services: [service],
      deadlineMs: 2_000,
      signalTarget,
      platform: "win32",
      writeLine: (line) => output.push(line),
      writeError: (line) => errors.push(line),
      startProcesses: (options) => startShowcaseProcesses({
        ...options,
        terminateTree: async (pid) => {
          await terminateProcessTree(pid);
          throw new Error("injected signal cleanup failure");
        },
      }),
    });
    await expect.poll(() =>
      output.some((line) => line.includes("全部可访问"))
    ).toBe(true);
    signalTarget.emit("SIGINT");
    await expect(run).resolves.toBe(1);
    expect(errors.join("\n")).toContain("injected signal cleanup failure");
    await expectPidFileTreeStopped(service.pidFile);
    for (const signal of ["SIGINT", "SIGBREAK", "SIGTERM"]) {
      expect(signalTarget.listenerCount(signal)).toBe(0);
    }
  });
});
