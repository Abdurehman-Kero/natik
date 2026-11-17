'use client';

import { refreshCounts } from '@/lib/use-live-counts';
import { formatDate, formatMoney } from '@natik/shared';
import { Check, CircleAlert, FileImage, Phone, Plus, X } from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { CashPaymentDialog } from '@/components/admin/cash-payment-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { toast } from '@/components/ui/toast';
import { CreditCard } from 'lucide-react';
import { api, useErrorMessage } from '@/lib/api/client';
import type { AdminPayment } from '@/lib/api/learn-types';
import type { Paged } from '@/lib/api/types';
import { cn } from '@/lib/cn';

type Tab = 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

/** How long "Undo" stays available before a confirmation is really sent. */
const UNDO_MS = 5000;

/**
 * The payment queue: oldest first, the expected and entered amounts side by side, and one-tap
 * Confirm or Reject (FR-PAY-004…006). Confirming can be undone for 5 seconds.
 */
export function PaymentsQueue({ data, tab }: { data: Paged<AdminPayment>; tab: Tab }) {
  const t = useTranslations('adminPayments');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const pending = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; send: () => void }>(),
  );

  const unhide = (id: string) =>
    setHidden((set) => {
      const next = new Set(set);
      next.delete(id);
      return next;
    });

  // Leaving the page must not lose a confirmation that was waiting out its undo time.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const { timer, send } of waiting.values()) {
        clearTimeout(timer);
        send();
      }
      waiting.clear();
    };
  }, []);

  function confirm(payment: AdminPayment) {
    setHidden((set) => new Set(set).add(payment.id));
    const send = async () => {
      pending.current.delete(payment.id);
      try {
        await api(`/admin/payments/${payment.id}/confirm`, { method: 'POST' });
        router.refresh();
        refreshCounts();
      } catch (error) {
        unhide(payment.id);
        toast.error(errorMessage(error));
        router.refresh();
        refreshCounts();
      }
    };
    const timer = setTimeout(send, UNDO_MS);
    pending.current.set(payment.id, { timer, send });
    toast(t('confirmedToast'), {
      duration: UNDO_MS,
      action: {
        label: t('undo'),
        onClick: () => {
          const entry = pending.current.get(payment.id);
          if (entry) clearTimeout(entry.timer);
          pending.current.delete(payment.id);
          unhide(payment.id);
        },
      },
    });
  }

  async function reject(reason?: string) {
    if (!rejecting) return;
    try {
      await api(`/admin/payments/${rejecting.id}/reject`, { method: 'POST', json: { reason } });
      toast.success(t('rejectedToast'));
      router.refresh();
      refreshCounts();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  const items = data.items.filter((p) => !hidden.has(p.id));
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hrefFor = (page: number) => `/admin/payments?status=${tab}&page=${page}`;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={tab === 'SUBMITTED' ? t('subtitle') : undefined}
        action={
          <Button onClick={() => setCashOpen(true)}>
            <Plus aria-hidden /> {t('recordCash')}
          </Button>
        }
      />

      <nav
        aria-label={t('title')}
        className="flex [scrollbar-width:none] gap-1 overflow-x-auto border-b border-border [&::-webkit-scrollbar]:hidden"
      >
        {(
          [
            ['SUBMITTED', t('toCheck')],
            ['CONFIRMED', t('confirmedTab')],
            ['REJECTED', t('rejectedTab')],
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/admin/payments?status=${value}`}
            aria-current={value === tab ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 shrink-0 items-center px-3 font-semibold whitespace-nowrap transition-colors hover:text-primary',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full',
              value === tab ? 'text-primary after:bg-accent' : 'text-muted after:bg-transparent',
            )}
          >
            {label}
            {value === tab ? ` (${data.total})` : ''}
          </Link>
        ))}
      </nav>

      <div className="pt-5">
        {items.length === 0 ? (
          <Card>
            <EmptyState
              icon={CreditCard}
              title={tab === 'SUBMITTED' ? t('emptyTitle') : t('emptyOther')}
              description={tab === 'SUBMITTED' ? t('emptyText') : undefined}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {p.student.fullName}{' '}
                          <span className="font-normal text-muted">· {p.course.title}</span>
                          {p.kind === 'RENEWAL' ? (
                            <span className="ml-2 rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-muted">
                              {t('renewal')}
                            </span>
                          ) : null}
                        </p>
                        {p.student.phone ? (
                          <a
                            href={`tel:${p.student.phone}`}
                            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline"
                            dir="ltr"
                          >
                            <Phone className="size-4" aria-hidden /> {p.student.phone}
                          </a>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted">{formatDate(p.submittedAt)}</p>
                    </div>

                    <p className="text-sm text-muted">
                      {p.reference ? t('reference', { ref: p.reference }) : t('noReference')} ·{' '}
                      {t('paidOn', { date: formatDate(p.paidOn) })}
                    </p>

                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span>{t('expected', { amount: formatMoney(p.expectedSantim) })}</span>
                      <span>{t('entered', { amount: formatMoney(p.amountSantim) })}</span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-semibold',
                          p.matches ? 'text-success' : 'text-warning',
                        )}
                      >
                        {p.matches ? (
                          <Check className="size-4" aria-hidden />
                        ) : (
                          <CircleAlert className="size-4" aria-hidden />
                        )}
                        {p.matches ? t('matches') : t('differs')}
                      </span>
                    </p>

                    {p.status === 'REJECTED' && p.rejectionReason ? (
                      <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                        {t('reason', { reason: p.rejectionReason })}
                      </p>
                    ) : null}
                    {p.status !== 'SUBMITTED' && p.checkedBy ? (
                      <p className="text-sm text-muted">{t('checkedBy', { name: p.checkedBy })}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {p.receiptUrl ? (
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline"
                        >
                          <FileImage className="size-5" aria-hidden /> {t('receipt')}
                        </a>
                      ) : (
                        <span className="text-sm text-muted">{t('noReceipt')}</span>
                      )}
                      {p.status === 'SUBMITTED' ? (
                        <div className="flex gap-3">
                          <Button variant="secondary" onClick={() => setRejecting(p)}>
                            <X aria-hidden /> {t('reject')}
                          </Button>
                          <Button onClick={() => confirm(p)}>
                            <Check aria-hidden /> {t('confirm')}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Pagination className="mt-6" page={data.page} totalPages={totalPages} hrefFor={hrefFor} />

      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={t('rejectTitle')}
        description={t('rejectText')}
        confirmLabel={t('rejectConfirm')}
        tone="danger"
        requireReason
        reasonLabel={t('rejectReason')}
        onConfirm={reject}
      />
      <CashPaymentDialog open={cashOpen} onOpenChange={setCashOpen} />
    </>
  );
}
