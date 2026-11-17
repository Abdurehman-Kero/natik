'use client';

import { ArrowLeft, Clock, HelpCircle, History, Target } from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { QuizResult } from '@/components/quiz/quiz-result';
import { QuizTaker } from '@/components/quiz/quiz-taker';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { AttemptResult, AttemptView, QuizIntro } from '@/lib/api/quiz-types';
import type { Response } from '@/lib/use-answer-sync';

type Stage =
  | { name: 'intro' }
  | { name: 'taking'; view: AttemptView }
  | { name: 'result'; result: AttemptResult; timedOut: boolean };

/** Intro → questions → review → result, all on one address so the back button never loses a quiz. */
export function QuizFlow({ intro }: { intro: QuizIntro }) {
  const ti = useTranslations('quizTake.intro');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: 'intro' });
  const [busy, setBusy] = useState(false);
  const slug = intro.course.slug;

  const start = useCallback(async () => {
    setBusy(true);
    try {
      const { attemptId } = await api<{ attemptId: string }>(
        `/learn/quizzes/${intro.quiz.id}/attempts`,
        { method: 'POST' },
      );
      const view = await api<AttemptView>(`/learn/attempts/${attemptId}`);
      if (view.attempt.status === 'IN_PROGRESS') {
        setStage({ name: 'taking', view });
      } else {
        // Time ran out while the page was closed: show what happened.
        const result = await api<AttemptResult>(`/learn/attempts/${attemptId}/result`);
        setStage({ name: 'result', result, timedOut: true });
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [errorMessage, intro.quiz.id]);

  const finished = useCallback(
    (result: AttemptResult | null, timedOut: boolean) => {
      if (!result) return;
      setStage({ name: 'result', result, timedOut });
      // The course outline and dashboard now show the new progress.
      router.refresh();
      window.scrollTo({ top: 0 });
    },
    [router],
  );

  if (stage.name === 'taking' && stage.view.questions && stage.view.course) {
    const view = stage.view;
    return (
      <QuizTaker
        attemptId={view.attempt.id}
        title={intro.quiz.title}
        questions={view.questions!}
        initialAnswers={(view.answers ?? {}) as Record<string, Response>}
        dir={view.course!.dir}
        lang={view.course!.lang}
        timing={
          view.attempt.deadlineAt
            ? { deadlineAt: view.attempt.deadlineAt, serverNow: view.attempt.serverNow }
            : null
        }
        onFinished={finished}
      />
    );
  }

  if (stage.name === 'result') {
    return (
      <QuizResult
        result={stage.result}
        slug={slug}
        dir={intro.course.dir}
        timedOut={stage.timedOut}
        retrying={busy}
        onTryAgain={() => void start()}
      />
    );
  }

  const noAttempts = intro.attemptsLeft === 0 && !intro.inProgressId;
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/learn/${slug}/lessons/${intro.lesson.id}`}
        className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {ti('back')}
      </Link>
      <Card>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted">{intro.lesson.title}</p>
            <h1 className="text-2xl leading-tight font-bold md:text-3xl" dir={intro.course.dir}>
              {intro.quiz.title}
            </h1>
          </div>
          {intro.quiz.instructions ? (
            <p className="whitespace-pre-line" dir={intro.course.dir}>
              {intro.quiz.instructions}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2 text-lg">
            <li className="flex items-center gap-3">
              <HelpCircle className="size-5 text-primary" aria-hidden />
              {ti('questions', { count: intro.quiz.questionCount })}
            </li>
            <li className="flex items-center gap-3">
              <Clock className="size-5 text-primary" aria-hidden />
              {intro.quiz.timeLimitMinutes
                ? ti('time', { count: intro.quiz.timeLimitMinutes })
                : ti('noTime')}
            </li>
            <li className="flex items-center gap-3">
              <Target className="size-5 text-primary" aria-hidden />
              {ti('passMark', { value: intro.quiz.passMarkPct })}
            </li>
          </ul>
          <p className="text-muted">
            {intro.quiz.maxAttempts === null
              ? ti('attemptsUnlimited')
              : ti('attemptsLeft', {
                  left: intro.attemptsLeft ?? 0,
                  total: (intro.attemptsLeft ?? 0) + intro.attemptsUsed,
                })}
          </p>
          {intro.quiz.isFinal ? <Alert tone="info">{ti('finalNote')}</Alert> : null}
          {intro.passed ? (
            <Alert tone="success">{ti('passedNote', { score: intro.bestScorePct ?? 0 })}</Alert>
          ) : null}
          {noAttempts ? <Alert tone="warning">{ti('noAttempts')}</Alert> : null}
          {!intro.canStart && !noAttempts ? <Alert tone="info">{ti('readOnly')}</Alert> : null}

          {intro.canStart ? (
            <Button size="lg" fullWidth loading={busy} onClick={() => void start()}>
              {intro.inProgressId
                ? ti('resume')
                : intro.attemptsUsed > 0
                  ? ti('again')
                  : ti('start')}
            </Button>
          ) : null}
          {intro.attemptsUsed > 0 ? (
            <Link
              href={`/learn/${slug}/quiz/${intro.quiz.id}/attempts`}
              className="inline-flex min-h-11 items-center justify-center gap-2 font-semibold text-primary hover:underline"
            >
              <History className="size-5" aria-hidden /> {ti('history')}
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
