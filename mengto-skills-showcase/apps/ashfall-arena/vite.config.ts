import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "three-runtime",
              test: /node_modules[\\/]three[\\/]/,
              priority: 20,
              maxSize: 450 * 1_024,
            },
            {
              name: "game-assets",
              test: /packages[\\/]game-assets[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
});
