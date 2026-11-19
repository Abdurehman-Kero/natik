import { z } from 'zod';

/** Every environment variable the API reads. Validated once at start-up (fail fast). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'test', 'staging', 'production']).default('local'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_URL: z.url().default('http://localhost:3000'),
  /**
   * How many proxies sit in front of the API and may be believed about the visitor's address (it is
   * what the rate limits and the activity log use). 1 = one reverse proxy (Caddy, Cloudflare or Render
   * alone). 2 = Vercel in front of Render, as in the pilot setup. 0 = none.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required' })
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgresql:// URL'),
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\//, 'REDIS_URL must be a redis:// URL')
    .default('redis://localhost:6380'),
  RUN_WORKER_IN_API: z.stringbool().default(false),
  /** Secret mixed into stored SMS-code hashes. Required outside local development. */
  OTP_PEPPER: z.string().min(16).default('dev-only-otp-pepper-change-me'),
  /** Test-only: multiplies per-IP/per-phone request limits so parallel browser tests don't trip them. Keep 1 in real use. */
  RATE_LIMIT_MULTIPLIER: z.coerce.number().int().min(1).max(1000).default(1),
  SMS_PROVIDER: z.enum(['console', 'afromessage']).default('console'),
  /** Afro Message (afromessage.com): the API token from its dashboard, and optional sender/identifier. */
  AFROMESSAGE_TOKEN: z.string().optional(),
  AFROMESSAGE_IDENTIFIER_ID: z.string().optional(),
  AFROMESSAGE_BASE_URL: z.url().default('https://api.afromessage.com/api'),
  SMS_SENDER: z.string().default('Natik'),
  /**
   * Where files (receipts, certificates, lesson files, pictures) are kept. `s3` = an S3-compatible
   * bucket (production). `database` = inside PostgreSQL itself: no extra account, meant for the free
   * pilot and for tests (a pilot-sized amount of files only; see docs/PILOT-HOSTING.md).
   */
  STORAGE_DRIVER: z.enum(['s3', 'database']).default('s3'),
  /**
   * Email: account details and password links for people an admin adds, and reset codes.
   * `console` = nothing is sent (the message is logged and, in development, shown at /api/v1/dev/email).
   * `smtp` = real email through any SMTP service (Brevo, Mailjet, your own server…).
   */
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  SMTP_HOST: z.string().optional(),
  /** 587 is the usual port; use 2525 where 25, 465 and 587 are blocked (Render's free plan). */
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** The login of the mail service. Leave both empty for a local test inbox (Mailpit). */
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** Who the messages come from, e.g. `Natik <owner@example.com>`. Most services need it verified first. */
  EMAIL_FROM: z.string().optional(),
  S3_ENDPOINT: z.url().default('http://localhost:9010'),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('natik-private'),
  S3_ACCESS_KEY: z.string().default('natik'),
  S3_SECRET_KEY: z.string().default('natik-dev-secret'),
  S3_FORCE_PATH_STYLE: z.stringbool().default(true),
  /** local = videos are stored in our own storage (development only). bunny = Bunny Stream (staging/production). */
  VIDEO_PROVIDER: z.enum(['local', 'bunny']).default('local'),
  BUNNY_LIBRARY_ID: z.string().optional(),
  /** Library API key: used server-side only, never sent to the browser. */
  BUNNY_API_KEY: z.string().optional(),
  /** Token authentication key of the library: signs the embed links. */
  BUNNY_TOKEN_KEY: z.string().optional(),
  BUNNY_API_URL: z.url().default('https://video.bunnycdn.com'),
  BUNNY_TUS_URL: z.url().default('https://video.bunnycdn.com/tusupload'),
  BUNNY_EMBED_URL: z.url().default('https://iframe.mediadelivery.net/embed'),
  /** The Stream library's CDN host (Bunny dashboard → Stream → API), for video thumbnails. */
  BUNNY_CDN_HOST: z.string().optional(),
  SENTRY_DSN: z
    .union([z.url(), z.literal('')])
    .optional()
    .transform((v) => v || undefined),
});

export type Env = z.infer<typeof envSchema>;

const DEV_DEFAULTS = ['OTP_PEPPER', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;
/** The storage keys only matter when files really go to a bucket. */
const STORAGE_KEYS = ['S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map(
      (i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${lines.join('\n')}\n` +
        'Fix apps/api/.env (see apps/api/.env.example) or the deployment environment.',
    );
  }
  if (result.data.EMAIL_PROVIDER === 'smtp') {
    const missing = (['SMTP_HOST', 'EMAIL_FROM'] as const).filter((key) => !result.data[key]);
    if (missing.length > 0) {
      throw new Error(
        `Invalid environment configuration:\n  • ${missing.join(', ')} are required when EMAIL_PROVIDER=smtp.`,
      );
    }
    // Real services need a login; a local test inbox (Mailpit) needs none. Never half of it.
    if (Boolean(result.data.SMTP_USER) !== Boolean(result.data.SMTP_PASSWORD)) {
      throw new Error(
        'Invalid environment configuration:\n  • SMTP_USER and SMTP_PASSWORD must be set together (or both left empty).',
      );
    }
  }
  if (result.data.SMS_PROVIDER === 'afromessage' && !result.data.AFROMESSAGE_TOKEN) {
    throw new Error(
      'Invalid environment configuration:\n  • AFROMESSAGE_TOKEN is required when SMS_PROVIDER=afromessage.',
    );
  }
  if (
    result.data.VIDEO_PROVIDER === 'bunny' &&
    !(result.data.BUNNY_LIBRARY_ID && result.data.BUNNY_API_KEY && result.data.BUNNY_TOKEN_KEY)
  ) {
    throw new Error(
      'Invalid environment configuration:\n  • BUNNY_LIBRARY_ID, BUNNY_API_KEY and BUNNY_TOKEN_KEY are required when VIDEO_PROVIDER=bunny.',
    );
  }
  if (result.data.APP_ENV === 'production' && result.data.VIDEO_PROVIDER === 'local') {
    throw new Error(
      'Invalid environment configuration:\n  • VIDEO_PROVIDER=local is for development only; use bunny in production.',
    );
  }
  if (result.data.APP_ENV === 'production' && result.data.SMS_PROVIDER === 'console') {
    throw new Error(
      'Invalid environment configuration:\n  • SMS_PROVIDER=console sends nothing; set a real provider in production.',
    );
  }
  // Never run staging/production on the built-in development secrets (NFR-SEC-006).
  if (result.data.APP_ENV === 'staging' || result.data.APP_ENV === 'production') {
    const needed = DEV_DEFAULTS.filter(
      (key) =>
        result.data.STORAGE_DRIVER === 's3' || !(STORAGE_KEYS as readonly string[]).includes(key),
    );
    const missing = needed.filter((key) => raw[key] === undefined || raw[key] === '');
    if (missing.length > 0) {
      throw new Error(
        `Invalid environment configuration:\n  • ${missing.join(', ')} must be set explicitly in ${result.data.APP_ENV}.`,
      );
    }
  }
  return result.data;
}
