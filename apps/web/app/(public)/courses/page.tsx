import { getTranslations } from 'next-intl/server';
import { CourseCatalogue } from '@/components/public/catalogue';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';

export async function generateMetadata() {
  const t = await getTranslations('courses');
  return { title: t('title'), description: t('subtitle') };
}

type Params = Record<string, string | string[] | undefined>;

export default async function CoursesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const t = await getTranslations('courses');
  const params = await searchParams;
  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection className="flex flex-col gap-10">
        <CourseCatalogue basePath="/courses" params={params} />
      </PublicSection>
    </>
  );
}
