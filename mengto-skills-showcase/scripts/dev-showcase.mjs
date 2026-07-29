import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SHOWCASE_APPS } from "./showcase-apps.mjs";
import { startShowcaseProcesses } from "./showcase-processes.mjs";

export async function runDevShowcase({
  services = SHOWCASE_APPS,
  deadlineMs = 20_000,
  writeLine = (line) => console.log(line),
  writeError = (line) => console.error(line),
  signalTarget = process,
  platform = process.platform,
  startProcesses = startShowcaseProcesses,
} = {}) {
  const controller = new AbortController();
  const signals = platform === "win32"
    ? ["SIGINT", "SIGBREAK", "SIGTERM"]
    : ["SIGINT", "SIGTERM"];
  const handlers = new Map(signals.map((signal) => [
    signal,
    () => controller.abort(signal),
  ]));
  for (const [signal, handler] of handlers) {
    signalTarget.once(signal, handler);
  }

  let supervisor;
  try {
    supervisor = await startProcesses({
      services,
      deadlineMs,
      writeLine,
      signal: controller.signal,
    });
    await supervisor.done;
    return 0;
  } catch (error) {
    if (error?.code === "SHOWCASE_INTERRUPTED") {
      try {
        await supervisor?.stop(`signal:${String(controller.signal.reason)}`);
      } catch (cleanupError) {
        writeError(
          cleanupError instanceof Error
            ? cleanupError.stack ?? cleanupError.message
            : String(cleanupError),
        );
        return 1;
      }
      return 0;
    }
    writeError(error instanceof Error ? error.stack ?? error.message : String(error));
    await supervisor?.stop("cli-failure").catch(() => {});
    return 1;
  } finally {
    for (const [signal, handler] of handlers) {
      signalTarget.removeListener(signal, handler);
    }
  }
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  process.exitCode = await runDevShowcase();
}
