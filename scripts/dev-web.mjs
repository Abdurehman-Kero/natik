/**
 * Starts the Next.js development server, then (once it and the API are up) opens every main page
 * once in the background so they are already compiled when you click. Set NO_WARM=1 to skip that.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT ?? '3000';
const isWindows = process.platform === 'win32';

const next = spawn(`${isWindows ? 'pnpm.cmd' : 'pnpm'} exec next dev --port ${port}`, {
  cwd: path.resolve(here, '../apps/web'),
  stdio: 'inherit',
  shell: true,
});
next.on('exit', (code) => process.exit(code ?? 0));

if (process.env.NO_WARM !== '1') {
  const warm = async () => {
    for (let i = 0; i < 120; i++) {
      try {
        const res = await fetch(`http://localhost:${port}/api/v1/health`);
        if (res.ok) break;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    spawn(process.execPath, [path.join(here, 'warm-routes.mjs'), `http://localhost:${port}`], {
      // Quiet: the pages open in the background without listing every one in the terminal.
      stdio: 'ignore',
    });
  };
  void warm();
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => next.kill(signal));
