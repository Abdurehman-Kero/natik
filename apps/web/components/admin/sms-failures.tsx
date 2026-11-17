'use client';

import { formatDate } from '@natik/shared';
import { MessageSquareText, RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { humanize } from '@/components/admin/activity-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/layout';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { SmsList } from '@/lib/api/ops-types';

/** Text messages that could not be sent, with a Retry button (FR-NOTIF-004). Numbers are masked. */
export function SmsFailures({ data }: { data: SmsList }) {
  const t = useTranslations('smsAdmin');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function retry(id: string) {
    setBusy(id);
    try {
      await api(`/admin/sms/${id}/retry`, { method: 'POST' });
      toast.success(t('retried'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        back={{ href: '/admin/settings', label: t('back') }}
      />
      {data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquareText}
            title={t('emptyTitle')}
            description={t('emptyText')}
          />
        </Card>
      ) : (
        <ul className="flex max-w-3xl flex-col gap-3">
          {data.items.map((m) => (
            <li key={m.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold" dir="ltr">
                      {m.to}
                    </p>
                    <p className="text-sm text-muted">
                      {t('template', { name: humanize(m.template) })} ·{' '}
                      {t('attempts', { count: m.attempts })} · {formatDate(m.createdAt)}
                    </p>
                    {m.lastError ? (
                      <p className="mt-1 rounded-lg bg-danger-soft px-3 py-1.5 text-sm text-danger">
                        {t('error', { error: m.lastError })}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    loading={busy === m.id}
                    onClick={() => void retry(m.id)}
                  >
                    <RotateCw aria-hidden /> {t('retry')}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
