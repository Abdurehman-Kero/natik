import { formatDate } from '@natik/shared';
import { CreditCard, FilePlus, Mail, Megaphone, UsersRound, UserPlus } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { LinkButton } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeading } from '@/components/ui/layout';
import { StatCard } from '@/components/ui/stat-card';
import type { AdminDashboard } from '@/lib/api/ops-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('adminHome');
  return { title: t('title') };
}

/** The admin's "what needs me today?" page: queues first, then how the centre is doing (FR-ADMIN-001). */
export default async function AdminDashboardPage() {
  const user = await requireRole(['ADMIN'], '/admin');
  const t = await getTranslations('adminHome');
  const data = await apiFetch<AdminDashboard>('/admin/dashboard');
  const max = Math.max(1, ...data.activeByCourse.map((c) => c.count));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-[1.625rem] font-bold md:text-4xl">
          {t('greeting', { name: user.fullName.split(' ')[0] ?? user.fullName })}
        </h1>
        <p className="text-muted">{formatDate(new Date())}</p>
      </header>

      <section aria-label={t('title')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard value={data.students} label={t('students')} icon={UsersRound} />
        <StatCard value={`+${data.newThisWeek}`} label={t('newThisWeek')} icon={UserPlus} />
        <StatCard
          value={data.paymentsToCheck}
          label={t('payments')}
          icon={CreditCard}
          href="/admin/payments"
          actionLabel={data.paymentsToCheck > 0 ? t('reviewNow') : t('allClear')}
          highlight={data.paymentsToCheck > 0}
        />
        <StatCard
          value={data.newMessages}
          label={t('messages')}
          icon={Mail}
          href="/admin/messages"
          actionLabel={data.newMessages > 0 ? t('openInbox') : t('noMessages')}
          highlight={data.newMessages > 0}
        />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title={t('activeTitle')}
          link={{ href: '/admin/reports?type=enrolments', label: t('reports') }}
        />
        <Card>
          {data.activeByCourse.length === 0 ? (
            <EmptyState icon={UsersRound} title={t('activeEmpty')} />
          ) : (
            <CardContent>
              <ul className="flex flex-col gap-4">
                {data.activeByCourse.map((c) => (
                  <li key={c.courseId} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate font-medium">{c.title}</span>
                      <span className="font-semibold tabular-nums">{c.count}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-primary-soft" aria-hidden>
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(3, Math.round((c.count / max) * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title={t('quickTitle')} />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <LinkButton href="/admin/payments" variant="secondary">
            <CreditCard aria-hidden /> {t('recordCash')}
          </LinkButton>
          <LinkButton href="/admin/courses/new" variant="secondary">
            <FilePlus aria-hidden /> {t('newCourse')}
          </LinkButton>
          <LinkButton href="/admin/announcements" variant="secondary">
            <Megaphone aria-hidden /> {t('postAnnouncement')}
          </LinkButton>
        </div>
      </section>
    </div>
  );
}
