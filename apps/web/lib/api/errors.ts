import { isApiErrorBody } from '@natik/shared/errors';

/** An error from the Natik API, carrying its stable code for translated messages. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
    readonly params?: Record<string, string | number>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Parses a fetch Response: JSON body on success, ApiError on failure. */
export async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
  }
  if (res.ok) return body as T;
  if (isApiErrorBody(body)) {
    const { code, message, fields, params, requestId } = body.error;
    throw new ApiError(res.status, code, message, fields, params, requestId);
  }
  throw new ApiError(
    res.status,
    res.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
    res.statusText,
  );
}

/** Thrown when the request never reached the API (offline, DNS, timeout). */
export function networkError(cause: unknown): ApiError {
  const error = new ApiError(0, 'NETWORK', 'Network error');
  error.cause = cause;
  return error;
}
