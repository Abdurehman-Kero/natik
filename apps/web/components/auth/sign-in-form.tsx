'use client';

import { forgetSession } from '@/lib/use-session';
import { signInSchema } from '@natik/shared';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { GoogleButton } from '@/components/auth/google-button';
import { DevAccountSwitcher } from '@/components/dev/dev-account-switcher';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordField } from '@/components/ui/password-field';
import { TextField } from '@/components/ui/input';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { type FieldErrors, validate } from '@/lib/forms';

/**
 * `embedded` (inside the sign-in dialog): no page title, no page change; the parent decides where to
 * go next, and the "create an account" link switches the dialog instead.
 */
export function SignInForm({
  next,
  notice,
  embedded,
  onDone,
  onSwitch,
}: {
  next: string | null;
  /** Why "Continue with Google" did not sign the person in (the API sends them back with ?google=…). */
  notice?: string | null;
  embedded?: boolean;
  onDone?: (home: string) => void;
  onSwitch?: () => void;
}) {
  const t = useTranslations('auth');
  const ts = useTranslations('auth.signIn');
  const tg = useTranslations('auth.google');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keep, setKeep] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<{ locked: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(signInSchema, { email, password, keepSignedIn: keep });
    setErrors(found);
    if (!data) return;

    setBusy(true);
    try {
      const result = await api<{ home: string }>('/auth/sign-in', { method: 'POST', json: data });
      forgetSession();
      if (onDone) {
        onDone(result.home);
      } else {
        router.replace(next ?? result.home);
        router.refresh();
      }
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
      {embedded ? null : (
        <header className="text-center">
          <h1 className="text-2xl font-bold md:text-[1.75rem]">{ts('title')}</h1>
          <p className="mt-1 text-muted">{ts('subtitle')}</p>
        </header>
      )}

      {notice && tg.has(`notice.${notice}` as 'notice.invalid') ? (
        <Alert tone={notice === 'cancelled' ? 'info' : 'danger'}>
          {tg(`notice.${notice}` as 'notice.invalid')}
        </Alert>
      ) : null}

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

      <GoogleButton next={next} />

      {/* Development only: fills in a practice account (you still press Sign in). Remove before launch. */}
      {process.env.NODE_ENV === 'development' ? (
        <DevAccountSwitcher
          onPick={(account) => {
            setEmail(account.email);
            setPassword(account.password);
            setErrors({});
            setFormError(null);
          }}
        />
      ) : null}

      <TextField
        label={t('email')}
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
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
        {onSwitch ? (
          <button
            type="button"
            onClick={onSwitch}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {ts('create')}
          </button>
        ) : (
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {ts('create')}
          </Link>
        )}
      </p>
    </form>
  );
}
