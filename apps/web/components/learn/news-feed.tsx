'use client';

import { formatDate } from '@natik/shared';
import { CheckCheck, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { NewsItem } from '@/lib/api/learn-types';
import { cn } from '@/lib/cn';

/** The student's announcements. New ones have a gold dot until they are marked as read (FR-NOTIF-002). */
export function NewsFeed({ initial }: { initial: NewsItem[] }) {
  const t = useTranslations('studentNews');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const unread = items.filter((i) => !i.read).length;

  async function markRead(id: string) {
    const previous = items;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, read: true } : i)));
    try {
      await api(`/me/announcements/${id}/read`, { method: 'POST' });
      router.refresh();
    } catch (error) {
      setItems(previous);
      toast.error(errorMessage(error));
    }
  }

  async function markAll() {
    const previous = items;
    setItems((list) => list.map((i) => ({ ...i, read: true })));
    try {
      await api('/me/announcements/read-all', { method: 'POST' });
      router.refresh();
    } catch (error) {
      setItems(previous);
      toast.error(errorMessage(error));
    }
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={Megaphone} title={t('emptyTitle')} description={t('emptyText')} />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {unread > 0 ? (
        <Button variant="secondary" size="sm" className="self-start" onClick={markAll}>
          <CheckCheck aria-hidden /> {t('markAll')}
        </Button>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id}>
            <Card className={cn(!item.read && 'border-accent')}>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <h2 className="min-w-0 flex-1 text-lg leading-snug font-semibold">
                    {item.title}
                  </h2>
                  {!item.read ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">
                      <span className="size-2 rounded-full bg-accent" aria-hidden />
                      {t('unread')}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted">
                  {formatDate(item.publishAt)} ·{' '}
                  {item.audience === 'COURSE' && item.courseTitle
                    ? t('forCourse', { course: item.courseTitle })
                    : item.audience === 'ALL_STUDENTS'
                      ? t('forStudents')
                      : t('forEveryone')}
                </p>
                <p className="whitespace-pre-line">{item.text}</p>
                {!item.read ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => markRead(item.id)}
                  >
                    {t('markRead')}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
