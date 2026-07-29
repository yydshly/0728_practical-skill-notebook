import { defineConfig } from "@playwright/test";

const baseURL = process.env.MONSTER_FORGE_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL },
  ...(process.env.MONSTER_FORGE_BASE_URL ? {} : { webServer: { command: "npm run dev", url: "http://127.0.0.1:4173", reuseExistingServer: false } }),
});
