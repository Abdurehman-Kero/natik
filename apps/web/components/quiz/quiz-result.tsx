'use client';

import { Award, Check, Hourglass, PartyPopper, X } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ProgressRing } from '@/components/ui/progress';
import type { AttemptResult, ReviewItem } from '@/lib/api/quiz-types';
import { cn } from '@/lib/cn';

/** Turns a stored answer into words: an option's text, True/False, or what was typed. */
function show(item: ReviewItem, value: unknown, t: ReturnType<typeof useTranslations>): string {
  if (value === null || value === undefined || value === '') return t('noAnswer');
  if (item.type === 'MULTIPLE_CHOICE') {
    return item.options?.find((o) => o.id === value)?.text ?? t('noAnswer');
  }
  if (item.type === 'TRUE_FALSE') return value === true ? t('true') : t('false');
  if (Array.isArray(value)) return value.join(' / ');
  return String(value);
}

function ReviewList({ items, dir }: { items: ReviewItem[]; dir: 'ltr' | 'rtl' }) {
  const t = useTranslations('quizTake');
  return (
    <ol className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.questionId}>
          <Card>
            <CardContent className="flex flex-col gap-3" dir={dir}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">
                  {index + 1}. {item.text}
                </p>
                {item.marks !== null ? (
                  <span
                    className="shrink-0 text-sm font-semibold text-muted tabular-nums"
                    dir="ltr"
                  >
                    {t('marksLine', { marks: item.marks, max: item.maxMarks })}
                  </span>
                ) : null}
              </div>
              <p>
                <span className="text-sm text-muted">{t('yourAnswer')}: </span>
                {show(item, item.response, t)}
              </p>
              {item.isCorrect !== undefined && item.isCorrect !== null ? (
                <p
                  className={cn(
                    'flex items-center gap-1.5 text-sm font-semibold',
                    item.isCorrect ? 'text-success' : 'text-danger',
                  )}
                >
                  {item.isCorrect ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <X className="size-4" aria-hidden />
                  )}
                  {item.isCorrect ? t('rightLabel') : t('wrongLabel')}
                </p>
              ) : null}
              {item.correct !== undefined && item.correct !== '' && !item.isCorrect ? (
                <p>
                  <span className="text-sm text-muted">{t('correctAnswer')}: </span>
                  {show(item, item.correct, t)}
                </p>
              ) : null}
              {item.explanation ? (
                <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm">
                  <span className="font-semibold">{t('explanation')}: </span>
                  {item.explanation}
                </p>
              ) : null}
              {item.teacherComment ? (
                <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm">
                  <span className="font-semibold">{t('teacherComment')}: </span>
                  {item.teacherComment}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}

/**
 * The result first, details on demand (DESIGN): a big ring, passed or not, then "Review answers".
 * A short answer still waiting for the teacher says so instead of showing a score.
 */
export function QuizResult({
  result,
  slug,
  dir,
  timedOut,
  onTryAgain,
  retrying,
}: {
  result: AttemptResult;
  slug: string;
  dir: 'ltr' | 'rtl';
  timedOut?: boolean;
  onTryAgain?: () => void;
  retrying?: boolean;
}) {
  const t = useTranslations('quizTake');
  const [open, setOpen] = useState(false);
  const base = `/learn/${slug}`;

  if (!result.result) {
    return (
      <div className="flex flex-col gap-4">
        {timedOut ? <Alert tone="info">{t('timeUp')}</Alert> : null}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span
              className="flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning"
              aria-hidden
            >
              <Hourglass className="size-7" />
            </span>
            <h1 className="text-2xl font-bold">{t('waitingTitle')}</h1>
            <p className="max-w-sm text-muted">{t('waitingText')}</p>
            <Link href={base} className={buttonVariants({ size: 'lg' })}>
              {t('continueCourse')}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const passed = result.result.passed;
  const noMoreTries = result.attemptsLeft === 0;
  return (
    <div className="flex flex-col gap-4">
      {timedOut ? <Alert tone="info">{t('timeUp')}</Alert> : null}

      {result.courseCompleted && passed && result.quiz.isFinal ? (
        <Card className="border-accent bg-accent-soft">
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <PartyPopper className="size-9 text-accent-strong" aria-hidden />
            <h2 className="text-2xl font-bold">{t('courseCompleteTitle')}</h2>
            <p className="text-muted">{t('courseCompleteText')}</p>
            <Link
              href="/certificates"
              className={buttonVariants({ variant: 'accent', size: 'lg' })}
            >
              <Award aria-hidden /> {t('getCertificate')}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <ProgressRing
            value={result.result.scorePct}
            tone={passed ? 'accent' : 'primary'}
            size="lg"
            label={`${result.result.scorePct}%`}
          />
          <h1 className="text-2xl font-bold">{passed ? t('passedTitle') : t('notPassedTitle')}</h1>
          <p className="text-muted" dir="ltr">
            {t('scoreLine', {
              score: result.result.score,
              max: result.result.maxScore,
              pass: result.quiz.passMarkPct,
            })}
          </p>
          {!passed ? (
            <p className="text-muted">
              {result.attemptsLeft === null
                ? t('attemptsUnlimited')
                : t('attemptsLeft', { count: result.attemptsLeft })}
            </p>
          ) : null}
          <div className="flex w-full max-w-xs flex-col gap-3">
            {!passed && !noMoreTries && onTryAgain ? (
              <Button size="lg" fullWidth loading={retrying} onClick={onTryAgain}>
                {t('tryAgain')}
              </Button>
            ) : null}
            {passed && result.nextLessonId ? (
              <Link
                href={`${base}/lessons/${result.nextLessonId}`}
                className={buttonVariants({ size: 'lg' })}
              >
                {t('nextLesson')}
              </Link>
            ) : null}
            {result.review ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
              >
                {open ? t('hideReview') : t('reviewAnswers')}
              </Button>
            ) : null}
            <Link href={base} className={buttonVariants({ variant: 'ghost' })}>
              {t('backToCourse')}
            </Link>
          </div>
        </CardContent>
      </Card>

      {open && result.review ? <ReviewList items={result.review} dir={dir} /> : null}
    </div>
  );
}
