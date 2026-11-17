'use client';

import { CERTIFICATE_NUMBER, formatDate } from '@natik/shared';
import { Award, CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/input';
import { KeyValue } from '@/components/ui/key-value';
import { api } from '@/lib/api/client';

type Result =
  | { kind: 'valid'; studentName: string; courseTitle: string; issuedAt: string; number: string }
  | { kind: 'cancelled' }
  | { kind: 'notFound' };

/** Enter a certificate number; shows only name, course and date for a valid one (FR-CERT-004). */
export function VerifyForm({ initialNumber = '' }: { initialNumber?: string }) {
  const t = useTranslations('verify');
  const [number, setNumber] = useState(initialNumber);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(raw: string) {
    const value = raw.trim().toUpperCase();
    if (!CERTIFICATE_NUMBER.test(value)) {
      setResult({ kind: 'notFound' });
      return;
    }
    setBusy(true);
    try {
      const data = await api<{
        status: 'VALID' | 'CANCELLED';
        number: string;
        studentName?: string;
        courseTitle?: string;
        issuedAt?: string;
      }>(`/public/certificates/${encodeURIComponent(value)}`);
      setResult(
        data.status === 'VALID'
          ? {
              kind: 'valid',
              number: data.number,
              studentName: data.studentName ?? '',
              courseTitle: data.courseTitle ?? '',
              issuedAt: data.issuedAt ?? '',
            }
          : { kind: 'cancelled' },
      );
    } catch {
      // Unknown numbers (404) and too many tries both end here; the message is the same and kind.
      setResult({ kind: 'notFound' });
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void check(number);
  }

  // A scanned QR code arrives with the number already filled in: check it straight away.
  useEffect(() => {
    if (!initialNumber) return;
    const id = setTimeout(() => void check(initialNumber), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 md:p-6">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <TextField
            label={t('label')}
            hint={t('hint')}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="NLC-2026-00042"
          />
          <Button type="submit" size="lg" fullWidth loading={busy}>
            {t('cta')}
          </Button>
        </form>
      </Card>

      <div aria-live="polite">
        {result?.kind === 'valid' ? (
          <Card className="flex flex-col gap-4 border-accent p-5 md:p-6">
            <div className="flex items-center gap-3">
              <span
                className="flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong"
                aria-hidden
              >
                <Award className="size-6" />
              </span>
              <h2 className="text-xl font-semibold">{t('valid')}</h2>
            </div>
            <KeyValue
              items={[
                { label: t('name'), value: result.studentName },
                { label: t('course'), value: result.courseTitle },
                { label: t('date'), value: formatDate(result.issuedAt) },
              ]}
            />
          </Card>
        ) : null}
        {result?.kind === 'cancelled' || result?.kind === 'notFound' ? (
          <Card
            className="flex items-start gap-3 border-danger/40 bg-danger-soft p-5 text-danger"
            role="alert"
          >
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="font-medium">
              {result.kind === 'cancelled' ? t('cancelled') : t('notFound')}
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
