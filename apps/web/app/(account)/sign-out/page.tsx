'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { api } from '@/lib/api/client';

/**
 * Ends the session through the API (a POST, so a stray link can't sign someone out), then returns home.
 * Always finishes, even if the request fails, so nobody is left stuck on this page.
 */
export default function SignOutPage() {
  const t = useTranslations('profile');

  useEffect(() => {
    // A full page load (not a client-side navigation) so no signed-in page stays cached.
    api('/auth/sign-out', { method: 'POST' })
      .catch(() => undefined)
      .finally(() => window.location.replace('/'));
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center" role="status">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <h1 className="text-xl font-semibold">{t('signingOut')}</h1>
    </div>
  );
}
