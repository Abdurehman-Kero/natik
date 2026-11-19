import { UsersRound } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { TeacherCard } from '@/components/public/home-extras';
import { NextSteps } from '@/components/public/next-steps';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { type PublicTeacher, publicFetch } from '@/lib/api/public';

export async function generateMetadata() {
  const t = await getTranslations('teachersPage');
  return { title: t('title'), description: t('subtitle') };
}

/** The teachers who chose to appear on the website. */
export default async function TeachersPage() {
  const t = await getTranslations('teachersPage');
  const { items } = await publicFetch<{ items: PublicTeacher[] }>('/public/teachers', {
    items: [],
  });
  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection>
        {items.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-5">
            {items.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} columns={3} />
            ))}
          </ul>
        ) : (
          <Card className="mx-auto max-w-lg">
            <EmptyState
              icon={UsersRound}
              title={t('emptyTitle')}
              description={t('emptyText')}
              action={<LinkButton href="/courses">{t('seeCourses')}</LinkButton>}
            />
          </Card>
        )}
      </PublicSection>
      <NextSteps items={['courses', 'level', 'message']} tone="canvas" />
    </>
  );
}
