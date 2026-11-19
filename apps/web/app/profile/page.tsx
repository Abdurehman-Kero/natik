import { getTranslations } from 'next-intl/server';
import { ProfileView } from '@/components/profile/profile-view';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('profile');
  return { title: t('title') };
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string | string[] }>;
}) {
  const user = await requireRole(['STUDENT', 'TEACHER', 'ADMIN'], '/profile');
  const { google } = await searchParams;
  return <ProfileView user={user} googleResult={typeof google === 'string' ? google : null} />;
}
