'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { NavigationProgress } from '@/components/brand/navigation-progress';
import { RefreshOnArrival } from '@/components/brand/refresh-on-arrival';

// Toasts are only ever shown after something is done on the page, so they load after the page is
// interactive instead of delaying it (NFR-PERF-001).
const Toaster = dynamic(() => import('@/components/ui/toast').then((m) => m.Toaster), {
  ssr: false,
});

/** App-wide client providers. Kept to the minimum so public pages stay light. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <NavigationProgress />
      <RefreshOnArrival />
      {children}
      <Toaster />
    </>
  );
}
