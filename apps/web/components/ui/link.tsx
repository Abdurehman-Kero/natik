'use client';

import NextLink from 'next/link';
import { type ComponentProps, type MouseEvent, useState } from 'react';
import { noteNavigation } from '@/lib/data-changes';

type LinkProps = ComponentProps<typeof NextLink>;

/** A plain left click on a link to another page of this site, which Next.js would handle itself. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  const link = event.currentTarget;
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!link.target || link.target === '_self') &&
    !link.hasAttribute('download') &&
    link.origin === window.location.origin
  );
}

/**
 * Every link in the app. Next.js only prepares a page ahead of time when it can be built once for
 * everyone; most Natik pages depend on who is signed in and on their language, so by default nothing
 * would be ready and every click would wait for the server.
 *
 * So the whole next page is fetched ahead of the click:
 * - menus, tabs and sidebars pass `prefetch` and are fetched as soon as they are on screen;
 * - every other link is fetched the moment someone shows they are about to use it: the pointer
 *   moves over it, a finger touches it, or the keyboard focuses it. That is usually 100–300 ms before
 *   the click lands, enough for the page to be ready when it does.
 *
 * Fetching every link on screen would multiply the work for long lists (course cards, tables), so
 * those wait for that sign of intent. Pass `prefetch={false}` for links that must never be fetched
 * early (sign out, downloads).
 *
 * After the person changes something, the page fetched earlier may be a little out of date: it still
 * opens at once, and its data is fetched again straight after (RefreshOnArrival).
 */
export default function Link({
  prefetch,
  onMouseEnter,
  onTouchStart,
  onFocus,
  onClick,
  ...props
}: LinkProps) {
  const [intent, setIntent] = useState(false);
  const automatic = prefetch === undefined || prefetch === null;
  const showIntent = () => {
    if (automatic && !intent) setIntent(true);
  };

  return (
    <NextLink
      {...props}
      prefetch={automatic ? (intent ? true : false) : prefetch}
      onMouseEnter={(event) => {
        showIntent();
        onMouseEnter?.(event);
      }}
      onTouchStart={(event) => {
        showIntent();
        onTouchStart?.(event);
      }}
      onFocus={(event) => {
        showIntent();
        onFocus?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);
        if (isPlainClick(event)) noteNavigation();
      }}
    />
  );
}
