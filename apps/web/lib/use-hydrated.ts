'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False on the server and until the page's JavaScript has taken over, then true. Submit buttons wait
 * for it, so a tap on a slow connection can't be lost to a page that isn't ready yet.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
