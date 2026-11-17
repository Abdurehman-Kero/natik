'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { FormField } from './form-field';
import { Textarea } from './input';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  hideClose,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
  const t = useTranslations('common');
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50 data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[calc(100dvh-2rem)] w-auto max-w-md -translate-y-1/2 overflow-y-auto',
          'rounded-2xl bg-surface p-5 shadow-overlay data-[state=open]:animate-pop-in sm:p-6',
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose ? (
          <DialogPrimitive.Close
            className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
            aria-label={t('close')}
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title className={cn('pr-10 text-xl font-semibold', className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('mt-1.5 text-muted', className)} {...props} />;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line explaining the consequence. */
  description?: string;
  /** A verb, never "Yes": "Cancel enrolment", "Reject payment". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  /** Require a written reason (SRS: reject payment, cancel enrolment, cancel certificate). */
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
  children?: ReactNode;
}

/** Confirmation for important actions (FR-ADMIN-008). Stays open and busy until onConfirm finishes. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  requireReason = false,
  reasonLabel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const t = useTranslations('dialog');
  const tc = useTranslations('common');
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setReason('');
    setError(null);
    setBusy(false);
  };

  const submit = async () => {
    if (requireReason && !reason.trim()) {
      setError(t('reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await onConfirm(requireReason ? reason.trim() : undefined);
      reset();
      onOpenChange(false);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent role="alertdialog" {...(description ? {} : { 'aria-describedby': undefined })}>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        {children}
        {requireReason ? (
          <FormField
            id={reasonId}
            label={reasonLabel ?? t('reasonLabel')}
            error={error}
            className="mt-4"
          >
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              maxLength={500}
            />
          </FormField>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? tc('cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            onClick={submit}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
