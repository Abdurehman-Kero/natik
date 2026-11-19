import { getTranslations } from 'next-intl/server';
import { GroupsApp } from '@/components/groups/groups-app';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('groups');
  return { title: t('title') };
}

/** The group chat of each course: students and teachers learn from one another, admins can join any. */
export default async function GroupsPage() {
  await requireRole(['TEACHER', 'ADMIN'], '/teach/groups');
  return <GroupsApp />;
}
