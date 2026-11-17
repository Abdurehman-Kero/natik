'use client';

import { formatDate } from '@natik/shared';
import { Download, MessageCircle, Search, UsersRound } from 'lucide-react';
import Link from '@/components/ui/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { ProgressBar } from '@/components/ui/progress';
import { StatusPill } from '@/components/ui/status-pill';
import type { ProgressStudent } from '@/lib/api/ops-types';

/** Enrolments whose student the teacher can write to (same rule as the chat server). */
const CAN_MESSAGE = new Set(['ACTIVE', 'COMPLETED', 'EXPIRED']);

/**
 * A course's students with progress and scores, a name search and a CSV (FR-TEACH-006). Teachers never
 * see phone numbers or payments here (BR-ROLE-002).
 */
export function StudentsProgress({
  courseId,
  items,
  total,
  page,
  pageSize,
  q,
}: {
  courseId: string;
  items: ProgressStudent[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
}) {
  const t = useTranslations('teachStudents');
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const exportHref = `/api/v1/teach/courses/${courseId}/students/export${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function search(event: FormEvent) {
    event.preventDefault();
    router.push(query.trim() ? `${pathname}?q=${encodeURIComponent(query.trim())}` : pathname);
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('count', { count: total })}
        back={{ href: `/teach/courses/${courseId}`, label: t('back') }}
        action={
          <Button asChild variant="secondary">
            <a href={exportHref} download>
              <Download aria-hidden /> {t('export')}
            </a>
          </Button>
        }
      />
      <form role="search" onSubmit={search} className="mb-5 flex gap-3">
        <Input
          type="search"
          aria-label={t('search')}
          placeholder={t('search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit" variant="secondary" aria-label={t('search')}>
          <Search aria-hidden />
        </Button>
      </form>

      {items.length === 0 ? (
        <Card>
          <EmptyState icon={UsersRound} title={t('emptyTitle')} description={t('emptyText')} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((s) => (
            <li key={s.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.fullName}</p>
                    <p className="text-sm text-muted">
                      {t('lessons', { done: s.lessonsDone, total: s.lessonsTotal })} ·{' '}
                      {s.quizAvgPct === null ? t('noScore') : t('quizAvg', { value: s.quizAvgPct })}{' '}
                      · {s.finalPct === null ? t('noScore') : t('finalQuiz', { value: s.finalPct })}
                    </p>
                    <p className="text-sm text-muted">
                      {s.lastActiveAt
                        ? t('lastActive', { date: formatDate(s.lastActiveAt) })
                        : t('neverActive')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <StatusPill status={`enrolment.${s.status}` as 'enrolment.ACTIVE'} size="sm" />
                    <ProgressBar value={s.progressPct} size="sm" showValue className="w-36" />
                    <Link
                      href={`/teach/courses/${courseId}/students/${s.id}`}
                      className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                    >
                      {t('viewAttempts')}
                    </Link>
                    {CAN_MESSAGE.has(s.status) ? (
                      <Link
                        href={`/teach/chat?to=${encodeURIComponent(s.id)}`}
                        aria-label={t('messageName', { name: s.fullName })}
                        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary hover:underline"
                      >
                        <MessageCircle className="size-4.5" aria-hidden />
                        {t('message')}
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-muted">{t('noPhones')}</p>
      <Pagination
        className="mt-4"
        page={page}
        totalPages={totalPages}
        hrefFor={(p) =>
          `${pathname}?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`
        }
      />
    </>
  );
}
