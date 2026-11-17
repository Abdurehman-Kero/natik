import { getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/layout/no-access';
import { QuizPreviewView } from '@/components/teach/quiz-preview';
import type { QuizPreview } from '@/lib/api/quiz-types';
import { loadOrDenied } from '@/lib/api/safe';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('quizBuilder');
  return { title: t('previewTitle') };
}

/** The quiz exactly as a student takes it. Answers are not saved or marked (FR-QUIZ-004). */
export default async function QuizPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(['TEACHER', 'ADMIN'], `/teach/quizzes/${id}/preview`);
  const tp = await getTranslations('pages');
  const result = await loadOrDenied<QuizPreview>(
    `/teach/quizzes/${encodeURIComponent(id)}/preview`,
  );
  if (!result.ok) return <NoAccess backHref="/teach/courses" backLabel={tp('teachCourses')} />;
  return <QuizPreviewView data={result.data} />;
}
