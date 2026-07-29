import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    base: env.VITE_APP_BASE || "/",
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "three-core",
                test: /node_modules[\\/]three[\\/]/,
                priority: 20,
                maxSize: 430 * 1_024,
              },
              {
                name: "mech-assets",
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
      port: 4175,
      strictPort: true,
    },
    preview: {
      host: "127.0.0.1",
      port: 4175,
      strictPort: true,
    },
  };
});
