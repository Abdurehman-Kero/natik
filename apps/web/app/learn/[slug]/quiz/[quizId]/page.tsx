import { FileQuestion } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AccessBlocked } from '@/components/learn/access-blocked';
import { QuizFlow } from '@/components/quiz/quiz-flow';
import { QuizResult } from '@/components/quiz/quiz-result';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError } from '@/lib/api/errors';
import type { BlockedInfo, BlockedReason } from '@/lib/api/learn-types';
import type { AttemptResult, QuizIntro } from '@/lib/api/quiz-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('quizTake.history');
  return { title: t('title') };
}

const REASONS: BlockedReason[] = [
  'NOT_ENROLLED',
  'AWAITING_APPROVAL',
  'AWAITING_PAYMENT',
  'PAYMENT_UNDER_REVIEW',
  'EXPIRED',
  'CANCELLED',
];

type Loaded =
  | { kind: 'quiz'; intro: QuizIntro; result: AttemptResult | null }
  | { kind: 'blocked'; info: BlockedInfo }
  | { kind: 'missing' };

/** Loads the quiz (and a past attempt's result when asked), turning refusals into something to show. */
async function load(slug: string, quizId: string, attempt: string | undefined): Promise<Loaded> {
  try {
    const intro = await apiFetch<QuizIntro>(`/learn/quizzes/${encodeURIComponent(quizId)}`);
    let result: AttemptResult | null = null;
    if (attempt) {
      result = await apiFetch<AttemptResult>(
        `/learn/attempts/${encodeURIComponent(attempt)}/result`,
      ).catch((error: unknown) => {
        if (error instanceof ApiError && error.status < 500) return null;
        throw error;
      });
      if (result && result.quiz.id !== quizId) result = null;
    }
    return { kind: 'quiz', intro, result };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403 && error.params?.reason) {
      const p = error.params;
      return {
        kind: 'blocked',
        info: {
          reason: REASONS.includes(p.reason as BlockedReason)
            ? (p.reason as BlockedReason)
            : 'NOT_ENROLLED',
          courseId: String(p.courseId ?? ''),
          courseSlug: String(p.courseSlug ?? slug),
          isFree: p.courseAccess === 'FREE',
          enrolmentId: p.enrolmentId ? String(p.enrolmentId) : null,
          endAt: p.endAt ? String(p.endAt) : null,
        },
      };
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      return { kind: 'missing' };
    }
    throw error;
  }
}

/** A quiz: intro, questions and result in one flow. `?attempt=` opens a past attempt's result. */
export default async function QuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; quizId: string }>;
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { slug, quizId } = await params;
  const { attempt } = await searchParams;
  await requireRole(['STUDENT'], `/learn/${slug}/quiz/${quizId}`);
  const t = await getTranslations('quizTake');
  const loaded = await load(slug, quizId, attempt);

  if (loaded.kind === 'blocked') return <AccessBlocked info={loaded.info} />;
  if (loaded.kind === 'missing') {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          as="h1"
          icon={FileQuestion}
          title={t('unavailableTitle')}
          description={t('unavailableText')}
          action={
            <LinkButton href={`/learn/${slug}`} size="lg">
              {t('backToCourse')}
            </LinkButton>
          }
        />
      </Card>
    );
  }
  if (loaded.result) {
    return (
      <QuizResult
        result={loaded.result}
        slug={loaded.intro.course.slug}
        dir={loaded.intro.course.dir}
      />
    );
  }
  return <QuizFlow intro={loaded.intro} />;
}
