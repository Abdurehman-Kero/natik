'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { takeRefreshOnArrival } from '@/lib/data-changes';

/**
 * After the person changed something, the page they open next is shown at once from what was fetched
 * ahead of time, then its data is fetched again in the background, so it is both instant and current.
 */
export function RefreshOnArrival() {
  const pathname = usePathname();
  const router = useRouter();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (takeRefreshOnArrival()) router.refresh();
  }, [pathname, router]);

  return null;
}
