'use client';

import { formatMoney, paymentSubmitSchema } from '@natik/shared';
import { Camera, Check, Copy, FileText, Landmark, Smartphone, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton, LinkButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FormField, useFormField } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { RadioCards } from '@/components/ui/radio-cards';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { PaymentInfo } from '@/lib/api/learn-types';
import { compressImage } from '@/lib/compress-image';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

/** One account with a Copy button, so nobody has to retype a long number. */
function AccountRow({ account }: { account: PaymentInfo['accounts'][number] }) {
  const t = useTranslations('pay');
  const [copied, setCopied] = useState(false);
  const Icon = account.type === 'BANK' ? Landmark : Smartphone;

  async function copy() {
    try {
      await navigator.clipboard.writeText(account.accountNumber.replace(/\s+/g, ''));
      setCopied(true);
      toast.success(t('copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block copying; the number is still on screen to type.
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">
          {account.provider} · {account.accountName}
        </p>
        <p className="font-semibold tracking-wide text-ink tabular-nums" dir="ltr">
          {account.accountNumber}
        </p>
        {account.note ? <p className="text-sm text-muted">{account.note}</p> : null}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={copy}
        aria-label={t('copyNumber', { provider: account.provider })}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? t('copied') : t('copy')}
      </Button>
    </li>
  );
}

/** Photo or PDF of the receipt. Opens the phone camera or gallery. */
function ReceiptPicker({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const t = useTranslations('pay');
  const field = useFormField();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        id={field?.id}
        aria-describedby={field?.describedBy}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface py-1 pr-1 pl-4">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <IconButton
            label={t('removeReceipt')}
            onClick={() => {
              onChange(null);
              if (input.current) input.current.value = '';
            }}
          >
            <X />
          </IconButton>
        </div>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        onClick={() => input.current?.click()}
        className="self-start"
      >
        <Camera aria-hidden /> {file ? t('changeReceipt') : t('addReceipt')}
      </Button>
    </div>
  );
}

/** The payment screen: where to pay, then a short form to tell us about it (FR-PAY-001/002). */
export function PayForm({ info, today }: { info: PaymentInfo; today: string }) {
  const t = useTranslations('pay');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const price = info.course.priceSantim ?? 0;

  const [method, setMethod] = useState<'BANK' | 'MOBILE_WALLET'>(
    info.accounts.some((a) => a.type === 'MOBILE_WALLET') &&
      !info.accounts.some((a) => a.type === 'BANK')
      ? 'MOBILE_WALLET'
      : 'BANK',
  );
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState(String(price / 100));
  const [paidOn, setPaidOn] = useState(today);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(paymentSubmitSchema, {
      method,
      reference,
      amount,
      paidOn,
    });
    setErrors(found);
    if (!data) return;

    setBusy(true);
    try {
      const body = new FormData();
      body.set('method', method);
      body.set('reference', reference.trim());
      body.set('amount', amount);
      body.set('paidOn', paidOn);
      if (receipt) body.set('receipt', await compressImage(receipt));
      await api(`/enrolments/${info.enrolment.id}/payments`, { method: 'POST', body });
      toast.success(t('submitted'));
      // The page now shows "Payment under review".
      router.refresh();
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      {info.lastRejection ? (
        <Alert tone="danger">
          <p className="font-semibold">{t('rejectedTitle')}</p>
          <p>
            {info.lastRejection.rejectionReason
              ? t('rejectedReason', { reason: info.lastRejection.rejectionReason })
              : t('rejectedText')}
          </p>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <span className="text-muted">{t('amount')}</span>
          <span className="font-heading text-2xl font-bold text-primary">{formatMoney(price)}</span>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="pay-step-1">
        <h2 id="pay-step-1" className="text-lg font-semibold">
          <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-primary text-sm text-white">
            1
          </span>
          {t('stepPay')}
        </h2>
        {info.accounts.length > 0 ? (
          <Card>
            <ul className="divide-y divide-border">
              {info.accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </ul>
          </Card>
        ) : (
          <Alert tone="warning">
            {t('noAccounts')}{' '}
            <a href="/contact" className="font-semibold underline">
              {t('contactUs')}
            </a>
          </Alert>
        )}
        <p className="text-sm text-muted">{t('cash')}</p>
      </section>

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold">
          <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-primary text-sm text-white">
            2
          </span>
          {t('stepTell')}
        </h2>

        {formError && Object.keys(errors).length === 0 ? (
          <Alert tone="danger">{formError}</Alert>
        ) : null}

        <RadioCards
          label={t('method')}
          value={method}
          onValueChange={(v) => setMethod(v as 'BANK' | 'MOBILE_WALLET')}
          options={[
            { value: 'BANK', label: t('bank'), icon: Landmark },
            { value: 'MOBILE_WALLET', label: t('wallet'), icon: Smartphone },
          ]}
          error={errors.method}
        />
        <TextField
          label={t('reference')}
          hint={t('referenceHint')}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          error={errors.reference}
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={60}
        />
        <TextField
          label={t('amountPaid')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          inputMode="decimal"
          autoComplete="off"
        />
        <TextField
          label={t('paidOn')}
          type="date"
          value={paidOn}
          max={today}
          onChange={(e) => setPaidOn(e.target.value)}
          error={errors.paidOn}
        />

        <FormField label={t('receipt')} hint={t('receiptHint')} optional error={errors.receipt}>
          <ReceiptPicker file={receipt} onChange={setReceipt} />
        </FormField>

        <Button type="submit" size="lg" fullWidth loading={busy} disabled={!info.canSubmit}>
          {t('submit')}
        </Button>
        <p className="text-center text-sm text-muted">{t('noSecrets')}</p>
        <LinkButton href={`/courses/${info.course.slug}`} variant="ghost" fullWidth>
          {tc('cancel')}
        </LinkButton>
      </form>
    </div>
  );
}
