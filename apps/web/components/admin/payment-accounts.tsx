'use client';

import { paymentAccountInputSchema } from '@natik/shared';
import { ArrowDown, ArrowUp, Landmark, Pencil, Plus, Smartphone, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { RadioCards } from '@/components/ui/radio-cards';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { PaymentAccountView } from '@/lib/api/learn-types';
import { apiFieldErrors, type FieldErrors, validate } from '@/lib/forms';

/** The bank and wallet accounts students pay into, in the order they see them (FR-PAY-001). */
export function PaymentAccountsManager({ initial }: { initial: PaymentAccountView[] }) {
  const t = useTranslations('paymentAccounts');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<PaymentAccountView | 'new' | null>(null);
  const [removing, setRemoving] = useState<PaymentAccountView | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    setBusy(true);
    try {
      await api('/admin/payment-accounts/order', {
        method: 'PUT',
        json: { ids: next.map((a) => a.id) },
      });
      router.refresh();
    } catch (error) {
      setItems(previous);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing) return;
    try {
      await api(`/admin/payment-accounts/${removing.id}`, { method: 'DELETE' });
      setItems((list) => list.filter((a) => a.id !== removing.id));
      toast.success(t('removed'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  function saved(account: PaymentAccountView) {
    setItems((list) =>
      list.some((a) => a.id === account.id)
        ? list.map((a) => (a.id === account.id ? account : a))
        : [...list, account],
    );
    setEditing(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={{ href: '/admin/settings', label: t('settings') }}
        action={
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden /> {t('add')}
          </Button>
        }
      />

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title={t('emptyTitle')}
            description={t('emptyText')}
            action={
              <Button size="lg" onClick={() => setEditing('new')}>
                <Plus aria-hidden /> {t('add')}
              </Button>
            }
          />
        </Card>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {items.map((account, index) => {
            const Icon = account.type === 'BANK' ? Landmark : Smartphone;
            return (
              <li key={account.id}>
                <Card>
                  <CardContent className="flex items-center gap-2 sm:gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
                      aria-hidden
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {account.provider}
                        {!account.active ? (
                          <span className="ml-2 rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">
                            {t('hidden')}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-muted" dir="ltr">
                        {account.accountName} · {account.accountNumber}
                      </p>
                    </div>
                    <IconButton
                      label={t('moveUp', { name: account.provider })}
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp />
                    </IconButton>
                    <IconButton
                      label={t('moveDown', { name: account.provider })}
                      disabled={busy || index === items.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown />
                    </IconButton>
                    <IconButton
                      label={t('edit', { name: account.provider })}
                      onClick={() => setEditing(account)}
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton
                      label={t('remove', { name: account.provider })}
                      onClick={() => setRemoving(account)}
                    >
                      <Trash2 />
                    </IconButton>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <AccountDialog
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={saved}
        key={editing === null ? 'closed' : editing === 'new' ? 'new' : editing.id}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('removeTitle')}
        description={t('removeText')}
        confirmLabel={t('removeConfirm')}
        tone="danger"
        onConfirm={remove}
      />
    </>
  );
}

function AccountDialog({
  target,
  onClose,
  onSaved,
}: {
  target: PaymentAccountView | 'new' | null;
  onClose: () => void;
  onSaved: (account: PaymentAccountView) => void;
}) {
  const t = useTranslations('paymentAccounts');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const existing = target && target !== 'new' ? target : null;
  const [type, setType] = useState<'BANK' | 'MOBILE_WALLET'>(existing?.type ?? 'BANK');
  const [provider, setProvider] = useState(existing?.provider ?? '');
  const [accountName, setAccountName] = useState(existing?.accountName ?? 'Natik Language Centre');
  const [accountNumber, setAccountNumber] = useState(existing?.accountNumber ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [active, setActive] = useState(existing?.active ?? true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const { data, errors: found } = validate(paymentAccountInputSchema, {
      type,
      provider,
      accountName,
      accountNumber,
      note,
      active,
    });
    setErrors(found);
    if (!data) return;
    setBusy(true);
    try {
      const saved = await api<PaymentAccountView>(
        existing ? `/admin/payment-accounts/${existing.id}` : '/admin/payment-accounts',
        { method: existing ? 'PUT' : 'POST', json: data },
      );
      toast.success(t('saved'));
      onSaved(saved);
    } catch (error) {
      setErrors(apiFieldErrors(error));
      setFormError(errorMessage(error));
      setBusy(false);
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{existing ? t('editTitle') : t('addTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('subtitle')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
          {formError && Object.keys(errors).length === 0 ? (
            <Alert tone="danger">{formError}</Alert>
          ) : null}
          <RadioCards
            label={t('type')}
            value={type}
            onValueChange={(v) => setType(v as 'BANK' | 'MOBILE_WALLET')}
            options={[
              { value: 'BANK', label: t('bank'), icon: Landmark },
              { value: 'MOBILE_WALLET', label: t('wallet'), icon: Smartphone },
            ]}
          />
          <TextField
            label={t('provider')}
            hint={t('providerHint')}
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            error={errors.provider}
            autoComplete="off"
          />
          <TextField
            label={t('accountName')}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            error={errors.accountName}
            autoComplete="off"
          />
          <TextField
            label={t('accountNumber')}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            error={errors.accountNumber}
            inputMode="numeric"
            autoComplete="off"
          />
          <TextField
            label={t('note')}
            hint={t('noteHint')}
            optional
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={errors.note}
            autoComplete="off"
          />
          <Switch label={t('active')} checked={active} onCheckedChange={setActive} />
          <FormActions>
            <Button type="submit" loading={busy}>
              {t('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {tc('cancel')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
