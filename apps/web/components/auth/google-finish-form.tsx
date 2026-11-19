'use client';

import { googleCompleteSchema } from '@natik/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/input';
import { PhoneField } from '@/components/ui/phone-field';
import { SelectField } from '@/components/ui/select';
import Link from '@/components/ui/link';
import { api, useErrorMessage } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { DEFAULT_COUNTRY } from '@/lib/countries';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';
import { useCountryOptions } from '@/lib/use-country-options';
import { forgetSession } from '@/lib/use-session';

interface Pending {
  name: string;
  email: string;
  next: string | null;
}

/**
 * The last step of "Continue with Google" for someone new: Google already gave the name and the verified
 * email, so only the promises (terms, age) and the optional details are asked here.
 */
export function GoogleFinishForm() {
  const t = useTranslations('auth');
  const tg = useTranslations('auth.google');
  const tr = useTranslations('auth.register');
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const countries = useCountryOptions(locale, DEFAULT_COUNTRY);

  const [pending, setPending] = useState<Pending | null>(null);
  const [expired, setExpired] = useState(false);
  const [values, setValues] = useState({
    fullName: '',
    gender: '',
    country: DEFAULT_COUNTRY,
    city: '',
    phone: '',
  });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  // The browser holds a cookie only the Google routes can see, so the name comes from there, not the page.
  useEffect(() => {
    let alive = true;
    api<Pending>('/auth/google/pending', { quiet: true })
      .then((found) => {
        if (!alive) return;
        setPending(found);
        setValues((current) => ({ ...current, fullName: found.name }));
      })
      .catch(() => alive && setExpired(true));
    return () => {
      alive = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(googleCompleteSchema, {
      fullName: values.fullName,
      phone: values.phone,
      gender: values.gender || undefined,
      country: values.country || undefined,
      city: values.city.trim() || undefined,
      acceptTerms: terms,
      confirmAge: terms,
    });
    setErrors({
      ...found,
      ...(found.acceptTerms || found.confirmAge ? { terms: tr('termsError') } : {}),
    });
    if (!data) return;

    setBusy(true);
    try {
      const result = await api<{ home: string }>('/auth/google/complete', {
        method: 'POST',
        json: data,
      });
      forgetSession();
      router.replace(result.home);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'GOOGLE_SIGN_UP_EXPIRED') {
        setExpired(true);
      } else if (error instanceof ApiError && error.code === 'PHONE_ALREADY_REGISTERED') {
        setErrors({ phone: tr('phoneTaken') });
      } else {
        setErrors(apiFieldErrors(error));
        setFormError(errorMessage(error));
      }
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <div className="flex flex-col gap-5 text-center">
        <Alert tone="warning">{tg('expired')}</Alert>
        <Button asChild size="lg" fullWidth>
          <Link href="/sign-in">{tg('startAgain')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5"
      aria-label={tg('finishTitle')}
    >
      <header className="text-center">
        <h1 className="text-2xl font-bold md:text-[1.75rem]">{tg('finishTitle')}</h1>
        <p className="mt-1 text-muted">{tg('finishText')}</p>
      </header>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <TextField
        label={t('email')}
        type="email"
        value={pending?.email ?? ''}
        readOnly
        disabled={!pending}
        hint={tg('emailFromGoogle')}
      />
      <TextField
        label={t('fullName')}
        autoComplete="name"
        value={values.fullName}
        onChange={(e) => set('fullName')(e.target.value)}
        error={errors.fullName}
        disabled={!pending}
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
      <PhoneField
        label={t('phone')}
        optional
        value={values.phone}
        onValueChange={set('phone')}
        error={errors.phone}
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

      <Button type="submit" size="lg" fullWidth loading={busy} disabled={!pending}>
        {tr('cta')}
      </Button>
    </form>
  );
}
