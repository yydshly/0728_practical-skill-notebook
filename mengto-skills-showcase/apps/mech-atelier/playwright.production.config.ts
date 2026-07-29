import { defineConfig } from "@playwright/test";

const port = process.env.MECH_PREVIEW_PORT ?? "4185";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 20_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command:
      `npm run build && vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
