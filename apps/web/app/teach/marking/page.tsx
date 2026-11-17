import { getTranslations } from 'next-intl/server';
import { MarkingView } from '@/components/teach/marking-view';
import type { MarkingQueue } from '@/lib/api/quiz-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('marking');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

/** Short answers waiting for a mark. Teachers see their own courses; admins see all (FR-QUIZ-009). */
export default async function MarkingPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireRole(['TEACHER', 'ADMIN'], '/teach/marking');
  const params = await searchParams;
  const filters = {
    courseId: one(params.courseId).slice(0, 60),
    quizId: one(params.quizId).slice(0, 60),
  };
  const query = new URLSearchParams();
  if (filters.courseId) query.set('courseId', filters.courseId);
  if (filters.quizId) query.set('quizId', filters.quizId);
  const queue = await apiFetch<MarkingQueue>(`/teach/marking${query.size ? `?${query}` : ''}`);
  return <MarkingView queue={queue} filters={filters} />;
}
