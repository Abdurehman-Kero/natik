'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, ViewTransition } from 'react';
import { cn } from '@/lib/cn';

/**
 * Moving between pages cross-fades the old page into the new one (the browser's View Transitions),
 * instead of one page switching off and the next switching on. Browsers without that feature get a
 * short fade-in instead, so the change is never abrupt.
 */
export function PageFade({ children, className }: { children: ReactNode; className?: string }) {
  const pathname = usePathname();
  return (
    <ViewTransition default="natik-page">
      <div key={pathname} className={cn('page-fade', className)}>
        {children}
      </div>
    </ViewTransition>
  );
}
