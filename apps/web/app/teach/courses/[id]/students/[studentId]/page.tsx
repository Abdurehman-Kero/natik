import { getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/layout/no-access';
import { StudentAttemptsView } from '@/components/teach/student-attempts-view';
import type { StudentAttempts } from '@/lib/api/quiz-types';
import { loadOrDenied } from '@/lib/api/safe';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('teachStudents');
  return { title: t('attemptsTitle') };
}

/** One student's quiz attempts in a course, where a teacher can give an extra attempt (FR-QUIZ-012). */
export default async function StudentAttemptsPage({
  params,
}: {
  params: Promise<{ id: string; studentId: string }>;
}) {
  const { id, studentId } = await params;
  await requireRole(['TEACHER', 'ADMIN'], `/teach/courses/${id}/students/${studentId}`);
  const tp = await getTranslations('pages');
  const result = await loadOrDenied<StudentAttempts>(
    `/teach/courses/${encodeURIComponent(id)}/students/${encodeURIComponent(studentId)}/attempts`,
  );
  if (!result.ok) return <NoAccess backHref="/teach/courses" backLabel={tp('teachCourses')} />;
  return <StudentAttemptsView courseId={id} data={result.data} />;
}
