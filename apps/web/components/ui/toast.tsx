'use client';

import { useEffect, useState } from 'react';
import { Toaster as Sonner } from 'sonner';

export { toast } from 'sonner';

/** Toasts: top-centre on phones (so they never cover the bottom buttons), top-right on desktop. 4 s (DESIGN.md §10). */
export function Toaster() {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return (
    <Sonner
      position={desktop ? 'top-right' : 'top-center'}
      duration={4000}
      offset={desktop ? 24 : 16}
      toastOptions={{
        classNames: {
          toast:
            'flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 text-base text-ink shadow-overlay font-sans',
          title: 'font-semibold',
          description: 'text-sm text-muted',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-danger',
          actionButton: '!bg-primary !text-white !rounded-lg !font-semibold',
        },
      }}
    />
  );
}
