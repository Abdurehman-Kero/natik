import { getTranslations } from 'next-intl/server';
import { ContactDetails } from '@/components/public/contact-details';
import { ContactForm } from '@/components/public/contact-form';
import { NextSteps } from '@/components/public/next-steps';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';

export async function generateMetadata() {
  const t = await getTranslations('contact');
  return { title: t('title'), description: t('subtitle') };
}

/** The form comes first on phones; the details sit beside it on larger screens. */
export default async function ContactPage() {
  const t = await getTranslations('contact');
  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <ContactForm />
        <ContactDetails />
      </PublicSection>
      <NextSteps items={['courses', 'level']} />
    </>
  );
}
