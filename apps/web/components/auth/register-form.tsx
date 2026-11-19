'use client';

import { forgetSession } from '@/lib/use-session';
import { registerSchema } from '@natik/shared';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/input';
import { PasswordField } from '@/components/ui/password-field';
import { PhoneField } from '@/components/ui/phone-field';
import { RadioCards } from '@/components/ui/radio-cards';
import { SelectField } from '@/components/ui/select';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { LanguageOption } from '@/lib/api/types';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { useCountryOptions } from '@/lib/use-country-options';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

/** A titled group of fields: "Personal information" and "Account information". */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-5">
      <h2
        id={id}
        className="mb-1 border-b border-border pb-2 font-sans text-base font-bold text-primary"
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

/**
 * Create an account: personal information (name, gender, where you are) beside account information
 * (phone, password), on one calm card. Two columns from tablets up, one on phones.
 */
export function RegisterForm({
  languages,
  next,
  embedded,
  onDone,
  onSwitch,
}: {
  languages: LanguageOption[];
  next: string | null;
  /** Inside the sign-in dialog: no page title; the parent decides where to go next. */
  embedded?: boolean;
  onDone?: (home: string) => void;
  onSwitch?: () => void;
}) {
  const t = useTranslations('auth');
  const tr = useTranslations('auth.register');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const countries = useCountryOptions(locale, DEFAULT_COUNTRY);

  const [values, setValues] = useState({
    firstName: '',
    lastName: '',
    gender: '',
    country: DEFAULT_COUNTRY,
    city: '',
    phone: '',
    password: '',
    confirm: '',
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
      fullName: `${values.firstName.trim()} ${values.lastName.trim()}`.trim(),
      phone: values.phone,
      password: values.password,
      email: values.email,
      gender: values.gender || undefined,
      country: values.country || undefined,
      city: values.city.trim() || undefined,
      interestLanguageId: values.interestLanguageId || undefined,
      acceptTerms: terms,
      confirmAge: terms,
    };
    const { data, errors: found } = validate(registerSchema, payload);
    // One checkbox covers both promises, so show a single message under it.
    const shown: FieldErrors = {
      ...found,
      ...(found.acceptTerms || found.confirmAge ? { terms: tr('termsError') } : {}),
      // The name is asked for in two boxes, but kept as one.
      ...(found.fullName
        ? {
            ...(values.firstName.trim() ? {} : { firstName: found.fullName }),
            ...(values.lastName.trim() ? {} : { lastName: found.fullName }),
            ...(values.firstName.trim() && values.lastName.trim()
              ? { firstName: found.fullName }
              : {}),
          }
        : {}),
      ...(values.confirm !== values.password ? { confirm: tr('passwordMismatch') } : {}),
    };
    setErrors(shown);
    if (!data || values.confirm !== values.password) return;

    setBusy(true);
    try {
      const result = await api<{ home: string }>('/auth/register', { method: 'POST', json: data });
      forgetSession();
      if (onDone) {
        onDone(result.home);
      } else {
        router.replace(next ?? result.home);
        router.refresh();
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === 'PHONE_ALREADY_REGISTERED') {
        setPhoneTaken(true);
        setErrors({ phone: tr('phoneTaken') });
      } else if (error instanceof ApiError && error.code === 'EMAIL_ALREADY_REGISTERED') {
        setPhoneTaken(true);
        setErrors({ email: tr('emailTaken') });
      } else {
        setErrors(apiFieldErrors(error));
        setFormError(errorMessage(error));
      }
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      data-wide
      className="flex flex-col gap-6"
      aria-label={embedded ? undefined : tr('title')}
    >
      {embedded ? null : (
        <header className="text-center">
          <h1 className="text-2xl font-bold md:text-[1.75rem]">{tr('title')}</h1>
          <p className="mt-1 text-muted">{tr('subtitle')}</p>
        </header>
      )}

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div className="grid gap-x-10 gap-y-6 md:grid-cols-2">
        <Group title={tr('personalInfo')}>
          <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <TextField
              label={t('firstName')}
              autoComplete="given-name"
              value={values.firstName}
              onChange={(e) => set('firstName')(e.target.value)}
              error={errors.firstName}
              autoFocus
            />
            <TextField
              label={t('lastName')}
              autoComplete="family-name"
              value={values.lastName}
              onChange={(e) => set('lastName')(e.target.value)}
              error={errors.lastName}
            />
          </div>
          <SelectField
            label={t('gender')}
            optional
            value={values.gender}
            onChange={(e) => set('gender')(e.target.value)}
            placeholder={t('chooseOne')}
            options={[
              { value: 'MALE', label: t('male') },
              { value: 'FEMALE', label: t('female') },
            ]}
            error={errors.gender}
          />
          <SelectField
            key={countries.length}
            label={t('country')}
            value={values.country}
            onChange={(e) => set('country')(e.target.value)}
            placeholder={t('chooseCountry')}
            options={countries}
            error={errors.country}
          />
          <TextField
            label={t('city')}
            optional
            autoComplete="address-level2"
            value={values.city}
            onChange={(e) => set('city')(e.target.value)}
            error={errors.city}
            maxLength={80}
          />
        </Group>

        <Group title={tr('accountInfo')}>
          <div className="flex flex-col gap-2">
            <PhoneField
              label={t('phone')}
              value={values.phone}
              onValueChange={set('phone')}
              error={errors.phone}
            />
            {phoneTaken ? (
              <div className="flex flex-wrap gap-2">
                {onSwitch ? (
                  <Button type="button" variant="secondary" size="sm" onClick={onSwitch}>
                    {tr('signInInstead')}
                  </Button>
                ) : (
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/sign-in">{tr('signInInstead')}</Link>
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link href="/forgot-password">{tr('resetInstead')}</Link>
                </Button>
              </div>
            ) : null}
          </div>
          <TextField
            label={t('email')}
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set('email')(e.target.value)}
            error={errors.email}
          />
          <PasswordField
            label={t('password')}
            autoComplete="new-password"
            hint={t('passwordHint')}
            value={values.password}
            onChange={(e) => set('password')(e.target.value)}
            error={errors.password}
          />
          <PasswordField
            label={t('confirmPassword')}
            autoComplete="new-password"
            value={values.confirm}
            onChange={(e) => set('confirm')(e.target.value)}
            error={errors.confirm}
          />
        </Group>
      </div>

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
        {onSwitch ? (
          <button
            type="button"
            onClick={onSwitch}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {tr('signIn')}
          </button>
        ) : (
          <Link
            href={next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in'}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {tr('signIn')}
          </Link>
        )}
      </p>
    </form>
  );
}
