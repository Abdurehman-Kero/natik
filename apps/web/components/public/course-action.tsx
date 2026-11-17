'use client';

import { Clock, PencilLine } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { EnrolButton, RenewButton } from '@/components/learn/enrol-buttons';
import { Button, LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api/client';
import type { CourseState } from '@/lib/api/learn-types';
import { useSession } from '@/lib/use-session';

/**
 * The button on a course page (FR-CAT-004). Visitors are asked to register; students see the step
 * that fits their enrolment; the course's teachers and admins see the editor link. Decided in the
 * browser so the page itself can be cached for everyone.
 */
export function CourseAction({
  slug,
  courseId,
  isFree,
}: {
  slug: string;
  courseId: string;
  isFree: boolean;
}) {
  const t = useTranslations('courses');
  const tb = useTranslations('courseButton');
  const { user, ready } = useSession();
  const [state, setState] = useState<CourseState | null>(null);
  const [failed, setFailed] = useState(false);
  const next = encodeURIComponent(`/courses/${slug}`);

  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    api<CourseState>(`/me/course-state/${encodeURIComponent(slug)}`)
      .then((data) => active && setState(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [ready, user, slug]);

  if (!ready) return <Skeleton className="h-13 w-full" />;

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <LinkButton href={`/register?next=${next}`} size="lg" fullWidth>
          {t('registerToEnrol')}
        </LinkButton>
        <p className="text-center text-sm text-muted">
          {t('haveAccount')}{' '}
          <Link
            href={`/sign-in?next=${next}`}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {t('signIn')}
          </Link>
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <p className="rounded-lg bg-primary-soft px-4 py-3 text-center font-medium text-primary">
        {t('signedInNote')}
      </p>
    );
  }
  if (!state) return <Skeleton className="h-13 w-full" />;

  if (state.canEdit) {
    return (
      <LinkButton href={`/teach/courses/${state.courseId}`} size="lg" fullWidth variant="secondary">
        <PencilLine aria-hidden /> {tb('openEditor')}
      </LinkButton>
    );
  }
  if (user.role !== 'STUDENT') {
    return (
      <p className="rounded-lg bg-primary-soft px-4 py-3 text-center font-medium text-primary">
        {t('signedInNote')}
      </p>
    );
  }

  const enrolment = state.enrolment;
  if (!enrolment) {
    return <EnrolButton courseId={courseId} slug={slug} isFree={isFree} />;
  }

  const lapsed = !!enrolment.endAt && new Date(enrolment.endAt) < new Date();
  if (enrolment.status === 'AWAITING_PAYMENT') {
    return (
      <LinkButton href={`/pay/${enrolment.id}`} size="lg" fullWidth>
        {tb('payAndEnrol')}
      </LinkButton>
    );
  }
  if (
    enrolment.status === 'PAYMENT_SUBMITTED' ||
    (enrolment.status === 'EXPIRED' && enrolment.paymentUnderReview)
  ) {
    return (
      <Button size="lg" fullWidth disabled>
        <Clock aria-hidden /> {tb('paymentUnderReview')}
      </Button>
    );
  }
  if (enrolment.status === 'EXPIRED' || lapsed) {
    return <RenewButton enrolmentId={enrolment.id} slug={slug} />;
  }
  return (
    <LinkButton
      href={
        enrolment.continueLessonId
          ? `/learn/${slug}/lessons/${enrolment.continueLessonId}`
          : `/learn/${slug}`
      }
      size="lg"
      fullWidth
    >
      {tb('continueLearning')}
    </LinkButton>
  );
}
