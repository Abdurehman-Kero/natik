import { describe, expect, it } from 'vitest';
import { validateEnv } from './env';

const minimal = { DATABASE_URL: 'postgresql://natik:natik@localhost:5440/natik' };

const realSms = { SMS_PROVIDER: 'afromessage', AFROMESSAGE_TOKEN: 'token' };
const realVideo = {
  VIDEO_PROVIDER: 'bunny',
  BUNNY_LIBRARY_ID: '123',
  BUNNY_API_KEY: 'key',
  BUNNY_TOKEN_KEY: 'token-key',
};

describe('validateEnv', () => {
  it('applies safe defaults', () => {
    const env = validateEnv(minimal);
    expect(env.API_PORT).toBe(4000);
    expect(env.APP_ENV).toBe('local');
    expect(env.RUN_WORKER_IN_API).toBe(false);
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it('coerces strings from the environment', () => {
    const env = validateEnv({ ...minimal, API_PORT: '4100', RUN_WORKER_IN_API: 'true' });
    expect(env.API_PORT).toBe(4100);
    expect(env.RUN_WORKER_IN_API).toBe(true);
  });

  it('treats an empty SENTRY_DSN as not set', () => {
    expect(validateEnv({ ...minimal, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined();
  });

  it('fails fast with a readable message listing every problem', () => {
    const run = () => validateEnv({ DATABASE_URL: 'mysql://x', API_PORT: 'abc' });
    expect(run).toThrowError(/^Invalid environment configuration:/);
    expect(run).toThrowError(/• DATABASE_URL: DATABASE_URL must be a postgresql:\/\/ URL/);
    expect(run).toThrowError(/• API_PORT:/);
    expect(run).toThrowError(/Fix apps\/api\/\.env/);
  });

  it('requires DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrowError(/DATABASE_URL/);
  });
});

describe('secrets outside local development', () => {
  it('refuses the built-in development secrets in production', () => {
    expect(() =>
      validateEnv({ ...minimal, APP_ENV: 'production', ...realSms, ...realVideo }),
    ).toThrowError(/OTP_PEPPER/);
  });
  it('accepts explicit secrets in production', () => {
    const env = validateEnv({
      ...minimal,
      APP_ENV: 'production',
      ...realSms,
      ...realVideo,
      OTP_PEPPER: 'a-long-random-production-pepper',
      S3_ACCESS_KEY: 'key',
      S3_SECRET_KEY: 'secret',
    });
    expect(env.APP_ENV).toBe('production');
  });
});

describe('email settings', () => {
  it('sends nothing by default', () => {
    expect(validateEnv(minimal).EMAIL_PROVIDER).toBe('console');
  });
  it('needs the whole SMTP account when real email is chosen', () => {
    expect(() => validateEnv({ ...minimal, EMAIL_PROVIDER: 'smtp' })).toThrowError(
      /SMTP_HOST, EMAIL_FROM/,
    );
    // A login is both parts or nothing (a local test inbox needs none).
    expect(() =>
      validateEnv({
        ...minimal,
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'h',
        EMAIL_FROM: 'a@b.c',
        SMTP_USER: 'u',
      }),
    ).toThrowError(/SMTP_USER and SMTP_PASSWORD/);
    expect(
      validateEnv({
        ...minimal,
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'localhost',
        EMAIL_FROM: 'a@b.c',
      }).EMAIL_PROVIDER,
    ).toBe('smtp');
    const env = validateEnv({
      ...minimal,
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp-relay.brevo.com',
      SMTP_PORT: '2525',
      SMTP_USER: 'user',
      SMTP_PASSWORD: 'secret',
      EMAIL_FROM: 'Natik <owner@example.com>',
    });
    expect(env.SMTP_PORT).toBe(2525);
  });
});

describe('file storage settings', () => {
  const pilot = { ...minimal, APP_ENV: 'staging', OTP_PEPPER: 'a-long-random-pilot-pepper' };
  it('needs bucket keys when files go to a bucket', () => {
    expect(() => validateEnv(pilot)).toThrowError(/S3_ACCESS_KEY, S3_SECRET_KEY/);
    expect(validateEnv({ ...pilot, S3_ACCESS_KEY: 'k', S3_SECRET_KEY: 's' }).STORAGE_DRIVER).toBe(
      's3',
    );
  });
  it('needs no bucket at all when files are kept in the database (the free pilot)', () => {
    expect(validateEnv({ ...pilot, STORAGE_DRIVER: 'database' }).STORAGE_DRIVER).toBe('database');
  });
  it('still wants the pepper in that case', () => {
    expect(() =>
      validateEnv({ ...minimal, APP_ENV: 'staging', STORAGE_DRIVER: 'database' }),
    ).toThrowError(/OTP_PEPPER/);
  });
  it('refuses unknown drivers', () => {
    expect(() => validateEnv({ ...minimal, STORAGE_DRIVER: 'ftp' })).toThrowError(/STORAGE_DRIVER/);
  });
});

describe('video provider settings', () => {
  it('needs the Bunny keys when Bunny is chosen', () => {
    expect(() => validateEnv({ ...minimal, VIDEO_PROVIDER: 'bunny' })).toThrowError(
      /BUNNY_LIBRARY_ID/,
    );
    expect(validateEnv({ ...minimal, ...realVideo }).VIDEO_PROVIDER).toBe('bunny');
  });
  it('refuses the development video store in production', () => {
    expect(() =>
      validateEnv({
        ...minimal,
        APP_ENV: 'production',
        ...realSms,
        OTP_PEPPER: 'a-long-random-production-pepper',
        S3_ACCESS_KEY: 'k',
        S3_SECRET_KEY: 's',
      }),
    ).toThrowError(/VIDEO_PROVIDER=local/);
  });
});

describe('SMS provider settings', () => {
  it('needs a token for Afro Message', () => {
    expect(() => validateEnv({ ...minimal, SMS_PROVIDER: 'afromessage' })).toThrowError(
      /AFROMESSAGE_TOKEN/,
    );
    expect(
      validateEnv({ ...minimal, SMS_PROVIDER: 'afromessage', AFROMESSAGE_TOKEN: 't' }).SMS_PROVIDER,
    ).toBe('afromessage');
  });
  it('refuses the do-nothing driver in production', () => {
    expect(() =>
      validateEnv({
        ...minimal,
        APP_ENV: 'production',
        ...realVideo,
        OTP_PEPPER: 'a-long-random-production-pepper',
        S3_ACCESS_KEY: 'k',
        S3_SECRET_KEY: 's',
      }),
    ).toThrowError(/SMS_PROVIDER=console/);
  });
});
