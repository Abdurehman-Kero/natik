'use client';

import { useEffect, useState } from 'react';
import type { UserView } from '@/lib/api/types';

let pending: Promise<UserView | null> | null = null;
let loadedAt = 0;

/** Drop the remembered answer, e.g. right after signing in or registering. */
export function forgetSession() {
  pending = null;
}

/** Asks the API who is signed in, once per page load. Visitors (401) and failures both mean "nobody". */
function loadSession(): Promise<UserView | null> {
  if (pending && Date.now() - loadedAt > 5000) pending = null;
  if (!pending) loadedAt = Date.now();
  pending ??= fetch('/api/v1/me', {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  })
    .then((res) => (res.ok ? (res.json() as Promise<UserView>) : null))
    .catch(() => null);
  return pending;
}

/**
 * Who is signed in, for public pages. Those pages are built once and cached for everyone, so they
 * cannot know the visitor on the server; the few parts that differ ask here instead.
 * `ready` is false until the answer arrives.
 */
export function useSession(): { user: UserView | null; ready: boolean } {
  const [state, setState] = useState<{ user: UserView | null; ready: boolean }>({
    user: null,
    ready: false,
  });
  useEffect(() => {
    let active = true;
    void loadSession().then((user) => {
      if (active) setState({ user, ready: true });
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
