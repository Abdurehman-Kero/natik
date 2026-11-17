'use client';

import { forgetSession } from '@/lib/use-session';
import { signInSchema } from '@natik/shared';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { DevAccountSwitcher } from '@/components/dev/dev-account-switcher';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordField } from '@/components/ui/password-field';
import { PhoneField } from '@/components/ui/phone-field';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { type FieldErrors, validate } from '@/lib/forms';

export function SignInForm({ next }: { next: string | null }) {
  const t = useTranslations('auth');
  const ts = useTranslations('auth.signIn');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ locked: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(signInSchema, { phone, password, keepSignedIn: keep });
    setErrors(found);
    if (!data) return;

    setBusy(true);
    try {
      const result = await api<{ home: string }>('/auth/sign-in', { method: 'POST', json: data });
      forgetSession();
      router.replace(next ?? result.home);
      router.refresh();
    } catch (error) {
      setFormError({
        locked: error instanceof ApiError && error.code === 'ACCOUNT_LOCKED',
        text: errorMessage(error),
      });
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold md:text-[1.75rem]">{ts('title')}</h1>

      {formError ? (
        <Alert
          tone="danger"
          action={
            formError.locked ? (
              <Link href="/forgot-password" className="font-semibold underline">
                {t('forgot.title')}
              </Link>
            ) : null
          }
        >
          {formError.text}
        </Alert>
      ) : null}

      {/* Development only: quick sign-in for the practice accounts. Remove before launch. */}
      {process.env.NODE_ENV === 'development' ? <DevAccountSwitcher next={next} /> : null}

      <PhoneField
        label={t('phone')}
        value={phone}
        onValueChange={setPhone}
        error={errors.phone}
        autoFocus
      />
      <PasswordField
        label={t('password')}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Checkbox
          label={ts('keep')}
          checked={keep}
          onCheckedChange={(value) => setKeep(value === true)}
        />
        <Link
          href="/forgot-password"
          className="flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
        >
          {ts('forgot')}
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {ts('cta')}
      </Button>

      <p className="text-center text-muted">
        {ts('newHere')}{' '}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
        >
          {ts('create')}
        </Link>
      </p>
    </form>
  );
}
