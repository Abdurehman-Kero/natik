import { getTranslations } from 'next-intl/server';
import { HelpGuide } from '@/components/help/help-guide';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('guide');
  return { title: t('title') };
}

/** Help for teachers: a video on how to run a course on Natik, and the same steps in writing. */
export default async function TeacherGuidePage() {
  await requireRole(['TEACHER', 'ADMIN'], '/teach/guide');
  return <HelpGuide role="teacher" />;
}
