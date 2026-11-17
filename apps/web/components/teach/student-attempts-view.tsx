'use client';

import { formatDate } from '@natik/shared';
import { ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/layout';
import { StatusPill } from '@/components/ui/status-pill';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { StudentAttempts } from '@/lib/api/quiz-types';

/** A student's attempts on each quiz of the course, and the button for one more try (FR-QUIZ-012). */
export function StudentAttemptsView({
  courseId,
  data,
}: {
  courseId: string;
  data: StudentAttempts;
}) {
  const t = useTranslations('teachStudents');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [granting, setGranting] = useState<StudentAttempts['quizzes'][number] | null>(null);

  async function grant() {
    if (!granting) return;
    try {
      await api(`/teach/quizzes/${granting.id}/grants`, {
        method: 'POST',
        json: { studentId: data.student.id },
      });
      toast.success(t('extraGiven'));
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  return (
    <>
      <PageHeader
        title={data.student.fullName}
        subtitle={t('attemptsTitle')}
        back={{ href: `/teach/courses/${courseId}/students`, label: t('title') }}
      />
      {data.quizzes.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title={t('noQuizzes')} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.quizzes.map((quiz) => (
            <li key={quiz.id}>
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">
                        {quiz.title}
                        {quiz.isFinal ? (
                          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
                            {t('final')}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted">
                        {t('passMark', { value: quiz.passMarkPct })} ·{' '}
                        {quiz.attemptsLeft === null
                          ? t('unlimited')
                          : t('left', { count: quiz.attemptsLeft })}
                      </p>
                    </div>
                    {quiz.attemptsLeft !== null ? (
                      <Button variant="secondary" size="sm" onClick={() => setGranting(quiz)}>
                        {t('giveExtra')}
                      </Button>
                    ) : null}
                  </div>
                  {quiz.attempts.length === 0 ? (
                    <p className="text-muted">{t('noAttempts')}</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {quiz.attempts.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                        >
                          <span className="font-medium">{t('attemptN', { n: a.number })}</span>
                          <span className="text-sm text-muted">
                            {a.submittedAt ? formatDate(a.submittedAt) : ''}
                          </span>
                          <span className="flex items-center gap-3">
                            {a.scorePct !== null ? (
                              <span className="font-heading font-bold tabular-nums">
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
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={granting !== null}
        onOpenChange={(open) => !open && setGranting(null)}
        title={t('giveTitle')}
        description={t('giveText', { name: data.student.fullName })}
        confirmLabel={t('giveConfirm')}
        onConfirm={grant}
      />
    </>
  );
}
