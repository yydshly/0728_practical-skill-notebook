import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/showcase-preview",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4292",
    viewport: { width: 1440, height: 900 },
    storageState: { cookies: [], origins: [] },
  },
  webServer: {
    command: "npm run build:showcase && npm run preview:showcase",
    url: "http://127.0.0.1:4292",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
