'use client';

import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonVariants, Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { api, useErrorMessage } from '@/lib/api/client';
import type { PlacementCheck, PlacementResult } from '@/lib/api/public';
import { cn } from '@/lib/cn';

type Language = { name: string; code: string; direction: 'LTR' | 'RTL' };

/**
 * "Find your level": pick a language, answer a few questions one at a time, and get a suggested
 * starting level with real courses. The answers are marked on the server, so nothing here can be
 * read from the page. No account is needed.
 */
export function PlacementCheck({
  languages,
  embedded = false,
}: {
  languages: Language[];
  /** Inside a dialog: no card around it. */
  embedded?: boolean;
}) {
  const flat = embedded ? 'max-w-none border-0 p-0 shadow-none md:p-0' : '';
  const t = useTranslations('placement');
  const errorMessage = useErrorMessage();
  const [check, setCheck] = useState<PlacementCheck | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(code: string) {
    setBusy(true);
    setError(null);
    try {
      setCheck(await api<PlacementCheck>(`/public/placement/${encodeURIComponent(code)}`));
      setIndex(0);
      setAnswers({});
      setResult(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function finish(finalAnswers: Record<string, string>) {
    if (!check) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<PlacementResult>(
          `/public/placement/${encodeURIComponent(check.language.code)}/result`,
          {
            method: 'POST',
            json: { answers: finalAnswers },
          },
        ),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function choose(questionId: string, optionId: string) {
    if (!check) return;
    const next = { ...answers, [questionId]: optionId };
    setAnswers(next);
    if (index < check.questions.length - 1) setIndex(index + 1);
    else void finish(next);
  }

  function reset() {
    setCheck(null);
    setResult(null);
    setAnswers({});
    setIndex(0);
  }

  if (result) {
    return (
      <Card
        className={cn(
          'mx-auto flex max-w-2xl flex-col items-center gap-5 p-6 text-center md:p-8',
          flat,
        )}
      >
        <p className="text-muted">{t('yourResult')}</p>
        <h2 className="text-2xl font-bold md:text-4xl">
          {result.level ? t('startAt', { level: result.level }) : t('startAtBeginning')}
        </h2>
        <p className="text-lg">{t('score', { score: result.score, total: result.total })}</p>
        <p className="max-w-md text-muted">{t('resultNote')}</p>

        {result.courses.length > 0 ? (
          <ul className="flex w-full flex-col gap-2 text-start">
            {result.courses.map((course) => (
              <li key={course.id}>
                <Link
                  href={`/courses/${course.slug}`}
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 hover:border-primary hover:bg-primary-soft"
                >
                  <span className="min-w-0 flex-1 font-semibold">{course.title}</span>
                  <ArrowRight className="size-5 shrink-0 text-primary rtl:rotate-180" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{t('noCourses')}</p>
        )}

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href={`/courses?language=${result.language.code}`}
            className={buttonVariants({ size: 'lg' })}
          >
            {t('seeCourses')}
          </Link>
          <Button variant="secondary" size="lg" onClick={reset}>
            <RotateCcw aria-hidden /> {t('again')}
          </Button>
        </div>
      </Card>
    );
  }

  if (check) {
    const question = check.questions[index]!;
    const rtl = check.language.direction === 'RTL';
    return (
      <Card className={cn('mx-auto flex max-w-2xl flex-col gap-5 p-5 md:p-8', flat)}>
        <ProgressBar
          value={Math.round((index / check.questions.length) * 100)}
          size="sm"
          label={t('questionOf', { n: index + 1, total: check.questions.length })}
        />
        <p className="text-sm font-semibold text-muted">
          {t('questionOf', { n: index + 1, total: check.questions.length })}
        </p>
        <h2
          lang={check.language.code}
          dir={rtl ? 'rtl' : 'ltr'}
          className="text-xl leading-snug font-semibold md:text-2xl"
        >
          {question.text}
        </h2>
        <ul className="flex flex-col gap-3" aria-label={t('options')}>
          {question.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose(question.id, option.id)}
                lang={check.language.code}
                dir={rtl ? 'rtl' : 'ltr'}
                className={cn(
                  'flex min-h-14 w-full items-center rounded-xl border border-border-strong bg-surface px-4 py-3 text-start text-lg hover:border-primary hover:bg-primary-soft disabled:opacity-60',
                  answers[question.id] === option.id &&
                    'border-primary bg-primary-soft font-semibold',
                )}
              >
                {option.text}
              </button>
            </li>
          ))}
        </ul>
        {error ? (
          <p className="text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button
            variant="ghost"
            onClick={() => (index > 0 ? setIndex(index - 1) : reset())}
            disabled={busy}
          >
            <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t('back')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {embedded ? null : (
        <h2 className="text-center text-xl font-semibold">{t('chooseLanguage')}</h2>
      )}
      <ul className="grid gap-3 sm:grid-cols-3">
        {languages.map((language) => (
          <li key={language.code}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void start(language.code)}
              className="flex min-h-20 w-full items-center justify-center rounded-xl border border-border bg-surface p-4 text-center font-heading text-2xl font-bold text-primary shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:shadow-raised disabled:opacity-60"
            >
              {language.name}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="text-center text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
