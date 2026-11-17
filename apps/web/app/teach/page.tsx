import { ClipboardCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { TeacherCourses } from '@/components/teach/teacher-courses';
import { LinkButton } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/layout';
import { StatCard } from '@/components/ui/stat-card';
import type { TeacherHome } from '@/lib/api/ops-types';
import { apiFetch } from '@/lib/api/server';
import type { TeacherCourse } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('teach');
  return { title: t('dashboardTitle') };
}

/** The teacher's home: how many courses and students, what waits for marking, then their courses (FR-TEACH-001). */
export default async function TeacherDashboardPage() {
  const user = await requireRole(['TEACHER', 'ADMIN'], '/teach');
  const t = await getTranslations('teach');
  const th = await getTranslations('teachHome');
  const [{ items }, home] = await Promise.all([
    apiFetch<{ items: TeacherCourse[] }>('/teach/courses'),
    apiFetch<TeacherHome>('/teach/dashboard'),
  ]);
  return (
    <>
      <PageHeader
        title={t('hello', { name: user.fullName.split(' ')[0] ?? user.fullName })}
        subtitle={t('dashboardSubtitle')}
        action={
          home.toMark > 0 ? (
            <LinkButton href="/teach/marking">
              <ClipboardCheck aria-hidden /> {th('startMarking')}
            </LinkButton>
          ) : undefined
        }
      />
      <section
        aria-label={t('dashboardTitle')}
        className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <StatCard value={home.courseCount} label={th('courses')} />
        <StatCard value={home.studentCount} label={th('students')} />
        <StatCard
          value={home.toMark}
          label={th('toMark')}
          href="/teach/marking"
          actionLabel={home.toMark > 0 ? th('startMarking') : th('nothingToMark')}
          highlight={home.toMark > 0}
          className="col-span-2 sm:col-span-1"
        />
      </section>
      <TeacherCourses courses={items} />
    </>
  );
}
