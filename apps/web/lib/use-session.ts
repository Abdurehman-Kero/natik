'use client';

import { useEffect, useState } from 'react';
import type { UserView } from '@/lib/api/types';

let pending: Promise<UserView | null> | null = null;
let loadedAt = 0;

const listeners = new Set<() => void>();

/**
 * Drop the remembered answer, e.g. right after signing in or registering. Parts of the page that
 * are already showing ask again, so the header turns into "Dashboard" without a reload.
 */
export function forgetSession() {
  pending = null;
  listeners.forEach((listener) => listener());
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
    const load = () =>
      void loadSession().then((user) => {
        if (active) setState({ user, ready: true });
      });
    load();
    listeners.add(load);
    return () => {
      active = false;
      listeners.delete(load);
    };
  }, []);
  return state;
}
