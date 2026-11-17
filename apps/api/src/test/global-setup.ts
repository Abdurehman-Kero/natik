import { execSync } from 'node:child_process';
import './load-env';

/** Brings the test database up to the latest migration before integration tests run. */
export default function setup(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'Integration tests need TEST_DATABASE_URL (or DATABASE_URL). See .env.example.',
    );
  }
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env },
  });
}
