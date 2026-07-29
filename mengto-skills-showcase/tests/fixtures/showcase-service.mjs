import { spawn } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";

function parseCliArgs(args) {
  const values = new Map();
  let spawnGrandchild = false;
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name === "--spawn-grandchild") {
      spawnGrandchild = true;
      continue;
    }
    if (![
      "--port",
      "--marker",
      "--delay-ms",
      "--crash-after-ms",
      "--pid-file",
      "--body-mode",
      "--secondary-marker",
      "--hit-file",
    ].includes(name)) {
      throw new Error(`unknown fixture argument: ${name}`);
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`missing value for ${name}`);
    values.set(name, value);
    index += 1;
  }
  const integer = (name, fallback) => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} must be a non-negative integer`);
    }
    return value;
  };
  const port = integer("--port");
  const marker = values.get("--marker");
  if (!port || port > 65_535) throw new Error("--port is required");
  if (!marker) throw new Error("--marker is required");
  return {
    port,
    marker,
    delayMs: integer("--delay-ms", 0),
    crashAfterMs: integer("--crash-after-ms", undefined),
    pidFile: values.get("--pid-file"),
    spawnGrandchild,
    bodyMode: values.get("--body-mode") ?? "standard",
    secondaryMarker: values.get("--secondary-marker") ?? "conflicting-app",
    hitFile: values.get("--hit-file"),
  };
}

function htmlFor(options) {
  const exact = `<meta name="showcase-app" content="${options.marker}">`;
  const secondary =
    `<meta name="showcase-app" content="${options.secondaryMarker}">`;
  switch (options.bodyMode) {
    case "standard":
      return `<!doctype html>${exact}`;
    case "self-closing":
      return `<!doctype html>${exact.slice(0, -1)} />`;
    case "reordered":
      return `<!doctype html><META content = '${options.marker}' NAME = showcase-app />`;
    case "missing":
      return "<!doctype html><title>No marker</title>";
    case "comment":
      return `<!doctype html><!-- ${exact} --><title>Comment only</title>`;
    case "script":
      return `<!doctype html><script>const marker = ${JSON.stringify(exact)}</script>`;
    case "style":
      return `<!doctype html><style>x::after{content:${JSON.stringify(exact)}}</style>`;
    case "script-prefixed-close":
      return `<!doctype html><script>const marker = "</scriptx>${exact}";</script>`;
    case "style-prefixed-close":
      return `<!doctype html><style>x::after{content:"</stylex>${exact}"}</style>`;
    case "script-hyphenated-close":
      return `<!doctype html><script>const marker = "</script-not-a-close>${exact}";</script>`;
    case "style-hyphenated-close":
      return `<!doctype html><style>x::after{content:"</style-not-a-close>${exact}"}</style>`;
    case "script-prefixed-close-then-real-marker":
      return `<!doctype html><script>const marker = "</scriptx>${exact}";</script>${exact}`;
    case "style-prefixed-close-then-real-marker":
      return `<!doctype html><style>x::after{content:"</stylex>${exact}"}</style>${exact}`;
    case "script-unicode-prefixed-close":
      return `<!doctype html><script>const marker = "\u0130</scriptx>${exact}";</script>`;
    case "style-unicode-prefixed-close":
      return `<!doctype html><style>x::after{content:"\u0130</stylex>${exact}"}</style>`;
    case "script-unicode-real-close-then-marker":
      return `<!doctype html><script>const marker = "\u0130";</script>${exact}`;
    case "style-unicode-real-close-then-marker":
      return `<!doctype html><style>x::after{content:"\u0130"}</style>${exact}`;
    case "text":
      return `<!doctype html><p>${exact.replaceAll("<", "&lt;")}</p>`;
    case "json":
      return JSON.stringify({ marker: exact });
    case "plain":
      return `diagnostic marker: ${exact}`;
    case "conflict":
      return `<!doctype html>${exact}${secondary}`;
    case "duplicate":
      return `<!doctype html>${exact}${exact}`;
    default:
      throw new Error(`unknown body mode: ${options.bodyMode}`);
  }
}

const options = parseCliArgs(process.argv.slice(2));
const pids = [process.pid];
if (options.spawnGrandchild) {
  const grandchild = spawn(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000)"],
    { stdio: "ignore", windowsHide: true },
  );
  if (!grandchild.pid) throw new Error("grandchild did not start");
  pids.push(grandchild.pid);
}
if (options.pidFile) {
  await writeFile(options.pidFile, `${pids.join("\n")}\n`, "utf8");
}
if (options.crashAfterMs !== undefined) {
  setTimeout(() => process.exit(23), options.crashAfterMs);
}

const server = createServer(async (_request, response) => {
  if (options.hitFile) {
    await appendFile(options.hitFile, "hit\n", "utf8");
  }
  const contentType = options.bodyMode === "json"
    ? "application/json"
    : options.bodyMode === "plain"
      ? "text/plain; charset=utf-8"
      : "text/html; charset=utf-8";
  response.writeHead(200, { "content-type": contentType });
  if (options.bodyMode === "held-open") {
    response.write("<!doctype html><title>Still loading</title>");
    return;
  }
  response.end(htmlFor(options));
});

const listenTimer = setTimeout(() => {
  server.listen(options.port, "127.0.0.1");
}, options.delayMs);

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(listenTimer);
  if (!server.listening) {
    process.exitCode = 0;
    return;
  }
  server.closeAllConnections?.();
  server.close(() => {
    process.exitCode = 0;
  });
};
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, shutdown);
}
