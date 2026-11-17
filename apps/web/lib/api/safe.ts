import 'server-only';
import { ApiError } from './errors';
import { apiFetch } from './server';

export type Loaded<T> = { ok: true; data: T } | { ok: false; reason: 'forbidden' | 'missing' };

/**
 * Loads data for a page and turns "not yours" (403) and "not found" (404) into a result the page can
 * show as a friendly screen. Other failures (sign-in, outages) still go to the normal error handling.
 */
export async function loadOrDenied<T>(path: string): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await apiFetch<T>(path) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403)
      return { ok: false, reason: 'forbidden' };
    if (error instanceof ApiError && error.status === 404) return { ok: false, reason: 'missing' };
    throw error;
  }
}
