'use client';

import { Clock, PencilLine } from 'lucide-react';
import { AuthButton } from '@/components/auth/auth-button';
import { AuthLink } from '@/components/auth/auth-dialog';
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
  // Bumped after "Request to join" so the button shows the new state at once.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    api<CourseState>(`/me/course-state/${encodeURIComponent(slug)}`)
      .then((data) => active && setState(data))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [ready, user, slug, version]);

  if (!ready) return <Skeleton className="h-13 w-full" />;

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <AuthButton mode="register" next={`/courses/${slug}`} size="lg" fullWidth>
          {t('registerToEnrol')}
        </AuthButton>
        <p className="text-center text-sm text-muted">
          {t('haveAccount')}{' '}
          <AuthLink
            mode="sign-in"
            next={`/courses/${slug}`}
            className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
          >
            {t('signIn')}
          </AuthLink>
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
    return (
      <EnrolButton
        courseId={courseId}
        slug={slug}
        isFree={isFree}
        onRequested={() => setVersion((v) => v + 1)}
      />
    );
  }

  const lapsed = !!enrolment.endAt && new Date(enrolment.endAt) < new Date();
  if (enrolment.status === 'AWAITING_PAYMENT') {
    return (
      <LinkButton href={`/pay/${enrolment.id}`} size="lg" fullWidth>
        {tb('payAndEnrol')}
      </LinkButton>
    );
  }
  if (enrolment.status === 'AWAITING_APPROVAL') {
    return (
      <div className="flex flex-col gap-2">
        <Button size="lg" fullWidth disabled>
          <Clock aria-hidden /> {tb('waitingApproval')}
        </Button>
        <p className="text-center text-sm text-muted">{tb('waitingApprovalHint')}</p>
      </div>
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
