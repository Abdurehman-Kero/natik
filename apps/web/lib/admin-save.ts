'use client';

import { refreshPublicSite } from '@/app/admin/website/actions';
import { api } from '@/lib/api/client';

/** Saves website content through the API, then tells the public pages to refresh. */
export async function saveSite<T>(
  path: string,
  init: { method: 'PUT' | 'POST' | 'PATCH' | 'DELETE'; json?: unknown },
): Promise<T> {
  const result = await api<T>(path, init);
  await refreshPublicSite().catch(() => undefined);
  return result;
}
