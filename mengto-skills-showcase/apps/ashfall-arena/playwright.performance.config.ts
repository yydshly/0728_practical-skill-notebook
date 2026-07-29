import { defineConfig } from "@playwright/test";

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
  },
  webServer: {
    command: `vite --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
