import { defineConfig } from "@playwright/test";
import { hiddenAshfallGuideState } from "./tests/guide-storage-state";

const functionalPort = Number.parseInt(
  process.env.ASHFALL_PLAYWRIGHT_PORT ?? "4174",
  10,
);
const port = process.env.ASHFALL_PERFORMANCE_PORT ??
  String(functionalPort + 1);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/release-performance.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    storageState: hiddenAshfallGuideState(new URL(baseURL).origin),
  },
  webServer: {
    command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
