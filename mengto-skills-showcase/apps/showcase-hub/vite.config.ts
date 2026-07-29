import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "127.0.0.1", port: 4172, strictPort: true },
  preview: { host: "127.0.0.1", port: 4272, strictPort: true },
});
