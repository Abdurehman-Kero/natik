'use client';

import { forgetSession } from '@/lib/use-session';
import { registerSchema } from '@natik/shared';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/input';
import { PasswordField } from '@/components/ui/password-field';
import { PhoneField } from '@/components/ui/phone-field';
import { RadioCards } from '@/components/ui/radio-cards';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { LanguageOption } from '@/lib/api/types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

export function RegisterForm({
  languages,
  next,
}: {
  languages: LanguageOption[];
  next: string | null;
}) {
  const t = useTranslations('auth');
  const tr = useTranslations('auth.register');
  const errorMessage = useErrorMessage();
  const router = useRouter();

  const [values, setValues] = useState({
    fullName: '',
    phone: '',
    password: '',
    email: '',
    interestLanguageId: '',
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phoneTaken, setPhoneTaken] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setPhoneTaken(false);
    const payload = {
      fullName: values.fullName,
      phone: values.phone,
      password: values.password,
      email: values.email || undefined,
      interestLanguageId: values.interestLanguageId || undefined,
      acceptTerms: terms,
      confirmAge: terms,
    };
    const { data, errors: found } = validate(registerSchema, payload);
    // One checkbox covers both promises, so show a single message under it.
    const shown = {
      ...found,
      ...(found.acceptTerms || found.confirmAge ? { terms: tr('termsError') } : {}),
    };
    setErrors(shown);
    if (!data) return;

    setBusy(true);
    try {
      const result = await api<{ home: string }>('/auth/register', { method: 'POST', json: data });
      forgetSession();
      router.replace(next ?? result.home);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PHONE_ALREADY_REGISTERED') {
        setPhoneTaken(true);
        setErrors({ phone: tr('phoneTaken') });
      } else {
        setErrors(apiFieldErrors(error));
        setFormError(errorMessage(error));
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold md:text-[1.75rem]">{tr('title')}</h1>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <TextField
        label={t('fullName')}
        autoComplete="name"
        value={values.fullName}
        onChange={(e) => set('fullName')(e.target.value)}
        error={errors.fullName}
        autoFocus
      />

      <div className="flex flex-col gap-2">
        <PhoneField
          label={t('phone')}
          value={values.phone}
          onValueChange={set('phone')}
          error={errors.phone}
        />
        {phoneTaken ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/sign-in">{tr('signInInstead')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/forgot-password">{tr('resetInstead')}</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <PasswordField
        label={t('password')}
        autoComplete="new-password"
        hint={t('passwordHint')}
        value={values.password}
        onChange={(e) => set('password')(e.target.value)}
        error={errors.password}
      />

      {languages.length > 0 ? (
        <RadioCards
          label={t('learn')}
          optional
          value={values.interestLanguageId}
          onValueChange={set('interestLanguageId')}
          options={languages.map((l) => ({
            value: l.id,
            label: l.name,
            lang: l.code,
          }))}
        />
      ) : null}

      <TextField
        label={t('email')}
        optional
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(e) => set('email')(e.target.value)}
        error={errors.email}
      />

      <Checkbox
        checked={terms}
        onCheckedChange={(value) => setTerms(value === true)}
        error={errors.terms}
        label={
          <>
            {tr('termsPre')}{' '}
            <Link href="/terms" target="_blank" className="font-semibold text-primary underline">
              {tr('termsLink')}
            </Link>{' '}
            {tr('termsAnd')}{' '}
            <Link href="/privacy" target="_blank" className="font-semibold text-primary underline">
              {tr('privacyLink')}
            </Link>
          </>
        }
      />

      <Button type="submit" size="lg" fullWidth loading={busy}>
        {tr('cta')}
      </Button>

      <p className="text-center text-muted">
        {tr('haveAccount')}{' '}
        <Link
          href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
          className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
        >
          {tr('signIn')}
        </Link>
      </p>
    </form>
  );
}
