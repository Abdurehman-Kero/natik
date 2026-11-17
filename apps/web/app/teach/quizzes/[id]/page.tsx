import { getTranslations } from 'next-intl/server';
import { NoAccess } from '@/components/layout/no-access';
import { QuizBuilder } from '@/components/teach/quiz-builder';
import type { BuilderQuiz } from '@/lib/api/quiz-types';
import { loadOrDenied } from '@/lib/api/safe';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('lessonEditor');
  return { title: t('quizTitle') };
}

/** The quiz builder (FR-TEACH-005): questions and settings for one lesson's quiz. */
export default async function QuizBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(['TEACHER', 'ADMIN'], `/teach/quizzes/${id}`);
  const tp = await getTranslations('pages');
  const result = await loadOrDenied<BuilderQuiz>(`/teach/quizzes/${encodeURIComponent(id)}`);
  if (!result.ok) return <NoAccess backHref="/teach/courses" backLabel={tp('teachCourses')} />;
  return <QuizBuilder initial={result.data} />;
}
