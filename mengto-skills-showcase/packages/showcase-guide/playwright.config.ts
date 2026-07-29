import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4196",
    storageState: {
      cookies: [],
      origins: [],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command: "vite --host 127.0.0.1 --port 4196 --strictPort",
    url: "http://127.0.0.1:4196/tests/fixture/",
    reuseExistingServer: false,
  },
});
