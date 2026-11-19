import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** After a local run, remove the courses, levels and accounts the tests created so the dev catalogue stays tidy. */
export default function globalTeardown(): void {
  // A run against a remote site must never touch a database from here; local runs (including the
  // test servers on localhost) tidy up after themselves.
  const remote =
    process.env.E2E_BASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.E2E_BASE_URL);
  if (remote || process.env.CI) return;
  const api = path.resolve(__dirname, '../../api');
  const result = spawnSync('pnpm', ['exec', 'tsx', 'prisma/clean-test-data.ts'], {
    cwd: api,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) console.warn('Could not clean up test data (non-fatal).');
}
