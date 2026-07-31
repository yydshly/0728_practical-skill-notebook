import { readFile, stat } from "node:fs/promises";

export const UPSTREAM_REPOSITORY = "https://github.com/14islands/r3f-scroll-rig";
export const UPSTREAM_COMMIT = "adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63";
export const UPSTREAM_REPOSITORY_VERSION = "7.0.7";
export const CAPTURE_VIEWPORT = { width: 960, height: 640 };
export const ORIGINAL_SCROLL_STOPS = [0, 720, 1440, 2280];
export const SHOWCASE_SCROLL_STOPS = [0, 1100, 2200, 3800];
export const RECORDINGS = [
  { id: "original", output: "docs/demos/08-r3f-scroll-rig-original.gif" },
  { id: "lighthouse", output: "docs/demos/08-r3f-scroll-rig-lighthouse.gif" },
];

const semanticVersion =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

export async function assertGifFile(filePath) {
  const [metadata, bytes] = await Promise.all([stat(filePath), readFile(filePath)]);
  const signature = bytes.subarray(0, 6).toString("ascii");
  if (
    metadata.size < 10_000 ||
    metadata.size > 8_000_000 ||
    (signature !== "GIF87a" && signature !== "GIF89a")
  ) {
    throw new Error(`GIF artifact is invalid: ${filePath}`);
  }
}

export function assertLegacySource({
  legacyDir,
  head,
  repositoryVersion,
  resolvedVersion,
}) {
  if (head !== UPSTREAM_COMMIT) {
    throw new Error(`legacy source commit must be ${UPSTREAM_COMMIT}: ${legacyDir}`);
  }
  if (repositoryVersion !== UPSTREAM_REPOSITORY_VERSION) {
    throw new Error(
      `legacy source repository version must be ${UPSTREAM_REPOSITORY_VERSION}: ${legacyDir}`,
    );
  }
  if (typeof resolvedVersion !== "string" || !semanticVersion.test(resolvedVersion)) {
    throw new Error(`legacy source resolved version must be a semantic version: ${legacyDir}`);
  }
}
