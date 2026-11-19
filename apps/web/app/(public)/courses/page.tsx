import { getTranslations } from 'next-intl/server';
import { CourseCatalogue } from '@/components/public/catalogue';
import { NextSteps } from '@/components/public/next-steps';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Container } from '@/components/ui/layout';

export async function generateMetadata() {
  const t = await getTranslations('courses');
  return { title: t('title'), description: t('subtitle') };
}

type Params = Record<string, string | string[] | undefined>;

export default async function CoursesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const t = await getTranslations('courses');
  const tn = await getTranslations('site.nav');
  const params = await searchParams;
  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-2 py-6 md:py-8">
          <Breadcrumb
            label={tn('breadcrumb')}
            items={[{ label: tn('home'), href: '/' }, { label: t('title') }]}
          />
          <h1 className="text-[1.75rem] font-bold md:text-4xl">{t('title')}</h1>
          <p className="max-w-2xl text-muted md:text-lg">{t('subtitle')}</p>
        </Container>
      </section>
      <section className="py-8 md:py-12">
        <Container>
          <CourseCatalogue basePath="/courses" params={params} />
        </Container>
      </section>
      <NextSteps items={['level', 'message', 'tour']} />
    </>
  );
}
