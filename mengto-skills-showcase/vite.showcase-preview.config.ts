import { defineConfig } from "vite";

export default defineConfig({
  build: { outDir: "dist/showcase" },
  preview: {
    host: "127.0.0.1",
    port: 4292,
    strictPort: true,
  },
});
