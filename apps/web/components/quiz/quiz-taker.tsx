'use client';

import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Loader2,
  Timer,
  TriangleAlert,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QuestionView } from '@/components/quiz/question-view';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { AttemptResult, StudentQuestion } from '@/lib/api/quiz-types';
import { cn } from '@/lib/cn';
import { clearPending, type Response, useAnswerSync } from '@/lib/use-answer-sync';

export interface QuizTakerProps {
  attemptId: string;
  title: string;
  questions: StudentQuestion[];
  initialAnswers: Record<string, Response>;
  dir: 'ltr' | 'rtl';
  lang: string;
  /** The server's deadline and the server's clock when it was read, so the timer never trusts this device's clock. */
  timing: { deadlineAt: string; serverNow: string } | null;
  /** Teacher preview: nothing is saved or marked. */
  preview?: boolean;
  /** Called with the result once the attempt is submitted (or null in preview). */
  onFinished: (result: AttemptResult | null, timedOut: boolean) => void;
}

const mmss = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/**
 * One question per screen with a dot navigator, quiet autosave, an offline queue, a server-kept timer
 * and a review step before submitting (FR-QUIZ-005…008). Everything here is thumb-sized for phones.
 */
export function QuizTaker({
  attemptId,
  title,
  questions,
  initialAnswers,
  dir,
  lang,
  timing,
  preview = false,
  onFinished,
}: QuizTakerProps) {
  const t = useTranslations('quizTake');
  const errorMessage = useErrorMessage();
  const [index, setIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');
  const [online, setOnline] = useState(true);
  const finished = useRef(false);
  // The latest callbacks, kept in a ref so "finish" (and the timer that uses it) stays the same
  // function between renders. Otherwise the timer would restart on every tick.
  const latest = useRef({ errorMessage, onFinished });
  useEffect(() => {
    latest.current = { errorMessage, onFinished };
  });

  const finish = useCallback(
    async (timedOut: boolean) => {
      if (finished.current) return;
      finished.current = true;
      try {
        const result = await api<AttemptResult>(`/learn/attempts/${attemptId}/submit`, {
          method: 'POST',
        });
        clearPending(attemptId);
        latest.current.onFinished(result, timedOut);
      } catch (error) {
        finished.current = false;
        setSubmitting(false);
        toast.error(latest.current.errorMessage(error));
      }
    },
    [attemptId],
  );

  const sync = useAnswerSync({
    attemptId,
    initial: initialAnswers,
    preview,
    onClosed: () => void finish(true),
  });

  // The timer counts down from the server's deadline, corrected for this device's clock.
  useEffect(() => {
    if (!timing || preview) return;
    const deadline = new Date(timing.deadlineAt).getTime();
    const offset = new Date(timing.serverNow).getTime() - Date.now();
    let warned5 = false;
    let warned1 = false;
    const tick = () => {
      const left = deadline - (Date.now() + offset);
      setRemaining(left);
      if (left <= 300_000 && !warned5 && left > 60_000) {
        warned5 = true;
        setAnnounce(t('timeWarning5'));
      }
      if (left <= 60_000 && !warned1 && left > 0) {
        warned1 = true;
        setAnnounce(t('timeWarning1'));
      }
      if (left <= 0) {
        setAnnounce(t('timeUp'));
        void finish(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timing, preview, finish, t]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const question = questions[index]!;
  const answered = (q: StudentQuestion) => {
    const v = sync.answers[q.id];
    return v !== undefined && !(typeof v === 'string' && v.trim() === '');
  };
  const answeredCount = questions.filter(answered).length;
  const unanswered = questions.map((q, i) => ({ q, i })).filter(({ q }) => !answered(q));
  const offline = !online || sync.state === 'offline';

  async function submit() {
    setSubmitting(true);
    if (preview) {
      onFinished(null, false);
      return;
    }
    // Send anything still waiting first, so the last answer is never lost.
    await sync.flush();
    await finish(false);
  }

  const timerChip =
    remaining !== null ? (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold tabular-nums',
          remaining <= 60_000
            ? 'bg-accent-soft text-accent-strong'
            : 'bg-primary-soft text-primary',
        )}
        role="timer"
        aria-label={t('timerLabel', { time: mmss(remaining) })}
      >
        <Timer className="size-4" aria-hidden /> {mmss(remaining)}
      </span>
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">{title}</h1>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {offline ? (
        <Alert tone="warning">
          <span className="flex items-start gap-2">
            <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('offline')}
          </span>
        </Alert>
      ) : null}
      {sync.state === 'error' && !offline ? (
        <Alert tone="warning">
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('saveFailed')}
          </span>
        </Alert>
      ) : null}

      {reviewing ? (
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">{t('reviewTitle')}</h2>
              {timerChip}
            </div>
            <p className="text-lg">
              {t('reviewCount', { answered: answeredCount, total: questions.length })}
            </p>
            {unanswered.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {unanswered.map(({ i }) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg bg-warning-soft px-4 py-2 text-warning"
                  >
                    <span className="font-medium">{t('reviewSkipped', { n: i + 1 })}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIndex(i);
                        setReviewing(false);
                      }}
                    >
                      {t('goTo', { n: i + 1 })}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 font-medium text-success">
                <Check className="size-5" aria-hidden /> {t('allAnswered')}
              </p>
            )}
            <Button size="lg" fullWidth loading={submitting} onClick={() => void submit()}>
              {t('submit')}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={submitting}
              onClick={() => setReviewing(false)}
            >
              {t('backToQuestions')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-muted">{title}</p>
              {timerChip}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold" aria-live="polite">
                {t('questionOf', { n: index + 1, total: questions.length })}
              </p>
              {!preview ? (
                <p
                  className="flex items-center gap-1.5 text-sm text-muted"
                  role="status"
                  aria-live="polite"
                >
                  {sync.state === 'saving' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden /> {t('saving')}
                    </>
                  ) : sync.state === 'saved' ? (
                    <>
                      <Check className="size-4 text-success" aria-hidden /> {t('savedState')}
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
            <ol
              className="flex flex-wrap gap-2"
              aria-label={t('questionOf', { n: index + 1, total: questions.length })}
            >
              {questions.map((q, i) => (
                <li key={q.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={t('dots', {
                      n: i + 1,
                      state: answered(q) ? t('answered') : t('notAnswered'),
                    })}
                    aria-current={i === index ? 'step' : undefined}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                      i === index && 'ring-2 ring-primary ring-offset-2',
                      answered(q)
                        ? 'border-primary bg-primary text-white'
                        : 'border-border-strong bg-surface text-muted',
                    )}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          <Card>
            <CardContent>
              <QuestionView
                key={question.id}
                question={question}
                value={sync.answers[question.id]}
                onChange={(value, delay) => sync.setAnswer(question.id, value, delay)}
                dir={dir}
                lang={lang}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="lg"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft aria-hidden className="rtl:rotate-180" /> {t('back')}
            </Button>
            {index < questions.length - 1 ? (
              <Button size="lg" onClick={() => setIndex((i) => i + 1)}>
                {t('next')} <ChevronRight aria-hidden className="rtl:rotate-180" />
              </Button>
            ) : (
              <Button size="lg" onClick={() => setReviewing(true)}>
                {t('review')} <ChevronRight aria-hidden className="rtl:rotate-180" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
