import { getTranslations } from 'next-intl/server';
import { NewsFeed } from '@/components/learn/news-feed';
import { PageHeader } from '@/components/ui/layout';
import type { NewsItem } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('studentNews');
  return { title: t('title') };
}

export default async function StudentAnnouncementsPage() {
  await requireRole(['STUDENT'], '/announcements');
  const t = await getTranslations('studentNews');
  const { items } = await apiFetch<{ items: NewsItem[] }>('/me/announcements');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <NewsFeed initial={items} />
    </>
  );
}
