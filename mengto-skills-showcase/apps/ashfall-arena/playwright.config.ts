import { defineConfig } from "@playwright/test";
import { hiddenAshfallGuideState } from "./tests/guide-storage-state";

const port = process.env.ASHFALL_PLAYWRIGHT_PORT ?? "4174";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  testIgnore: "**/release-performance.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    storageState: hiddenAshfallGuideState(new URL(baseURL).origin),
  },
  webServer: {
    command:
      port === "4174"
        ? "npm run dev"
        : `vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
