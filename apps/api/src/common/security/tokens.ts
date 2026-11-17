import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** 32 random bytes as URL-safe text: session cookies and "set password" links. */
export const newToken = (): string => randomBytes(32).toString('base64url');

/** Stored instead of the token itself, so a database leak can't be used to sign in. */
export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** Cryptographically random 6-digit SMS code (never starts a pattern; leading zeros kept). */
export const newOtpCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** SMS codes are short, so they are hashed with a server secret (a plain hash is easy to brute-force). */
export const hashOtp = (pepper: string, phone: string, code: string): string =>
  createHmac('sha256', pepper).update(`${phone}:${code}`).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
