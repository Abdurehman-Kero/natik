'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * On phones, a slim bar with the price and a "Join this course" button that appears once the real
 * action card has scrolled out of view, so the next step is always one tap away. It scrolls back to
 * that card; the card itself stays the only place where the action happens.
 */
export function StickyJoinBar({ price, targetId }: { price: string; targetId: string }) {
  const t = useTranslations('site.course');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show it only after the card has gone off the top, not while it is still below.
        setVisible(!entry!.isIntersecting && entry!.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={
        'fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t border-border bg-surface/95 px-4 py-2.5 pe-20 shadow-raised backdrop-blur transition-transform duration-300 lg:hidden ' +
        (visible ? 'translate-y-0' : 'translate-y-full')
      }
    >
      <p className="min-w-0 flex-1 truncate font-heading text-lg font-bold text-primary">{price}</p>
      <Button
        size="md"
        onClick={() =>
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      >
        {t('joinBar')}
      </Button>
    </div>
  );
}
