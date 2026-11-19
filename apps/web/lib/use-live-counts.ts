'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export type CountKey =
  'chat' | 'messages' | 'payments' | 'marking' | 'certificates' | 'enrolments' | 'groups';
export type Counts = Partial<Record<CountKey, number>>;

const ENDPOINT: Record<CountKey, string> = {
  chat: '/api/v1/chat/unread-count',
  messages: '/api/v1/admin/messages/count',
  payments: '/api/v1/admin/payments/count',
  marking: '/api/v1/teach/marking/count',
  certificates: '/api/v1/admin/certificate-requests/count',
  enrolments: '/api/v1/admin/enrolments/requests/count',
  groups: '/api/v1/groups/unread-count',
};
const EVENT = 'natik:counts';
const EVERY_MS = 15_000;

/** Ask every menu badge to look again now (after reading a chat, closing a message, marking). */
export function refreshCounts(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

/**
 * The numbers on the menu and top bar, kept up to date. They start from what the server counted when
 * the page was built, then look again whenever you open another page, every few seconds while the tab
 * is open, and straight away after something is read (`refreshCounts`), so a count goes down as soon
 * as you have seen what it was counting.
 */
export function useLiveCounts(initial: Counts): Counts {
  const [counts, setCounts] = useState<Counts>(initial);
  const keys = useRef(Object.keys(initial) as CountKey[]);
  const pathname = usePathname();

  const load = useCallback(async () => {
    const entries = await Promise.all(
      keys.current.map(async (key) => {
        try {
          const res = await fetch(ENDPOINT[key], { credentials: 'same-origin' });
          if (!res.ok) return null;
          const body = (await res.json()) as { count: number };
          return [key, body.count] as const;
        } catch {
          return null;
        }
      }),
    );
    const next = Object.fromEntries(entries.filter((e) => e !== null));
    if (Object.keys(next).length > 0) setCounts((current) => ({ ...current, ...next }));
  }, []);

  // Moving to another page: look again.
  useEffect(() => {
    void load();
  }, [pathname, load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, EVERY_MS);
    const onEvent = () => void load();
    window.addEventListener(EVENT, onEvent);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(EVENT, onEvent);
    };
  }, [load]);

  return counts;
}
