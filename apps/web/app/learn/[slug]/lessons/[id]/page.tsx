import { FileQuestion, Lock } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AccessBlocked } from '@/components/learn/access-blocked';
import { LessonPlayer } from '@/components/learn/lesson-player';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiError } from '@/lib/api/errors';
import type { BlockedReason, LessonPage } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('learn');
  return { title: t('contentsTitle') };
}

const REASONS: BlockedReason[] = [
  'NOT_ENROLLED',
  'AWAITING_APPROVAL',
  'AWAITING_PAYMENT',
  'PAYMENT_UNDER_REVIEW',
  'EXPIRED',
  'CANCELLED',
];

/** One lesson for an enrolled student. Without access it explains why and what to do next. */
export default async function LessonPageRoute({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  await requireRole(['STUDENT'], `/learn/${slug}/lessons/${id}`);
  const t = await getTranslations('learn');

  let page: LessonPage;
  try {
    page = await apiFetch<LessonPage>(`/learn/lessons/${encodeURIComponent(id)}`);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 403 &&
      error.params?.reason === 'LESSON_LOCKED'
    ) {
      const p = error.params;
      return (
        <Card className="mx-auto max-w-lg">
          <EmptyState
            as="h1"
            icon={Lock}
            title={t('lockedTitle')}
            description={t('lockedText', { title: String(p.lockedByTitle ?? '') })}
            action={
              <LinkButton href={`/learn/${slug}/lessons/${String(p.lockedById ?? '')}`} size="lg">
                {t('lockedGo')}
              </LinkButton>
            }
          />
        </Card>
      );
    }
    if (error instanceof ApiError && error.status === 403 && error.params?.reason) {
      const p = error.params;
      const reason = REASONS.includes(p.reason as BlockedReason)
        ? (p.reason as BlockedReason)
        : 'NOT_ENROLLED';
      return (
        <AccessBlocked
          info={{
            reason,
            courseId: String(p.courseId ?? ''),
            courseSlug: String(p.courseSlug ?? slug),
            isFree: p.courseAccess === 'FREE',
            enrolmentId: p.enrolmentId ? String(p.enrolmentId) : null,
            endAt: p.endAt ? String(p.endAt) : null,
          }}
        />
      );
    }
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
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
    throw error;
  }

  return <LessonPlayer page={page} />;
}
