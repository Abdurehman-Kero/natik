// Integration tests read apps/api/.env locally; CI provides the variables directly.
// They always run against TEST_DATABASE_URL so development data is never touched.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.APP_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.RUN_WORKER_IN_API = 'false';
