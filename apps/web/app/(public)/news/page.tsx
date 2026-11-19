import { Newspaper } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { NewsList } from '@/components/public/news-list';
import { NextSteps } from '@/components/public/next-steps';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { type PublicAnnouncement, publicFetch } from '@/lib/api/public';

export async function generateMetadata() {
  const t = await getTranslations('news');
  return { title: t('title'), description: t('subtitle') };
}

export default async function NewsPage() {
  const t = await getTranslations('news');
  const { items } = await publicFetch<{ items: PublicAnnouncement[] }>(
    '/public/announcements?limit=20',
    {
      items: [],
    },
  );
  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection size="reading">
        {items.length > 0 ? (
          <NewsList items={items} />
        ) : (
          <Card>
            <EmptyState icon={Newspaper} title={t('emptyTitle')} description={t('emptyText')} />
          </Card>
        )}
      </PublicSection>
      <NextSteps items={['courses', 'join']} />
    </>
  );
}
