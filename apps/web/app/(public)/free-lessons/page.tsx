import { CircleCheck, PlayCircle } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { FreeLessonList } from '@/components/public/free-lesson-list';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { type PublicFreeLesson, publicFetch } from '@/lib/api/public';

export async function generateMetadata() {
  const t = await getTranslations('freeLessons');
  return { title: t('title'), description: t('subtitle') };
}

/** Sample lessons open to everyone, no account needed (FR-CAT-005). */
export default async function FreeLessonsPage() {
  const t = await getTranslations('freeLessons');
  const benefits = t.raw('benefits') as string[];
  const { items } = await publicFetch<{ items: PublicFreeLesson[] }>('/public/free-lessons', {
    items: [],
  });
  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection className="flex flex-col gap-14">
        {items.length > 0 ? (
          <FreeLessonList lessons={items} />
        ) : (
          <Card>
            <EmptyState
              icon={PlayCircle}
              title={t('emptyTitle')}
              description={t('emptyText')}
              action={
                <>
                  <LinkButton href="/courses">{t('browse')}</LinkButton>
                  <LinkButton href="/register" variant="secondary">
                    {t('register')}
                  </LinkButton>
                </>
              }
            />
          </Card>
        )}
        <section aria-labelledby="free-benefits" className="flex flex-col items-center gap-6">
          <h2 id="free-benefits" className="text-center text-2xl font-bold md:text-3xl">
            {t('benefitsTitle')}
          </h2>
          <ul className="grid w-full gap-4 md:grid-cols-3">
            {benefits.map((benefit) => (
              <li
                key={benefit}
                className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 text-center shadow-card"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
                  <CircleCheck className="size-6" aria-hidden />
                </span>
                <span className="text-lg font-medium">{benefit}</span>
              </li>
            ))}
          </ul>
        </section>
      </PublicSection>
    </>
  );
}
