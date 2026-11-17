import argon2 from 'argon2';

/** Argon2id with OWASP-recommended cost settings (NFR-SEC-002). */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // KiB (19 MiB)
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
