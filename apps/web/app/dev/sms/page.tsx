import { Inbox } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LinkButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { apiFetch } from '@/lib/api/server';
import { formatDateTime } from '@natik/shared';
import { appEnv } from '@/lib/site-config';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Development SMS inbox', robots: { index: false } };

interface Item {
  id: string;
  to: string;
  body: string;
  status: string;
  createdAt: string;
}

/** The "phone" for local development: shows the SMS codes and links the platform would send. */
export default async function DevSmsPage() {
  if (appEnv() !== 'local') notFound();
  const t = await getTranslations('devSms');
  const { items } = await apiFetch<{ items: Item[] }>('/dev/sms');

  return (
    <Container size="reading" className="py-8 md:py-12">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.625rem] font-bold md:text-4xl">{t('title')}</h1>
          <p className="text-muted">{t('text')}</p>
        </div>
        <LinkButton href="/dev/sms" variant="secondary" size="sm">
          {t('refresh')}
        </LinkButton>
      </div>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title={t('empty')} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="flex flex-col gap-1 p-4">
                <p className="text-sm text-muted">
                  {item.to} · {formatDateTime(item.createdAt)} · {item.status}
                </p>
                <p className="break-words text-ink">{item.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
