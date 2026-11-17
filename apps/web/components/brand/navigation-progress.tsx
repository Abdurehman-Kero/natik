'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

/**
 * A thin gold bar at the top for the rare page that takes a moment (a slow connection). Pages are
 * fetched before the click, so most changes are instant and the bar never appears: it waits
 * SHOW_AFTER_MS before showing.
 */
const SHOW_AFTER_MS = 180;

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const guard = useRef<number | undefined>(undefined);
  const delay = useRef<number | undefined>(undefined);
  const where = `${pathname}?${search}`;
  const last = useRef(where);

  function start() {
    window.clearInterval(timer.current);
    window.clearTimeout(guard.current);
    window.clearTimeout(delay.current);
    delay.current = window.setTimeout(show, SHOW_AFTER_MS);
  }

  function show() {
    setVisible(true);
    setProgress(12);
    // Creep forward, slower and slower, never quite reaching the end until the page arrives.
    timer.current = window.setInterval(() => {
      setProgress((p) => p + (92 - p) * 0.12);
    }, 200);
    // Never leave the bar hanging if something goes wrong.
    guard.current = window.setTimeout(finish, 20_000);
  }

  function finish() {
    window.clearInterval(timer.current);
    window.clearTimeout(guard.current);
    window.clearTimeout(delay.current);
    setProgress(100);
    window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;
      start();
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start is stable in effect: it only uses refs and setters
  }, []);

  // The address changed: the new page is on screen.
  useEffect(() => {
    if (last.current === where) return;
    last.current = where;
    finish();
  }, [where]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] h-[3px]"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }}
    >
      <div
        className="h-full origin-left bg-accent shadow-[0_0_8px_rgb(182_154_74/0.7)]"
        style={{
          transform: `scaleX(${progress / 100})`,
          transition: progress === 0 ? 'none' : 'transform 250ms ease-out',
        }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
