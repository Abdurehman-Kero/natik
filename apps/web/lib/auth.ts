import 'server-only';
import type { Role } from '@natik/shared';
import { redirect } from 'next/navigation';
import { apiFetch } from './api/server';
import { ApiError } from './api/errors';
import { HOME_FOR_ROLE, type UserView } from './api/types';

/**
 * The signed-in user, or null for visitors. On public pages `tolerant` treats an unreachable API
 * like "not signed in", so the marketing site keeps working even if the API restarts.
 */
export async function getCurrentUser(
  options: { tolerant?: boolean } = {},
): Promise<UserView | null> {
  try {
    return await apiFetch<UserView>('/me');
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return null;
      if (options.tolerant && error.status === 0) return null;
    }
    throw error;
  }
}

/** Only same-site paths: stops "?next=https://evil.example" redirects. */
export function safeNext(value: string | string[] | undefined): string | null {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  return next;
}

/**
 * Guards an area. Visitors go to sign-in (and come back after); someone in the wrong area
 * goes to their own home instead of seeing an error.
 */
export async function requireRole(roles: Role[], returnTo: string): Promise<UserView> {
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  if (!roles.includes(user.role)) redirect(HOME_FOR_ROLE[user.role]);
  return user;
}
