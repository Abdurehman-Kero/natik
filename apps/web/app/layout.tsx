import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import { OPEN_GRAPH_LOCALE, type Locale } from '@/i18n/config';
import { fontVariables } from '@/lib/fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  const locale = (await getLocale()) as Locale;
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
    title: { default: t('title'), template: `%s · ${t('siteName')}` },
    description: t('description'),
    applicationName: t('siteName'),
    openGraph: {
      type: 'website',
      siteName: t('siteName'),
      title: t('title'),
      description: t('description'),
      locale: OPEN_GRAPH_LOCALE[locale],
    },
  };
}

export const viewport: Viewport = {
  themeColor: '#123b5a',
  width: 'device-width',
  initialScale: 1,
};

// suppressHydrationWarning: browser extensions (colour pickers, shortcut tools) add attributes to
// <html> and <body> before React loads. This ignores only those two elements, not the rest of the page.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('nav');
  const locale = await getLocale();
  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-white"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
