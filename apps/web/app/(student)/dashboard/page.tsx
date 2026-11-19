import { Award, ChevronRight, ClipboardCheck, Sparkles } from 'lucide-react';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { MyCourseCard } from '@/components/learn/my-course-card';
import { GettingStarted } from '@/components/learn/getting-started';
import { LinkButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/layout';
import { ProgressBar } from '@/components/ui/progress';
import type { StudentDashboard } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';
import { formatDate } from '@natik/shared';

export async function generateMetadata() {
  const t = await getTranslations('studentHome');
  return { title: t('title') };
}

/** The student's home: where to continue, their courses and the latest news (FR-STU-001). */
export default async function StudentDashboardPage() {
  await requireRole(['STUDENT'], '/dashboard');
  const t = await getTranslations('studentHome');
  const data = await apiFetch<StudentDashboard>('/me/dashboard');

  if (data.totalCourses === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-[1.625rem] font-bold md:text-4xl">
          {t('greeting', { name: data.firstName })}
        </h1>
        <GettingStarted />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[1.625rem] font-bold md:text-4xl">
        {t('greeting', { name: data.firstName })}
      </h1>

      {data.certificatesToConfirm.length > 0 ? (
        <section
          aria-labelledby="certificate-heading"
          className="flex flex-col gap-3 rounded-2xl border border-accent bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Award className="mt-0.5 size-7 shrink-0 text-accent-strong" aria-hidden />
            <div className="min-w-0">
              <h2 id="certificate-heading" className="font-sans text-lg font-semibold">
                {t('certificateReadyTitle')}
              </h2>
              <p className="text-muted">
                {t('certificateReadyText', { course: data.certificatesToConfirm[0]!.courseTitle })}
              </p>
            </div>
          </div>
          <LinkButton href="/certificates" variant="accent" className="sm:shrink-0">
            {t('certificateReadyButton')}
          </LinkButton>
        </section>
      ) : null}

      {data.newSessions.length > 0 ? (
        <section aria-labelledby="new-sessions" className="flex flex-col gap-3">
          <h2 id="new-sessions" className="flex items-center gap-2 font-sans text-lg font-semibold">
            <Sparkles className="size-5 text-accent-strong" aria-hidden /> {t('newSessionsTitle')}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.newSessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={`/learn/${session.courseSlug}/lessons/${session.id}`}
                  className="flex h-full card-hover items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card"
                >
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
                    {t('new')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{session.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {session.courseTitle}
                      {session.sessionDate ? ` · ${formatDate(session.sessionDate)}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted rtl:rotate-180" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.continue ? (
        <section aria-labelledby="continue-heading">
          <div className="flex flex-col gap-4 rounded-2xl bg-primary p-5 text-white shadow-raised sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 flex-col gap-1">
              <h2
                id="continue-heading"
                className="text-sm font-semibold tracking-wide text-white/80 uppercase"
              >
                {t('continueTitle')}
              </h2>
              <p className="truncate text-xl font-bold">{data.continue.courseTitle}</p>
              <p className="truncate text-white/80">{data.continue.lessonTitle}</p>
              <ProgressBar
                value={data.continue.progressPct}
                showValue
                onDark
                className="mt-2 max-w-sm"
              />
            </div>
            <LinkButton
              href={`/learn/${data.continue.courseSlug}/lessons/${data.continue.lessonId}`}
              variant="onDark"
              size="lg"
              className="sm:shrink-0"
            >
              {t('continueButton')} <ChevronRight aria-hidden className="rtl:rotate-180" />
            </LinkButton>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeading title={t('myCourses')} link={{ href: '/my-courses', label: t('seeAll') }} />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((item) => (
            <li key={item.enrolmentId}>
              <MyCourseCard item={item} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title={
            data.news.unread > 0
              ? `${t('news')} (${t('newCount', { count: data.news.unread })})`
              : t('news')
          }
          link={{ href: '/announcements', label: t('seeAll') }}
        />
        <Card>
          {data.news.latest.length === 0 ? (
            <CardContent className="text-muted">{t('noNews')}</CardContent>
          ) : (
            <ul className="divide-y divide-border">
              {data.news.latest.map((item) => (
                <li key={item.id}>
                  <Link
                    href="/announcements"
                    className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-canvas"
                  >
                    {!item.read ? (
                      <span className="size-2.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    ) : (
                      <span className="size-2.5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.title}</span>
                      <span className="block text-xs text-muted">{formatDate(item.publishAt)}</span>
                    </span>
                    {!item.read ? (
                      <span className="sr-only">{t('newCount', { count: 1 })}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <ClipboardCheck className="size-5 shrink-0 text-primary" aria-hidden /> {t('results')}
            </p>
            {data.results.length === 0 ? (
              <p className="text-sm text-muted">{t('resultsText')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.results.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{r.quizTitle}</span>
                    <span
                      className={
                        r.status === 'WAITING_FOR_MARKING'
                          ? 'shrink-0 font-semibold text-warning'
                          : r.passed
                            ? 'shrink-0 font-semibold text-success'
                            : 'shrink-0 font-semibold text-danger'
                      }
                    >
                      {r.status === 'WAITING_FOR_MARKING'
                        ? t('resultWaiting')
                        : `${r.scorePct}% · ${r.passed ? t('resultPassed') : t('resultNotPassed')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Link href="/certificates" className="block">
          <Card className="h-full card-hover">
            <CardContent className="flex flex-col gap-3">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Award className="size-5 shrink-0 text-accent-strong" aria-hidden />{' '}
                {t('certificates')}
              </p>
              {data.certificates.length === 0 ? (
                <p className="text-sm text-muted">{t('certificatesText')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {data.certificates.map((c) => (
                    <li key={c.id} className="truncate">
                      {c.courseTitle}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
