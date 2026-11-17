import { getTranslations } from 'next-intl/server';
import { CourseCatalogue } from '@/components/public/catalogue';
import { PageHeader } from '@/components/ui/layout';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('courses');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;

/** Browse courses without leaving the student area: the same catalogue as the public Courses page. */
export default async function BrowseCoursesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  await requireRole(['STUDENT'], '/browse');
  const t = await getTranslations('courses');
  const params = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <CourseCatalogue basePath="/browse" params={params} signedIn />
    </div>
  );
}
