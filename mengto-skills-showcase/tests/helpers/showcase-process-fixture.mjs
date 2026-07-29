import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect } from "vitest";

const execFilePromise = promisify(execFile);
const fixturePath = fileURLToPath(
  new URL("../fixtures/showcase-service.mjs", import.meta.url),
);
const trackedPidFiles = new Set();
const trackedServers = new Set();

function pidIsStopped(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (error.code === "ESRCH") return true;
    throw error;
  }
}

export async function occupyTemporaryPort(requestedPort = 0) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, "127.0.0.1", resolve);
  });
  trackedServers.add(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing port");
  let closed = false;
  return {
    port: address.port,
    close: async () => {
      if (closed) return;
      closed = true;
      trackedServers.delete(server);
      await new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

export async function reserveTemporaryPort() {
  const occupied = await occupyTemporaryPort();
  const { port } = occupied;
  await occupied.close();
  return port;
}

export function fixtureService({
  id = "fixture-app",
  port,
  marker = id,
  servedMarker = marker,
  delayMs = 0,
  crashAfterMs,
  pidFile,
  spawnGrandchild = false,
  bodyMode = "standard",
  secondaryMarker,
  hitFile,
}) {
  const expectedMeta = `<meta name="showcase-app" content="${marker}">`;
  const args = [
    fixturePath,
    "--port", String(port),
    "--marker", servedMarker,
    "--delay-ms", String(delayMs),
    "--body-mode", bodyMode,
  ];
  if (crashAfterMs !== undefined) {
    args.push("--crash-after-ms", String(crashAfterMs));
  }
  if (pidFile) {
    trackedPidFiles.add(pidFile);
    args.push("--pid-file", pidFile);
  }
  if (spawnGrandchild) args.push("--spawn-grandchild");
  if (secondaryMarker !== undefined) {
    args.push("--secondary-marker", secondaryMarker);
  }
  if (hitFile !== undefined) args.push("--hit-file", hitFile);
  return {
    id,
    name: id,
    port,
    url: `http://127.0.0.1:${port}/`,
    marker: expectedMeta,
    command: process.execPath,
    args,
  };
}

export async function temporaryFixtureServices(configs) {
  const services = [];
  for (let index = 0; index < configs.length; index += 1) {
    const config = configs[index];
    const directory = await mkdtemp(join(tmpdir(), "showcase-fixture-"));
    services.push(fixtureService({
      id: config.id ?? `fixture-${index + 1}`,
      port: await reserveTemporaryPort(),
      ...config,
      pidFile: config.pidFile ?? join(directory, "pids.txt"),
    }));
  }
  return services;
}

export async function fixtureTreeService(mode, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "showcase-process-tree-"));
  const pidFile = join(directory, "pids.txt");
  const port = await reserveTemporaryPort();
  return Object.assign(
    fixtureService({
      id: `tree-${mode}`,
      port,
      delayMs: mode === "timeout" ? 5_000 : mode === "crash" ? 500 : 0,
      crashAfterMs:
        mode === "crash" ? 120
        : mode === "post-ready-crash" ? 450
        : undefined,
      pidFile,
      spawnGrandchild: true,
      ...overrides,
    }),
    { pidFile },
  );
}

export async function readPidFileEventually(pidFile) {
  let text;
  await expect.poll(async () => {
    try {
      text = await readFile(pidFile, "utf8");
      return text.trim().length > 0;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  }, { timeout: 3_000 }).toBe(true);
  return text.trim().split(/\s+/).map(Number);
}

export async function expectPidStopped(pid) {
  await expect.poll(() => pidIsStopped(pid), { timeout: 5_000 }).toBe(true);
}

export async function expectPidFileTreeStopped(pidFile) {
  let text;
  try {
    text = await readFile(pidFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const pids = text.trim().split(/\s+/).map(Number);
  await Promise.all(pids.map(expectPidStopped));
}

async function forceStopPid(pid) {
  if (pidIsStopped(pid)) return;
  if (process.platform === "win32") {
    await execFilePromise("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
    }).catch(() => {});
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  await expectPidStopped(pid);
}

export async function cleanupFixtureResources() {
  for (const server of [...trackedServers]) {
    trackedServers.delete(server);
    await new Promise((resolve) => server.close(() => resolve()));
  }
  for (const pidFile of [...trackedPidFiles]) {
    trackedPidFiles.delete(pidFile);
    let text;
    try {
      text = await readFile(pidFile, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    const pids = text.trim().split(/\s+/).map(Number).filter(Number.isInteger);
    if (pids.length > 0) await forceStopPid(pids[0]);
    for (const pid of pids.slice(1)) await forceStopPid(pid);
  }
}
