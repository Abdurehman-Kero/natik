import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** After a local run, remove the courses and levels the tests created so the dev catalogue stays tidy. */
export default function globalTeardown(): void {
  if (process.env.E2E_BASE_URL || process.env.CI) return;
  const api = path.resolve(__dirname, '../../api');
  const result = spawnSync('pnpm', ['exec', 'tsx', 'prisma/clean-test-data.ts'], {
    cwd: api,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) console.warn('Could not clean up test data (non-fatal).');
}
