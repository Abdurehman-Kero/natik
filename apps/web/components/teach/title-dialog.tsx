'use client';

import { unitInputSchema } from '@natik/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextField } from '@/components/ui/input';
import { useErrorMessage } from '@/lib/api/client';
import { apiFieldErrors, validate } from '@/lib/forms';

export interface TitleDialogProps {
  title: string;
  label: string;
  initial?: string;
  submitLabel: string;
  onSubmit: (title: string) => Promise<void>;
  onClose: () => void;
}

/** A tiny dialog asking for one title: new unit, rename unit, new lesson. Mount it to open it. */
export function TitleDialog({
  title,
  label,
  initial = '',
  submitLabel,
  onSubmit,
  onClose,
}: TitleDialogProps) {
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data, errors } = validate(unitInputSchema, { title: value });
    if (!data) {
      setError(errors.title);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(data.title);
      onClose();
    } catch (e) {
      setError(apiFieldErrors(e).title ?? errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{label}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-5">
          <TextField
            label={label}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={error}
            maxLength={120}
            autoComplete="off"
            autoFocus
          />
          <FormActions>
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                {tc('cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy}>
              {submitLabel}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
