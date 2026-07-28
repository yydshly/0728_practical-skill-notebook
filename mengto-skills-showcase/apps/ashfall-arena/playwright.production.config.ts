import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4184",
  },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4184",
    reuseExistingServer: false,
  },
});
