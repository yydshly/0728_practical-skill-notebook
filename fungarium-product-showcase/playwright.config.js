import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:4178/fungarium-product-showcase/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "node scripts/verify-showcase.mjs --serve-deployment",
    url: "http://127.0.0.1:4178/__health",
    reuseExistingServer: !process.env.CI,
  },
});
