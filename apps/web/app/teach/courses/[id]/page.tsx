import { getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/layout/no-access';
import { OutlineEditor } from '@/components/teach/outline-editor';
import { loadOrDenied } from '@/lib/api/safe';
import type { Outline } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('teachCourses') };
}

export default async function CourseContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(['TEACHER', 'ADMIN'], `/teach/courses/${id}`);
  const t = await getTranslations('pages');
  const outline = await loadOrDenied<Outline>(`/teach/courses/${encodeURIComponent(id)}/outline`);
  if (!outline.ok) return <NoAccess backHref="/teach/courses" backLabel={t('teachCourses')} />;
  return <OutlineEditor initial={outline.data} />;
}
