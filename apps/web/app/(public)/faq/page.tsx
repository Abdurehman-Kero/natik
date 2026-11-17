import { getTranslations } from 'next-intl/server';
import { FaqAccordion, type FaqItem } from '@/components/public/faq-accordion';
import { PageHero } from '@/components/public/page-hero';
import { PublicSection } from '@/components/public/section';
import { LinkButton } from '@/components/ui/button';
import { type PublicFaqItem, publicFetch } from '@/lib/api/public';

export async function generateMetadata() {
  const t = await getTranslations('faq');
  return { title: t('title'), description: t('subtitle') };
}

export default async function FaqPage() {
  const t = await getTranslations('faq');
  // Questions written in Admin › Website win; the built-in ones are the fallback.
  const { items: edited } = await publicFetch<{ items: PublicFaqItem[] }>('/public/faq', {
    items: [],
  });
  const items: FaqItem[] =
    edited.length > 0
      ? edited.map((item) => ({ q: item.question, a: item.answer }))
      : (t.raw('items') as FaqItem[]);

  // Lets search engines show the questions directly in results.
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-built data (no user input).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <PublicSection size="reading" className="flex flex-col gap-10">
        <FaqAccordion items={items} />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-primary-soft p-8 text-center">
          <h2 className="text-xl font-semibold">{t('stillTitle')}</h2>
          <p className="text-ink/80">{t('stillText')}</p>
          <LinkButton href="/contact">{t('stillCta')}</LinkButton>
        </div>
      </PublicSection>
    </>
  );
}
