import { getTranslations } from 'next-intl/server';
import { HelpGuide } from '@/components/help/help-guide';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('guide');
  return { title: t('title') };
}

/** Help for students: a video that shows the whole journey, and the same steps in writing. */
export default async function StudentGuidePage() {
  await requireRole(['STUDENT'], '/guide');
  return <HelpGuide role="student" />;
}
