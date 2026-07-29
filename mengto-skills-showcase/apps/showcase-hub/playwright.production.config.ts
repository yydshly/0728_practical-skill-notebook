import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4272",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command:
      "npm run build && vite preview --host 127.0.0.1 --port 4272 --strictPort",
    url: "http://127.0.0.1:4272",
    reuseExistingServer: false,
  },
});
