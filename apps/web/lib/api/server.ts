import 'server-only';
import { cookies } from 'next/headers';
import { networkError, parseResponse } from './errors';

const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Calls the API from Server Components and Route Handlers, forwarding the
 * visitor's cookies so the API sees their session. Never cached.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (cookieHeader) headers.set('cookie', cookieHeader);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, { ...init, headers, cache: 'no-store' });
  } catch (cause) {
    throw networkError(cause);
  }
  return parseResponse<T>(res);
}
