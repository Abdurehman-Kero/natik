import Link from '@/components/ui/link';
import { PageFade } from '@/components/brand/page-fade';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { ChatButtons } from './chat-buttons';
import { Footer } from './footer';
import { PublicHeader } from './public-header';

/**
 * Visitors and public pages: header, page, footer. The page is the same for everyone, so it can be
 * built once and served fast; the header itself swaps to "Dashboard" for signed-in people (FR-WEB-002).
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    // Some browser extensions add attributes to this wrapper before React starts; ignore just that.
    <div className="flex min-h-dvh flex-col" suppressHydrationWarning>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
        <PageFade className="flex flex-1 flex-col">{children}</PageFade>
      </main>
      <Footer />
      <ChatButtons />
    </div>
  );
}

/** Sign-in, register and password pages: the full logo above one centred card. */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations('footer');
  return (
    <div className="flex min-h-dvh flex-col" suppressHydrationWarning>
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center px-4 py-8 focus:outline-none sm:py-12"
      >
        <Logo height={52} priority className="mb-6" />
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-8">
          {children}
        </div>
      </main>
      <footer className="flex justify-center gap-5 px-4 pb-6 text-sm">
        <Link
          href="/privacy"
          className="flex min-h-11 items-center text-muted hover:text-primary hover:underline"
        >
          {t('privacy')}
        </Link>
        <Link
          href="/terms"
          className="flex min-h-11 items-center text-muted hover:text-primary hover:underline"
        >
          {t('terms')}
        </Link>
      </footer>
    </div>
  );
}

export { StaffShell } from './staff-shell';
export { StudentShell } from './student-shell';
