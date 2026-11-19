'use client';

import { forgotPasswordSchema } from '@natik/shared';
import { CircleCheck } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, LinkButton } from '@/components/ui/button';
import { OtpField } from '@/components/ui/otp-field';
import { TextField } from '@/components/ui/input';
import { Stepper } from '@/components/ui/stepper';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { type FieldErrors, validate } from '@/lib/forms';
import { formatCountdown, useCountdown } from '@/lib/use-countdown';
import { NewPasswordForm } from './new-password-form';

type Step = 'email' | 'code' | 'password' | 'done';

/** Forgot password in three short steps on one page: email, SMS code, new password. */
export function ForgotPasswordFlow() {
  const t = useTranslations('auth.forgot');
  const tv = useTranslations('auth.code');
  const ta = useTranslations('auth');
  const errorMessage = useErrorMessage();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [code, setCode] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seconds, restart] = useCountdown(0);

  const stepIndex = { email: 0, code: 1, password: 2, done: 3 }[step];

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setError(null);
    const { data, errors: found } = validate(forgotPasswordSchema, { email });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await api('/auth/password/forgot', { method: 'POST', json: data });
      restart(60);
      if (step === 'code') toast.success(tv('resent'));
      setStep('code');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    setError(null);
    setBusy(true);
    try {
      const result = await api<{ token: string }>('/auth/password/verify-code', {
        method: 'POST',
        json: { email, code: value },
      });
      setToken(result.token);
      setStep('password');
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'done') {
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

  return (
    <div className="flex flex-col gap-6">
      <Stepper
        steps={[t('steps.email'), t('steps.code'), t('steps.password')]}
        current={stepIndex}
      />

      {step === 'email' ? (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold md:text-[1.75rem]">{t('title')}</h1>
            <p className="text-muted">{t('emailText')}</p>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <TextField
            label={ta('email')}
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
          <Button type="submit" size="lg" fullWidth loading={busy}>
            {t('sendCode')}
          </Button>
          <Link
            href="/sign-in"
            className="flex min-h-11 items-center justify-center font-semibold text-primary hover:underline"
          >
            {t('backToSignIn')}
          </Link>
        </form>
      ) : null}

      {step === 'code' ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold md:text-[1.75rem]">{t('codeTitle')}</h1>
            <p className="text-muted">{t('sentNote')}</p>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <OtpField
            label={t('codeTitle')}
            hideLabel
            value={code}
            onValueChange={setCode}
            onComplete={verify}
            disabled={busy}
            autoFocus
          />
          <Button
            size="lg"
            fullWidth
            loading={busy}
            disabled={code.length < 6}
            onClick={() => verify(code)}
          >
            {t('codeCta')}
          </Button>
          <div className="flex justify-center">
            {seconds > 0 ? (
              <p className="flex min-h-11 items-center text-muted" aria-live="polite">
                {tv('resendIn', { time: formatCountdown(seconds) })}
              </p>
            ) : (
              <Button variant="ghost" onClick={() => sendCode()} disabled={busy}>
                {tv('resend')}
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === 'password' ? (
        <div className="flex flex-col gap-5">
          <h1 className="text-2xl font-bold md:text-[1.75rem]">{t('newTitle')}</h1>
          <NewPasswordForm
            token={token}
            saveLabel={t('save')}
            onDone={() => setStep('done')}
            onInvalidToken={() => {
              setCode('');
              setError(null);
              setStep('email');
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
