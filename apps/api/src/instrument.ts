// Error tracking (NFR-REL-003). Must be imported before any other application module.
import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV ?? 'local',
    tracesSampleRate: 0.1,
    // Sentry 11 sends no personal data (IPs, cookies, bodies) by default. Keep it that way:
    // phone numbers and student data must never reach a third party.
  });
}
