import { formatDate } from '@natik/shared';
import { ArrowLeft, History } from 'lucide-react';
import Link from '@/components/ui/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import { ApiError } from '@/lib/api/errors';
import type { AttemptHistory } from '@/lib/api/quiz-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('quizTake.history');
  return { title: t('title') };
}

/** Every attempt on one quiz, with its score (FR-QUIZ-011). */
export default async function AttemptsPage({
  params,
}: {
  params: Promise<{ slug: string; quizId: string }>;
}) {
  const { slug, quizId } = await params;
  await requireRole(['STUDENT'], `/learn/${slug}/quiz/${quizId}/attempts`);
  const t = await getTranslations('quizTake.history');
  let data: AttemptHistory;
  try {
    data = await apiFetch<AttemptHistory>(`/learn/quizzes/${encodeURIComponent(quizId)}/attempts`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/learn/${slug}/quiz/${quizId}`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {data.quiz.title}
      </Link>
      <h1 className="text-2xl font-bold md:text-3xl">{t('title')}</h1>
      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={History} title={t('empty')} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{t('attemptN', { n: a.number })}</p>
                    <p className="text-sm text-muted">{formatDate(a.submittedAt ?? a.startedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.scorePct !== null ? (
                      <span className="font-heading text-xl font-bold tabular-nums">
                        {a.scorePct}%
                      </span>
                    ) : null}
                    <StatusPill
                      status={
                        a.status === 'GRADED'
                          ? a.passed
                            ? 'quiz.passed'
                            : 'quiz.failed'
                          : 'quiz.waiting'
                      }
                      size="sm"
                    />
                    {a.status !== 'IN_PROGRESS' ? (
                      <Link
                        href={`/learn/${slug}/quiz/${quizId}?attempt=${a.id}`}
                        className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                      >
                        {t('open')}
                      </Link>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
