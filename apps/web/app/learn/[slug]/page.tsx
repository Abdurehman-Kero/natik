import { formatDate } from '@natik/shared';
import { ArrowLeft, CalendarClock, MessagesSquare } from 'lucide-react';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { AccessBlocked } from '@/components/learn/access-blocked';
import { UnitList } from '@/components/learn/unit-list';
import { NoAccess } from '@/components/layout/no-access';
import { Alert } from '@/components/ui/alert';
import { LinkButton } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import type { CourseOutline } from '@/lib/api/learn-types';
import { loadOrDenied } from '@/lib/api/safe';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('learn');
  return { title: t('backToCourse') };
}

/** The course outline: progress, a Continue button, and every unit with its lessons (FR-LEARN-001). */
export default async function CourseOutlinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireRole(['STUDENT'], `/learn/${slug}`);
  const t = await getTranslations('learn');
  const tp = await getTranslations('pages');
  const tg = await getTranslations('groups');
  const result = await loadOrDenied<CourseOutline>(`/learn/${encodeURIComponent(slug)}`);
  if (!result.ok) return <NoAccess backHref="/my-courses" backLabel={tp('myCourses')} />;
  const outline = result.data;

  if (!outline.access.allowed) {
    return (
      <AccessBlocked
        info={{
          reason: outline.access.reason,
          courseId: outline.course.id,
          courseSlug: outline.course.slug,
          isFree: outline.course.access === 'FREE',
          enrolmentId: outline.access.enrolmentId,
          endAt: outline.access.endAt,
        }}
      />
    );
  }
  if (!('units' in outline)) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/my-courses"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {tp('myCourses')}
        </Link>
        <h1 className="text-[1.625rem] leading-tight font-bold md:text-3xl">
          {outline.course.title}
        </h1>
        <div className="flex flex-col gap-1">
          <ProgressBar value={outline.enrolment.progressPct} showValue />
          <p className="text-sm text-muted">
            {t('lessonsDone', { done: outline.totals.done, total: outline.totals.total })}
          </p>
        </div>
        {outline.access.readOnly ? <Alert tone="success">{t('readOnly')}</Alert> : null}
        <LinkButton
          href={`/groups?c=${outline.course.id}`}
          variant="secondary"
          className="self-start"
        >
          <MessagesSquare aria-hidden /> {tg('courseGroup')}
        </LinkButton>
        {outline.continueLesson ? (
          <LinkButton
            href={`/learn/${outline.course.slug}/lessons/${outline.continueLesson.id}`}
            size="lg"
            fullWidth
            className="[&>span]:truncate"
          >
            <span>{t('continue', { lesson: outline.continueLesson.title })}</span>
          </LinkButton>
        ) : null}
      </div>

      {outline.units.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-6 text-center text-muted">
          {t('noLessons')}
        </p>
      ) : (
        <UnitList units={outline.units} slug={outline.course.slug} />
      )}

      {outline.upcoming.length > 0 ? (
        <section aria-labelledby="upcoming" className="flex flex-col gap-3">
          <h2 id="upcoming" className="flex items-center gap-2 font-sans text-lg font-semibold">
            <CalendarClock className="size-5 text-accent-strong" aria-hidden /> {t('upcomingTitle')}
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-dashed border-border-strong bg-surface">
            {outline.upcoming.map((session) => (
              <li key={session.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{session.title}</span>
                  <span className="block text-sm text-muted">{session.weekTitle}</span>
                </span>
                {session.sessionDate ? (
                  <span className="shrink-0 rounded-lg bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
                    {formatDate(session.sessionDate)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : outline.ongoing ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CalendarClock className="size-4" aria-hidden /> {t('ongoingNote')}
        </p>
      ) : null}
    </div>
  );
}
