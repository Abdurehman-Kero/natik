import { Eye } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/layout/no-access';
import { LessonView } from '@/components/lesson/lesson-view';
import { LinkButton } from '@/components/ui/button';
import { loadOrDenied } from '@/lib/api/safe';
import type { LessonViewModel } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('lessonEditor');
  return { title: t('previewTitle') };
}

/** The lesson exactly as a student sees it (the same component and data, FR-TEACH-004). */
export default async function LessonPreviewPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  await requireRole(['TEACHER', 'ADMIN'], `/teach/courses/${id}/lessons/${lessonId}/preview`);
  const t = await getTranslations('lessonEditor');
  const tp = await getTranslations('pages');
  const view = await loadOrDenied<LessonViewModel>(
    `/teach/lessons/${encodeURIComponent(lessonId)}/view`,
  );
  if (!view.ok || view.data.course.id !== id) {
    return <NoAccess backHref="/teach/courses" backLabel={tp('teachCourses')} />;
  }
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl bg-accent-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Eye className="size-4 shrink-0" aria-hidden /> {t('previewBanner')}
        </p>
        <LinkButton href={`/teach/courses/${id}/lessons/${lessonId}`} variant="secondary" size="sm">
          {t('backToEditor')}
        </LinkButton>
      </div>
      <LessonView lesson={view.data} />
    </div>
  );
}
