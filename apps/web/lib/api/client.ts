'use client';

import { useTranslations } from 'next-intl';
import { markDataChanged } from '@/lib/data-changes';
import { ApiError, networkError, parseResponse } from './errors';

/** Calls the API from the browser (same origin: /api/v1/…, session cookie included). */
export async function api<T>(
  path: string,
  init: RequestInit & {
    json?: unknown;
    /** A background call (read receipt, "where you stopped") that changes nothing other pages show. */
    quiet?: boolean;
  } = {},
): Promise<T> {
  const { json, quiet, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set('accept', 'application/json');
  if (json !== undefined) headers.set('content-type', 'application/json');

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      credentials: 'same-origin',
    });
  } catch (cause) {
    throw networkError(cause);
  }
  const body = await parseResponse<T>(res);
  // Something was saved: pages fetched ahead of time may now be out of date.
  const method = (rest.method ?? 'GET').toUpperCase();
  if (!quiet && method !== 'GET' && method !== 'HEAD') markDataChanged();
  return body;
}

/** Turns any error into a friendly, translated sentence (SRS §10 wording). */
export function useErrorMessage(): (error: unknown) => string {
  const t = useTranslations('errors');
  return (error) => {
    if (error instanceof ApiError) {
      const key = error.code as Parameters<typeof t>[0];
      if (t.has(key)) return t(key, error.params as Record<string, string>);
      return error.message || t('INTERNAL_ERROR');
    }
    return t('INTERNAL_ERROR');
  };
}
