import { defineConfig } from "@playwright/test";
import { hiddenAshfallGuideState } from "./tests/guide-storage-state";

const port = process.env.ASHFALL_PREVIEW_PORT ?? "4184";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    storageState: hiddenAshfallGuideState(new URL(baseURL).origin),
  },
  webServer: {
    command: `vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
