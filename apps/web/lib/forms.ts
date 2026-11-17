import type { ZodType } from 'zod';
import { ApiError } from './api/errors';

export type FieldErrors = Record<string, string>;

/** Checks values with the same rules the server uses. Returns the first message per field. */
export function validate<T>(
  schema: ZodType<T>,
  values: unknown,
): { data?: T; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!errors[key]) errors[key] = issue.message;
  }
  return { errors };
}

/** Field messages the server sent back (e.g. "This number already has an account."). */
export function apiFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ApiError) || !error.fields) return {};
  return Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k, v[0] ?? '']));
}
