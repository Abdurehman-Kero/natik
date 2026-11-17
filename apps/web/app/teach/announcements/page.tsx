import { getTranslations } from 'next-intl/server';
import {
  type AnnouncementsData,
  AnnouncementsManager,
} from '@/components/announcements/announcements-manager';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('announcements') };
}

export default async function TeacherAnnouncementsPage() {
  await requireRole(['TEACHER', 'ADMIN'], '/teach/announcements');
  const data = await apiFetch<AnnouncementsData>('/teach/announcements');
  return <AnnouncementsManager data={data} mode="teacher" />;
}
