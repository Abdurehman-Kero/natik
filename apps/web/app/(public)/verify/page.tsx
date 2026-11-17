import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';
import { VerifyForm } from '@/components/public/verify-form';

export async function generateMetadata() {
  const t = await getTranslations('verify');
  return { title: t('title'), description: t('subtitle') };
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string | string[] }>;
}) {
  const t = await getTranslations('verify');
  const n = (await searchParams).n;
  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection size="reading" className="flex flex-col gap-6">
        <p className="text-muted">{t('how')}</p>
        <VerifyForm initialNumber={typeof n === 'string' ? n.slice(0, 20) : ''} />
      </PublicSection>
    </>
  );
}
