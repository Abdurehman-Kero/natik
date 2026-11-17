'use client';

import { CircleCheck, LinkIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LinkButton } from '@/components/ui/button';
import { NewPasswordForm } from './new-password-form';

/** The page behind the SMS "set your password" link (new accounts and admin-sent links). */
export function SetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations('auth.setPassword');
  const [state, setState] = useState<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid');

  if (state === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success"
          aria-hidden
        >
          <CircleCheck className="size-7" />
        </span>
        <h1 className="text-2xl font-bold">{t('doneTitle')}</h1>
        <p className="text-muted">{t('doneText')}</p>
        <LinkButton href="/sign-in" size="lg" fullWidth className="mt-2">
          {t('goSignIn')}
        </LinkButton>
      </div>
    );
  }

  if (state === 'invalid' || !token) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning"
          aria-hidden
        >
          <LinkIcon className="size-7" />
        </span>
        <h1 className="text-2xl font-bold">{t('invalidTitle')}</h1>
        <p className="text-muted">{t('invalidText')}</p>
        <LinkButton href="/forgot-password" size="lg" fullWidth className="mt-2">
          {t('requestNew')}
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold md:text-[1.75rem]">{t('title')}</h1>
      <NewPasswordForm
        token={token}
        saveLabel={t('save')}
        onDone={() => setState('done')}
        onInvalidToken={() => setState('invalid')}
      />
    </div>
  );
}
