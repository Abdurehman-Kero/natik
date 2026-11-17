'use client';

import { CloudOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button, LinkButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/** Friendly error page with "Try again" (SRS §10). Details go to the console/monitoring, not the user. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errorPage');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <EmptyState
        as="h1"
        icon={CloudOff}
        title={t('title')}
        description={t('text')}
        action={
          <>
            <Button onClick={reset}>{t('tryAgain')}</Button>
            <LinkButton href="/" variant="secondary">
              {t('home')}
            </LinkButton>
          </>
        }
      />
    </div>
  );
}
