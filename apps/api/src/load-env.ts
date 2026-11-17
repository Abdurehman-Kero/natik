// Loads apps/api/.env into process.env before anything else runs (Sentry, Nest config).
// In staging/production the platform injects real environment variables instead.
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
