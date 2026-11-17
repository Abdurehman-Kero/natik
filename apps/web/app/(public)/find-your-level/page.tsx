import { ClipboardCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/public/page-hero';
import { PlacementCheck } from '@/components/public/placement-check';
import { PublicSection } from '@/components/public/section';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { publicFetch } from '@/lib/api/public';

export async function generateMetadata() {
  const t = await getTranslations('placement');
  return { title: t('title'), description: t('subtitle') };
}

/** A short check, no account needed, that suggests where to start (Beginner to Advanced). */
export default async function FindYourLevelPage() {
  const t = await getTranslations('placement');
  const { items } = await publicFetch<{
    items: { name: string; code: string; direction: 'LTR' | 'RTL' }[];
  }>('/public/placement', { items: [] });
  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection>
        {items.length > 0 ? (
          <PlacementCheck languages={items} />
        ) : (
          <Card className="mx-auto max-w-lg">
            <EmptyState
              icon={ClipboardCheck}
              title={t('unavailableTitle')}
              description={t('unavailableText')}
              action={<LinkButton href="/courses">{t('seeCourses')}</LinkButton>}
            />
          </Card>
        )}
      </PublicSection>
    </>
  );
}
