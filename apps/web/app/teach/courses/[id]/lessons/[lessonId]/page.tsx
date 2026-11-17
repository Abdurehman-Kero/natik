import { getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/layout/no-access';
import { LessonEditor } from '@/components/teach/lesson-editor';
import { loadOrDenied } from '@/lib/api/safe';
import type { EditorLesson } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('lessonEditor');
  return { title: t('pageTitle') };
}

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  await requireRole(['TEACHER', 'ADMIN'], `/teach/courses/${id}/lessons/${lessonId}`);
  const t = await getTranslations('pages');
  const lesson = await loadOrDenied<EditorLesson>(`/teach/lessons/${encodeURIComponent(lessonId)}`);
  // The lesson must belong to the course in the address.
  if (!lesson.ok || lesson.data.course.id !== id) {
    return <NoAccess backHref="/teach/courses" backLabel={t('teachCourses')} />;
  }
  return <LessonEditor key={lesson.data.id} initial={lesson.data} />;
}
