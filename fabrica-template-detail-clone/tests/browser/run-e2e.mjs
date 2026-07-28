import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const vite = await createServer({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
  },
});

await vite.listen();
const { port } = vite.httpServer.address();
const playwrightCli = fileURLToPath(new URL('../../node_modules/playwright/cli.js', import.meta.url));

try {
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_PORT: String(port),
        PLAYWRIGHT_EXTERNAL_SERVER: 'true',
      },
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
} finally {
  await vite.close();
}
