'use client';

import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Textarea } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { StudentQuestion } from '@/lib/api/quiz-types';
import type { Response } from '@/lib/use-answer-sync';

/**
 * One question for a student: the text, an optional picture, and the way to answer. Text direction and
 * language come from the course, so Arabic questions read right to left (FR-LEARN-011).
 */
export function QuestionView({
  question,
  value,
  onChange,
  dir,
  lang,
  disabled,
}: {
  question: StudentQuestion;
  value: Response | undefined;
  onChange: (value: Response, delayMs?: number) => void;
  dir: 'ltr' | 'rtl';
  lang: string;
  disabled?: boolean;
}) {
  const t = useTranslations('quizTake');
  const groupLabel =
    question.type === 'MULTIPLE_CHOICE'
      ? t('chooseOne')
      : question.type === 'TRUE_FALSE'
        ? t('trueFalse')
        : question.type === 'FILL_BLANK'
          ? t('typeAnswer')
          : t('writeAnswer');

  return (
    <div className="flex flex-col gap-5" dir={dir} lang={lang}>
      <div className="flex flex-col gap-3">
        <h2 className="text-xl leading-snug font-semibold md:text-2xl">{question.text}</h2>
        <p className="text-sm text-muted" dir="ltr">
          {t('marks', { marks: question.marks })}
        </p>
        {question.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={question.mediaUrl}
            alt=""
            className="max-h-64 w-full rounded-xl border border-border object-contain"
          />
        ) : null}
      </div>

      {question.type === 'MULTIPLE_CHOICE' && question.options ? (
        <div role="radiogroup" aria-label={groupLabel} className="flex flex-col gap-3">
          {question.options.map((option) => {
            const selected = value === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-lg transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft font-semibold text-primary'
                    : 'border-border bg-surface hover:border-primary/50',
                  disabled && 'pointer-events-none opacity-70',
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={selected}
                  onChange={() => onChange(option.id)}
                  className="size-5 shrink-0 accent-[var(--color-primary)]"
                />
                <span className="min-w-0 break-words">{option.text}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      {question.type === 'TRUE_FALSE' ? (
        <div role="radiogroup" aria-label={groupLabel} className="grid grid-cols-2 gap-3">
          {[true, false].map((answer) => {
            const selected = value === answer;
            return (
              <label
                key={String(answer)}
                className={cn(
                  'flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-lg font-semibold transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border bg-surface hover:border-primary/50',
                  disabled && 'pointer-events-none opacity-70',
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  className="sr-only"
                  checked={selected}
                  onChange={() => onChange(answer)}
                />
                {answer ? (
                  <Check className="size-5" aria-hidden />
                ) : (
                  <X className="size-5" aria-hidden />
                )}
                {answer ? t('true') : t('false')}
              </label>
            );
          })}
        </div>
      ) : null}

      {question.type === 'FILL_BLANK' ? (
        <FormField label={groupLabel} hideLabel>
          <Input
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value, 700)}
            placeholder={groupLabel}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={500}
            disabled={disabled}
          />
        </FormField>
      ) : null}

      {question.type === 'SHORT_ANSWER' ? (
        <FormField label={groupLabel} hideLabel>
          <Textarea
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value, 900)}
            placeholder={groupLabel}
            rows={6}
            maxLength={5000}
            disabled={disabled}
          />
        </FormField>
      ) : null}
    </div>
  );
}
