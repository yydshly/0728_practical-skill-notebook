import { defineConfig } from "@playwright/test";

const previewURL = "http://127.0.0.1:4273";

export default defineConfig({
  testDir: "./tests/production",
  workers: 1,
  use: { baseURL: previewURL },
  webServer: {
    command: "npm run build && vite preview --host 127.0.0.1 --port 4273 --strictPort",
    url: previewURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
