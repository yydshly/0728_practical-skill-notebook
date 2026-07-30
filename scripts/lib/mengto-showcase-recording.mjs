import { readFile, stat } from "node:fs/promises";

export const SHOWCASE_GIF = "docs/demos/07-mengto-skills-showcase.gif";
export const MAX_GIF_BYTES = 5 * 1024 * 1024;
export const FRAME_RATE = 4;
export const GIF_WIDTH = 720;
export const PREVIEW_PORT = 5277;

export const CAPTURE_STAGES = Object.freeze([
  Object.freeze({ id: "showcase-hub", frames: 12, path: "/" }),
  Object.freeze({ id: "monster-forge", frames: 16, path: "/monster-forge/?review=ash-warden" }),
  Object.freeze({ id: "ashfall-arena", frames: 16, path: "/ashfall-arena/?fixture=fresh&reviewControls=1&safeTraining=1&capture=1&quality=high" }),
  Object.freeze({ id: "mech-atelier", frames: 16, path: "/mech-atelier/?review=default" }),
]);

export function commandInvocation(command, platform = process.platform) {
  const windowsNpm = platform === "win32" && command === "npm";
  return { command: windowsNpm ? "npm.cmd" : command, shell: windowsNpm };
}

export function resolveChromium(playwrightModule) {
  const chromium = playwrightModule.chromium ?? playwrightModule.default?.chromium;
  if (!chromium) throw new Error("Playwright Chromium launcher is unavailable.");
  return chromium;
}

export function resolveFfmpegCommand(environment = process.env) {
  const configured = environment.MENGTO_SHOWCASE_FFMPEG?.trim();
  return configured || "ffmpeg";
}

export function createGifCommands({ framePattern, palettePath, outputPath }) {
  const scaled = `fps=${FRAME_RATE},scale=${GIF_WIDTH}:-2:flags=lanczos`;
  return [
    ["-y", "-framerate", String(FRAME_RATE), "-i", framePattern, "-vf", `${scaled},palettegen=max_colors=64:stats_mode=diff`, palettePath],
    ["-y", "-framerate", String(FRAME_RATE), "-i", framePattern, "-i", palettePath, "-lavfi", `${scaled}[frames];[frames][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, "-loop", "0", outputPath],
  ];
}

export async function assertGifFile(filePath, { maxBytes = MAX_GIF_BYTES, expectedWidth = GIF_WIDTH } = {}) {
  const [metadata, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (!["GIF87a", "GIF89a"].includes(signature)) throw new Error(`Invalid GIF signature: ${filePath}`);
  if (bytes.length < 10) throw new Error(`GIF header is truncated: ${filePath}`);
  const width = bytes.readUInt16LE(6);
  if (width !== expectedWidth) throw new Error(`GIF width must be ${expectedWidth}, received ${width}.`);
  if (metadata.size === 0 || metadata.size > maxBytes) throw new Error(`GIF must be non-empty and no larger than 5 MiB: ${filePath}`);
  return { signature, width, size: metadata.size };
}
