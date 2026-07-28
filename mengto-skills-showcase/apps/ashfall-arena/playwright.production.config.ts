import { defineConfig } from "@playwright/test";

const port = process.env.ASHFALL_PREVIEW_PORT ?? "4184";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/production",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
  },
  webServer: {
    command: `vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
