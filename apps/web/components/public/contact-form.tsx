'use client';

import { contactSchema } from '@natik/shared';
import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextareaField, TextField } from '@/components/ui/input';
import { PhoneField } from '@/components/ui/phone-field';
import { api, useErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

/** Name, phone and message. Messages land in the admin inbox (FR-WEB-004). */
export function ContactForm({
  embedded = false,
  onSent,
}: {
  embedded?: boolean;
  onSent?: () => void;
}) {
  const t = useTranslations('contact');
  const ta = useTranslations('auth');
  const errorMessage = useErrorMessage();
  // When the form was opened: forms "sent" instantly are bots.
  const openedAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  const [values, setValues] = useState({ name: '', phone: '', message: '', website: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof values) => (value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const payload = { ...values, openedAt: openedAt.current };
    const { data, errors: found } = validate(contactSchema, payload);
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      await api('/public/contact', { method: 'POST', json: data });
      setSent(true);
      onSent?.();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Card
        className={cn(
          'flex flex-col items-center gap-3 p-8 text-center',
          embedded && 'border-0 p-2 shadow-none',
        )}
        role="status"
      >
        <span
          className="flex size-14 items-center justify-center rounded-full bg-success-soft text-success"
          aria-hidden
        >
          <CircleCheck className="size-7" />
        </span>
        <h2 className="text-2xl font-semibold">{t('sentTitle')}</h2>
        <p className="text-muted">{t('sentText')}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setValues({ name: '', phone: '', message: '', website: '' });
            openedAt.current = Date.now();
            setSent(false);
          }}
        >
          {t('sendAnother')}
        </Button>
      </Card>
    );
  }

  return (
    <Card className={cn('rounded-2xl p-6 md:p-8', embedded && 'border-0 p-0 shadow-none md:p-0')}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {embedded ? null : <h2 className="text-xl font-semibold">{t('formTitle')}</h2>}
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <TextField
          label={t('name')}
          autoComplete="name"
          value={values.name}
          onChange={(e) => set('name')(e.target.value)}
          error={errors.name}
        />
        <PhoneField
          label={ta('phone')}
          value={values.phone}
          onValueChange={set('phone')}
          error={errors.phone}
        />
        <TextareaField
          label={t('message')}
          hint={t('messageHint')}
          rows={5}
          maxLength={1000}
          value={values.message}
          onChange={(e) => set('message')(e.target.value)}
          error={errors.message}
        />
        {/* Trap for bots: invisible and skipped by keyboards and screen readers. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(e) => set('website')(e.target.value)}
            />
          </label>
        </div>
        <Button type="submit" size="lg" fullWidth loading={busy}>
          {t('send')}
        </Button>
      </form>
    </Card>
  );
}
