import { execFile, spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { SHOWCASE_APPS, resolveServiceLaunch } from "./showcase-apps.mjs";

const execFilePromise = promisify(execFile);
const defaultWorkspaceRoot = fileURLToPath(new URL("../", import.meta.url));
const ASCII_WHITESPACE = /[\t\n\f\r ]/;
const readinessProbeTimeoutMs = 500;

function readTag(html, start) {
  let quote;
  for (let index = start + 1; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ">") {
      return { source: html.slice(start + 1, index), end: index + 1 };
    }
  }
  return { source: html.slice(start + 1), end: html.length };
}

function parseStartTag(source) {
  let index = 0;
  while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
  const nameStart = index;
  while (
    index < source.length
    && !ASCII_WHITESPACE.test(source[index])
    && !["/", ">"].includes(source[index])
  ) {
    index += 1;
  }
  const tagName = source.slice(nameStart, index).toLowerCase();
  const attributes = new Map();
  let ambiguous = false;
  while (index < source.length) {
    while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
    if (source[index] === "/" || index >= source.length) break;
    const attributeStart = index;
    while (
      index < source.length
      && !ASCII_WHITESPACE.test(source[index])
      && !["=", "/", ">"].includes(source[index])
    ) {
      index += 1;
    }
    const attributeName = source.slice(attributeStart, index).toLowerCase();
    if (!attributeName) {
      index += 1;
      continue;
    }
    while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
    let value = "";
    if (source[index] === "=") {
      index += 1;
      while (ASCII_WHITESPACE.test(source[index] ?? "")) index += 1;
      const quote = source[index];
      if (quote === "'" || quote === '"') {
        index += 1;
        const valueStart = index;
        while (index < source.length && source[index] !== quote) index += 1;
        value = source.slice(valueStart, index);
        if (source[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (
          index < source.length
          && !ASCII_WHITESPACE.test(source[index])
          && !["/", ">"].includes(source[index])
        ) {
          index += 1;
        }
        value = source.slice(valueStart, index);
      }
    }
    if (attributes.has(attributeName)) ambiguous = true;
    else attributes.set(attributeName, value);
  }
  return { tagName, attributes, ambiguous };
}

function hasAsciiTagNameAt(html, start, tagName) {
  for (let offset = 0; offset < tagName.length; offset += 1) {
    const character = html.charCodeAt(start + offset);
    const lowercase = tagName.charCodeAt(offset);
    if (character !== lowercase && character !== lowercase - 32) return false;
  }
  return true;
}

function findRawTextCloseStart(html, tagName, start) {
  let closeStart = html.indexOf("<", start);
  while (closeStart >= 0) {
    const nameStart = closeStart + 2;
    const following = html[nameStart + tagName.length];
    if (
      html[closeStart + 1] === "/"
      && hasAsciiTagNameAt(html, nameStart, tagName)
      && (ASCII_WHITESPACE.test(following ?? "") || following === "/" || following === ">")
    ) {
      return closeStart;
    }
    closeStart = html.indexOf("<", closeStart + 1);
  }
  return -1;
}

function showcaseMetaContents(html) {
  const contents = [];
  let index = 0;
  while (index < html.length) {
    const tagStart = html.indexOf("<", index);
    if (tagStart < 0) break;
    if (html.startsWith("<!--", tagStart)) {
      const commentEnd = html.indexOf("-->", tagStart + 4);
      index = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }
    const tag = readTag(html, tagStart);
    const trimmed = tag.source.trimStart();
    if (trimmed.startsWith("!") || trimmed.startsWith("?")) {
      index = tag.end;
      continue;
    }
    const closing = trimmed.startsWith("/");
    const parsed = parseStartTag(closing ? trimmed.slice(1) : trimmed);
    if (!closing && ["script", "style"].includes(parsed.tagName)) {
      const closeStart = findRawTextCloseStart(
        html,
        parsed.tagName,
        tag.end,
      );
      if (closeStart < 0) break;
      index = readTag(html, closeStart).end;
      continue;
    }
    if (!closing && parsed.tagName === "meta" && !parsed.ambiguous) {
      const markerName = parsed.attributes.get("name");
      if (markerName?.toLowerCase() === "showcase-app") {
        contents.push(parsed.attributes.has("content")
          ? parsed.attributes.get("content")
          : undefined);
      }
    }
    index = tag.end;
  }
  return contents;
}

function expectedMarkerContent(service) {
  const contents = showcaseMetaContents(service.marker);
  if (contents.length !== 1 || typeof contents[0] !== "string" || !contents[0]) {
    throw new Error(`${service.name} has an invalid readiness marker`);
  }
  return contents[0];
}

function validateServices(services) {
  const ids = new Set();
  const ports = new Set();
  const expectedContents = new Map();
  for (const service of services) {
    if (ids.has(service.id)) {
      throw new Error(`duplicate showcase service id: ${service.id}`);
    }
    if (ports.has(service.port)) {
      throw new Error(`duplicate showcase service port: ${service.port}`);
    }
    ids.add(service.id);
    ports.add(service.port);
    expectedContents.set(service, expectedMarkerContent(service));
  }
  return expectedContents;
}

export async function assertPortAvailable(service) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      server.close(() => {});
      if (error?.code === "EADDRINUSE") {
        reject(new Error(
          `${service.name} port ${service.port} is already in use`,
          { cause: error },
        ));
      } else {
        reject(error);
      }
    };
    server.once("error", fail);
    server.listen(service.port, "127.0.0.1", () => {
      server.close((error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      });
    });
  });
}

export async function preflightPorts(services) {
  for (const service of services) {
    await assertPortAvailable(service);
  }
}

async function isReady(service, expectedContent, signal) {
  const attempt = new AbortController();
  const abortAttempt = () => attempt.abort(signal.reason);
  if (signal.aborted) {
    abortAttempt();
  } else {
    signal.addEventListener("abort", abortAttempt, { once: true });
  }
  const timeout = setTimeout(
    () => attempt.abort(new Error("readiness probe timed out")),
    readinessProbeTimeoutMs,
  );
  try {
    const response = await fetch(service.url, {
      signal: attempt.signal,
      redirect: "manual",
    });
    if (response.status < 200 || response.status > 399) return false;
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^text\/html(?:\s*;|$)/i.test(contentType)) return false;
    const contents = showcaseMetaContents(await response.text());
    return contents.length === 1 && contents[0] === expectedContent;
  } catch (error) {
    if (signal.aborted) return false;
    return false;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", abortAttempt);
  }
}

async function listWindowsDescendants(rootPid) {
  const command = [
    "$ErrorActionPreference='Stop';",
    "Get-CimInstance Win32_Process",
    "| Select-Object ProcessId,ParentProcessId",
    "| ConvertTo-Json -Compress",
  ].join(" ");
  const { stdout } = await execFilePromise(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", command],
    { windowsHide: true },
  );
  const parsed = JSON.parse(stdout || "[]");
  const rows = (Array.isArray(parsed) ? parsed : [parsed]).map((row) => ({
    pid: Number(row.ProcessId),
    parentPid: Number(row.ParentProcessId),
  }));
  const descendants = [];
  const seen = new Set();
  const frontier = [rootPid];
  while (frontier.length > 0) {
    const parentPid = frontier.shift();
    for (const row of rows) {
      if (row.parentPid !== parentPid || seen.has(row.pid)) continue;
      seen.add(row.pid);
      descendants.push(row.pid);
      frontier.push(row.pid);
    }
  }
  return descendants.reverse();
}

async function taskkillIfRunning(pid) {
  await execFilePromise("taskkill", ["/PID", String(pid), "/T", "/F"], {
    windowsHide: true,
  }).catch((error) => {
    try {
      process.kill(pid, 0);
    } catch (probeError) {
      if (probeError.code === "ESRCH") return;
    }
    throw error;
  });
}

export async function terminateProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    const descendants = await listWindowsDescendants(pid);
    for (const descendantPid of descendants) {
      await taskkillIfRunning(descendantPid);
    }
    await taskkillIfRunning(pid);
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
    return;
  }
  const gracefulDeadline = performance.now() + 750;
  while (performance.now() < gracefulDeadline) {
    await delay(25);
    try {
      process.kill(-pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

function interruptedError() {
  const error = new Error("Showcase startup interrupted");
  error.code = "SHOWCASE_INTERRUPTED";
  return error;
}

function combineFailure(runtimeError, cleanupError) {
  return new AggregateError(
    [runtimeError, cleanupError],
    "Showcase failed and cleanup also failed",
  );
}

export async function startShowcaseProcesses({
  services = SHOWCASE_APPS,
  deadlineMs = 20_000,
  workspaceRoot = defaultWorkspaceRoot,
  writeLine = (line) => console.log(line),
  signal,
  preflight = preflightPorts,
  terminateTree = terminateProcessTree,
} = {}) {
  const deadlineAt = performance.now() + deadlineMs;
  if (signal?.aborted) throw interruptedError();
  const expectedContents = validateServices(services);
  await preflight(services);
  if (signal?.aborted) throw interruptedError();
  const launches = services.map((service) => resolveServiceLaunch(service));
  if (performance.now() >= deadlineAt) {
    throw new Error("readiness deadline exceeded before services started");
  }

  const probeAbort = new AbortController();
  const remainingMs = Math.max(0, deadlineAt - performance.now());
  const deadlineTimer = setTimeout(() => probeAbort.abort(), remainingMs);
  const children = [];
  let stopping = false;
  let stopPromise;
  let resolveDone;
  let rejectDone;
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  void done.catch(() => {});

  const onExternalAbort = () => {
    void stop(`signal:${String(signal?.reason ?? "abort")}`).catch(() => {});
  };

  const cleanup = async (reason) => {
    clearTimeout(deadlineTimer);
    probeAbort.abort();
    signal?.removeEventListener("abort", onExternalAbort);
    const terminationResults = await Promise.allSettled(children.map(
      ({ child }) => child.pid === undefined
        ? Promise.resolve()
        : terminateTree(child.pid),
    ));
    const closeResults = await Promise.allSettled(children.map(({ closed }) => closed));
    const cleanupErrors = [...terminationResults, ...closeResults]
      .filter(({ status }) => status === "rejected")
      .map(({ reason: error }) => error);
    writeLine(`展厅服务已停止：${reason}`);
    if (cleanupErrors.length === 1) throw cleanupErrors[0];
    if (cleanupErrors.length > 1) {
      throw new AggregateError(cleanupErrors, "Multiple showcase cleanup failures");
    }
  };

  const stop = (reason = "requested") => {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopPromise = cleanup(reason).then(
      () => {
        resolveDone();
      },
      (cleanupError) => {
        rejectDone(cleanupError);
        throw cleanupError;
      },
    );
    return stopPromise;
  };

  const fail = (runtimeError) => {
    if (stopPromise) return stopPromise;
    stopping = true;
    stopPromise = cleanup("runtime-failed").then(
      () => {
        rejectDone(runtimeError);
        throw runtimeError;
      },
      (cleanupError) => {
        const aggregate = combineFailure(runtimeError, cleanupError);
        rejectDone(aggregate);
        throw aggregate;
      },
    );
    return stopPromise;
  };

  const unexpectedFailure = (service, detail, cause) => {
    const suffix = detail ? ` ${detail}` : "";
    return new Error(`${service.name}${suffix}`, cause ? { cause } : undefined);
  };

  signal?.addEventListener("abort", onExternalAbort, { once: true });
  if (signal?.aborted) onExternalAbort();

  try {
    for (let index = 0; index < services.length; index += 1) {
      const service = services[index];
      const launch = launches[index];
      let child;
      try {
        child = spawn(launch.command, launch.args, {
          cwd: workspaceRoot,
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
          detached: process.platform !== "win32",
        });
      } catch (error) {
        throw unexpectedFailure(service, "failed to start", error);
      }
      const entry = { service, child, closed: undefined };
      children.push(entry);
      entry.closed = new Promise((resolve) => child.once("close", resolve));
      child.stdout?.on("data", (chunk) =>
        writeLine(`[${service.id}] ${String(chunk).trimEnd()}`));
      child.stderr?.on("data", (chunk) =>
        writeLine(`[${service.id}:stderr] ${String(chunk).trimEnd()}`));
      child.once("error", (error) => {
        if (!stopping) {
          void fail(unexpectedFailure(service, "failed to start", error))
            .catch(() => {});
        }
      });
      child.once("exit", (code, exitSignal) => {
        if (!stopping) {
          void fail(unexpectedFailure(
            service,
            `exited unexpectedly (code=${code ?? "null"}, signal=${exitSignal ?? "null"})`,
          )).catch(() => {});
        }
      });
    }
  } catch (error) {
    return fail(error);
  }

  if (signal?.aborted && !stopping) onExternalAbort();
  const pending = new Set(children);
  const readyIds = new Set();

  const waitUntilReady = async () => {
    while (
      pending.size > 0
      && performance.now() < deadlineAt
      && !probeAbort.signal.aborted
    ) {
      const entries = [...pending];
      const results = await Promise.all(entries.map((entry) =>
        isReady(
          entry.service,
          expectedContents.get(entry.service),
          probeAbort.signal,
        )));
      for (let index = 0; index < entries.length; index += 1) {
        if (!results[index]) continue;
        pending.delete(entries[index]);
        readyIds.add(entries[index].service.id);
      }
      if (pending.size > 0 && !probeAbort.signal.aborted) {
        const pauseMs = Math.min(50, Math.max(0, deadlineAt - performance.now()));
        if (pauseMs > 0) {
          await delay(pauseMs, undefined, { signal: probeAbort.signal })
            .catch(() => {});
        }
      }
    }
    if (pending.size > 0) {
      throw new Error(
        `readiness deadline exceeded: ${[...pending].map(({ service }) =>
          `${service.name} (${service.url}; expected ${service.marker})`
        ).join(", ")}`,
      );
    }
  };

  try {
    await Promise.race([waitUntilReady(), done]);
  } catch (error) {
    if (!stopping) return fail(error);
    if (stopPromise) await stopPromise;
    if (signal?.aborted) throw interruptedError();
    throw error;
  }
  if (stopping || signal?.aborted) {
    if (stopPromise) await stopPromise;
    throw interruptedError();
  }
  clearTimeout(deadlineTimer);
  const readyServices = services.filter((service) => readyIds.has(service.id));
  writeLine("全部可访问");
  for (const service of readyServices) {
    writeLine(`${service.name}: ${service.url}`);
  }
  return {
    readyServices,
    childPids: children.flatMap(({ child }) =>
      child.pid === undefined ? [] : [child.pid]),
    stop,
    done,
  };
}
