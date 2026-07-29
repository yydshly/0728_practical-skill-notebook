import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_APP_BASE || "/",
    server: { host: "127.0.0.1", port: 4172, strictPort: true },
    preview: { host: "127.0.0.1", port: 4272, strictPort: true },
  };
});
