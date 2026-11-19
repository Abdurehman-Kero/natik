import Link from '@/components/ui/link';
import { PageFade } from '@/components/brand/page-fade';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { AuthProvider } from '@/components/auth/auth-dialog';
import { SiteToolsProvider } from '@/components/public/site-tools';
import { TourProvider } from '@/components/tour/site-tour';
import { ChatButtons } from './chat-buttons';
import { Footer } from './footer';
import { PublicBottomBar } from './public-bottom-bar';
import { PublicHeader } from './public-header';

/**
 * Visitors and public pages: header, page, footer. The page is the same for everyone, so it can be
 * built once and served fast; the header itself swaps to "Dashboard" for signed-in people (FR-WEB-002).
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    // Some browser extensions add attributes to this wrapper before React starts; ignore just that.
    <AuthProvider>
      <SiteToolsProvider>
        <TourProvider>
          <div className="flex min-h-dvh flex-col max-lg:pb-16" suppressHydrationWarning>
            <PublicHeader />
            <main id="main" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
              <PageFade className="flex flex-1 flex-col">{children}</PageFade>
            </main>
            <Footer />
            <ChatButtons />
            <PublicBottomBar />
          </div>
        </TourProvider>
      </SiteToolsProvider>
    </AuthProvider>
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
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-card transition-[max-width] has-[[data-wide]]:max-w-3xl sm:p-8">
          <span
            className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary via-accent to-primary"
            aria-hidden
          />
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
