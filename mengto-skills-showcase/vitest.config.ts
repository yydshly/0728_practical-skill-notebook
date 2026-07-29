import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "apps/*/tests/browser/**",
      "apps/*/tests/production/**",
      "packages/*/tests/browser/**",
      "tests/browser/**",
      "tests/showcase-preview/**",
    ],
  },
});
