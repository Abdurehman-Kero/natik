import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CLIENT_NAMESPACES, type MessageArea } from '@/i18n/client-namespaces';

/**
 * Gives the browser the texts of one part of the site, and only those. Sending the whole language
 * file with every page added about 100 kB to each one (twice, once in the page and once in the data
 * behind it). Which texts a part needs is worked out by `scripts/client-messages.mjs`, which also
 * fails `pnpm lint` when a component uses a text group its part does not send yet.
 *
 * Texts used in server components (most page titles and bodies) never need to be sent.
 */
export async function ClientMessages({
  area,
  children,
}: {
  area: MessageArea;
  children: ReactNode;
}) {
  const all = (await getMessages()) as Record<string, unknown>;
  const messages: Record<string, unknown> = {};
  for (const name of CLIENT_NAMESPACES[area]) {
    if (name in all) messages[name] = all[name];
  }
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
