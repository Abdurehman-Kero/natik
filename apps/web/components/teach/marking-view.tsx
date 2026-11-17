'use client';

import { refreshCounts } from '@/lib/use-live-counts';
import { formatDate } from '@natik/shared';
import { CircleCheckBig } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input, TextareaField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { MarkingItem, MarkingQueue } from '@/lib/api/quiz-types';

/**
 * The marking queue (FR-QUIZ-009): one answer at a time, "Save & next", oldest first. Works on a phone
 * so a teacher can mark between classes.
 */
export function MarkingView({
  queue,
  filters,
}: {
  queue: MarkingQueue;
  filters: { courseId: string; quizId: string };
}) {
  const t = useTranslations('marking');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<string[]>([]);

  const remaining = queue.items.filter((i) => !done.has(i.answerId));
  // Skipped answers go to the back of the line, so "Skip" never gets stuck on the same one.
  const ordered = [
    ...remaining.filter((i) => !skipped.includes(i.answerId)),
    ...remaining.filter((i) => skipped.includes(i.answerId)),
  ];
  const current = ordered[0] ?? null;

  function go(changes: Record<string, string>) {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const quizzes = queue.quizzes.filter((q) => !filters.courseId || q.courseId === filters.courseId);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="mb-5 grid gap-3 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
        <p className="text-lg font-semibold">{t('toMark', { count: remaining.length })}</p>
        <Select
          aria-label={t('course')}
          value={filters.courseId}
          onChange={(e) => go({ courseId: e.target.value, quizId: '' })}
          placeholder={t('allCourses')}
          options={queue.courses.map((c) => ({ value: c.id, label: c.title }))}
        />
        <Select
          aria-label={t('quiz')}
          value={filters.quizId}
          onChange={(e) => go({ quizId: e.target.value })}
          placeholder={t('allQuizzes')}
          options={quizzes.map((q) => ({ value: q.id, label: q.title }))}
        />
      </div>

      {current ? (
        <MarkCard
          key={current.answerId}
          item={current}
          position={queue.items.length - remaining.length + 1}
          total={queue.items.length}
          canSkip={remaining.length > 1}
          onSkip={() =>
            setSkipped((list) => [
              ...list.filter((id) => id !== current.answerId),
              current.answerId,
            ])
          }
          onSaved={() => {
            setDone((set) => new Set(set).add(current.answerId));
            router.refresh();
            refreshCounts();
          }}
        />
      ) : (
        <Card>
          <EmptyState icon={CircleCheckBig} title={t('emptyTitle')} description={t('emptyText')} />
        </Card>
      )}
    </>
  );
}

function MarkCard({
  item,
  position,
  total,
  canSkip,
  onSkip,
  onSaved,
}: {
  item: MarkingItem;
  position: number;
  total: number;
  canSkip: boolean;
  onSkip: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('marking');
  const errorMessage = useErrorMessage();
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    const marks = Number(score);
    if (score.trim() === '' || Number.isNaN(marks) || marks < 0 || marks > item.question.maxMarks) {
      setError(t('scoreHint', { max: item.question.maxMarks }));
      return;
    }
    if (Math.round(marks * 2) !== marks * 2) {
      setError(t('scoreHint', { max: item.question.maxMarks }));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await api(`/teach/answers/${item.answerId}/mark`, {
        method: 'POST',
        json: { marks, comment },
      });
      toast.success(t('saved'));
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">
            {t('questionLine', {
              quiz: item.quiz.title,
              marks: t('marks', { marks: item.question.maxMarks }),
            })}
          </p>
          <p className="text-sm text-muted">{t('position', { n: position, total })}</p>
        </div>
        <p className="text-sm text-muted">
          {t('from', { name: item.studentName })}
          {item.submittedAt ? ` · ${formatDate(item.submittedAt)}` : ''}
        </p>

        <div dir={item.course.dir} lang={item.course.lang} className="flex flex-col gap-4">
          <p className="text-lg font-medium">{item.question.text}</p>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-muted">{t('studentAnswer')}</p>
            <p className="rounded-xl border border-border bg-canvas p-4 text-lg leading-relaxed whitespace-pre-wrap">
              {item.response}
            </p>
          </div>
          {item.question.modelAnswer ? (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-muted">{t('modelAnswer')}</p>
              <p className="rounded-xl bg-primary-soft p-3 whitespace-pre-wrap">
                {item.question.modelAnswer}
              </p>
            </div>
          ) : null}
        </div>

        <form onSubmit={save} noValidate className="flex flex-col gap-4">
          <FormField
            label={t('score')}
            hint={t('scoreHint', { max: item.question.maxMarks })}
            error={error}
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={item.question.maxMarks}
              step={0.5}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="max-w-32"
              autoFocus
            />
          </FormField>
          <TextareaField
            label={t('comment')}
            hint={t('commentHint')}
            optional
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={1000}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {canSkip ? (
              <Button type="button" variant="ghost" onClick={onSkip}>
                {t('skip')}
              </Button>
            ) : null}
            <Button type="submit" size="lg" loading={busy}>
              {t('saveNext')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
