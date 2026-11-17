'use client';

import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { QuizTaker } from '@/components/quiz/quiz-taker';
import { Alert } from '@/components/ui/alert';
import { LinkButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { QuizPreview } from '@/lib/api/quiz-types';

/** Takes the quiz like a student would, in a page of its own. Nothing is saved or marked. */
export function QuizPreviewView({ data }: { data: QuizPreview }) {
  const t = useTranslations('quizBuilder');
  const [done, setDone] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-xl bg-accent-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Eye className="size-4 shrink-0" aria-hidden /> {t('previewBanner')}
        </p>
        <LinkButton href={`/teach/quizzes/${data.quiz.id}`} variant="secondary" size="sm">
          {t('backToBuilder')}
        </LinkButton>
      </div>
      {done || data.questions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4">
            <Alert tone="info">{t('previewEnd')}</Alert>
            <LinkButton href={`/teach/quizzes/${data.quiz.id}`}>{t('backToBuilder')}</LinkButton>
          </CardContent>
        </Card>
      ) : (
        <QuizTaker
          attemptId={`preview-${data.quiz.id}`}
          title={data.quiz.title}
          questions={data.questions}
          initialAnswers={{}}
          dir={data.course.dir}
          lang={data.course.lang}
          timing={null}
          preview
          onFinished={() => setDone(true)}
        />
      )}
    </div>
  );
}
