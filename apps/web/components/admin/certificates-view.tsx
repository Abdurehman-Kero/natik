'use client';

import { formatDate } from '@natik/shared';
import { Award, Ban, ExternalLink, Search } from 'lucide-react';
import Link from '@/components/ui/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { AdminCertificate } from '@/lib/api/quiz-types';
import type { Paged } from '@/lib/api/types';
import { cn } from '@/lib/cn';

/** Every certificate issued: search, open the PDF, and cancel with a reason (FR-CERT-005). */
export function CertificatesView({
  data,
  query,
}: {
  data: Paged<AdminCertificate>;
  query: { q: string; status: string };
}) {
  const t = useTranslations('adminCerts');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [q, setQ] = useState(query.q);
  const [cancelling, setCancelling] = useState<AdminCertificate | null>(null);

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  async function cancel(reason?: string) {
    if (!cancelling) return;
    try {
      await api(`/admin/certificates/${cancelling.id}/cancel`, {
        method: 'POST',
        json: { reason },
      });
      toast.success(t('cancelledToast'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hrefFor = (page: number) => {
    const next = new URLSearchParams(search.toString());
    next.set('page', String(page));
    return `${pathname}?${next}`;
  };
  const tabs = [
    ['', t('all')],
    ['VALID', t('valid')],
    ['CANCELLED', t('cancelledTab')],
  ] as const;

  return (
    <>
      <form
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go({ q: q.trim() });
        }}
        className="mb-4 flex gap-3"
      >
        <Input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="secondary" aria-label={t('search')}>
          <Search aria-hidden />
        </Button>
      </form>

      <nav aria-label={t('issuedFilter')} className="mb-5 flex gap-1 border-b border-border">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => go({ status: value })}
            aria-current={value === query.status ? 'page' : undefined}
            className={cn(
              'relative flex min-h-11 items-center px-3 font-semibold transition-colors hover:text-primary',
              'after:absolute after:inset-x-2 after:-bottom-px after:h-[3px] after:rounded-full',
              value === query.status
                ? 'text-primary after:bg-accent'
                : 'text-muted after:bg-transparent',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={Award} title={t('emptyTitle')} description={t('emptyText')} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((c) => (
            <li key={c.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {c.studentName}{' '}
                      <span className="font-normal text-muted">· {c.courseTitle}</span>
                    </p>
                    <p className="text-sm text-muted">
                      <span className="font-semibold text-primary" dir="ltr">
                        {c.number}
                      </span>{' '}
                      · {t('issued', { date: formatDate(c.issuedAt) })}
                      {c.studentPhone ? ` · ${c.studentPhone}` : ''}
                    </p>
                    {c.status === 'CANCELLED' && c.cancelReason ? (
                      <p className="mt-1 rounded-lg bg-danger-soft px-3 py-1.5 text-sm text-danger">
                        {t('reasonShown', { reason: c.cancelReason })}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={`/api/v1/admin/certificates/${c.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary hover:underline"
                    >
                      <ExternalLink className="size-4" aria-hidden /> {t('view')}
                    </a>
                    {c.status === 'VALID' ? (
                      <Button variant="secondary" size="sm" onClick={() => setCancelling(c)}>
                        <Ban aria-hidden /> {t('cancel')}
                      </Button>
                    ) : (
                      <Link
                        href={`/verify?n=${c.number}`}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-danger"
                      >
                        {t('cancelledTab')}
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination className="mt-6" page={data.page} totalPages={totalPages} hrefFor={hrefFor} />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title={t('cancelTitle')}
        description={t('cancelText')}
        confirmLabel={t('cancelConfirm')}
        tone="danger"
        requireReason
        reasonLabel={t('cancelReason')}
        onConfirm={cancel}
      />
    </>
  );
}
