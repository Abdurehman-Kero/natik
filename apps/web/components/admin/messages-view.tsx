'use client';

import { formatDateTime } from '@natik/shared';
import { Inbox, Phone, RotateCcw } from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/cn';
import { refreshCounts } from '@/lib/use-live-counts';

export interface InboxItem {
  id: string;
  type: 'CONTACT' | 'PROBLEM_REPORT';
  name: string;
  phone: string | null;
  message: string;
  status: 'NEW' | 'CLOSED';
  lesson: { id: string; title: string } | null;
  createdAt: string;
  closedAt: string | null;
  closedBy: string | null;
}

export interface InboxData {
  items: InboxItem[];
  total: number;
  page: number;
  pageSize: number;
  newCount: number;
}

const hrefFor = (status: string, page: number) => {
  const params = new URLSearchParams();
  params.set('status', status);
  if (page > 1) params.set('page', String(page));
  return `/admin/messages?${params}`;
};

/** Contact messages and problem reports: read them, then close them (FR-ADMIN-007). */
export function MessagesView({
  data,
  status,
  page,
}: {
  data: InboxData;
  status: 'NEW' | 'CLOSED';
  page: number;
}) {
  const t = useTranslations('messages');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Showing the messages counts as seeing them: the number on the menu goes down.
  useEffect(() => {
    const ids = data.items.map((m) => m.id);
    if (ids.length === 0) return;
    // The open messages tab shows all of them at once, so none is left counting as unread.
    const body = status === 'NEW' ? { all: true } : { ids };
    void api('/admin/messages/seen', { method: 'POST', json: body, quiet: true })
      .then(refreshCounts)
      .catch(() => undefined);
  }, [data.items, status]);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  async function change(item: InboxItem, action: 'close' | 'reopen') {
    setBusyId(item.id);
    try {
      await api(`/admin/messages/${item.id}/${action}`, { method: 'POST' });
      toast.success(action === 'close' ? t('closedToast') : t('reopenedToast'));
      router.refresh();
      refreshCounts();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title={t('title')} />
      <nav aria-label={t('filter')} className="mb-5 flex gap-2">
        {(['NEW', 'CLOSED'] as const).map((value) => (
          <Link
            key={value}
            href={hrefFor(value, 1)}
            aria-current={status === value ? 'page' : undefined}
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold',
              status === value
                ? 'border-primary bg-primary text-white'
                : 'border-border-strong bg-surface text-primary hover:bg-primary-soft',
            )}
          >
            {value === 'NEW' ? t('new') : t('closed')}
            {value === 'NEW' && data.newCount > 0 ? (
              <span
                className={cn(
                  'rounded-full px-2 text-sm',
                  status === 'NEW' ? 'bg-white text-primary' : 'bg-accent text-ink',
                )}
              >
                {data.newCount}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={status === 'NEW' ? t('emptyNew') : t('emptyClosed')}
            description={status === 'NEW' ? t('emptyNewText') : undefined}
          />
        </Card>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {data.items.map((item) => (
            <li key={item.id}>
              <Card className="flex flex-col gap-3 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {item.name}
                      {item.type === 'PROBLEM_REPORT' ? (
                        <Badge tone="warning">{t('problem')}</Badge>
                      ) : null}
                    </p>
                    {item.phone ? (
                      <a
                        href={`tel:${item.phone.replace(/\s/g, '')}`}
                        className="inline-flex min-h-11 items-center gap-1.5 text-primary hover:underline"
                      >
                        <Phone className="size-4" aria-hidden />
                        {item.phone}
                      </a>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted">{formatDateTime(item.createdAt)}</p>
                </div>
                {item.lesson ? (
                  <p className="text-sm text-muted">
                    {t('aboutLesson', { title: item.lesson.title })}
                  </p>
                ) : null}
                <p className="break-words whitespace-pre-wrap text-ink/90">{item.message}</p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {item.status === 'CLOSED' ? (
                    <p className="text-sm text-muted">
                      {t('closedBy', {
                        name: item.closedBy ?? '—',
                        date: item.closedAt ? formatDateTime(item.closedAt) : '—',
                      })}
                    </p>
                  ) : (
                    <span />
                  )}
                  {item.status === 'NEW' ? (
                    <Button
                      size="sm"
                      loading={busyId === item.id}
                      onClick={() => change(item, 'close')}
                    >
                      {t('close')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busyId === item.id}
                      onClick={() => change(item, 'reopen')}
                    >
                      <RotateCcw aria-hidden /> {t('reopen')}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        className="mt-6"
        page={page}
        totalPages={totalPages}
        hrefFor={(p) => hrefFor(status, p)}
      />
    </>
  );
}
