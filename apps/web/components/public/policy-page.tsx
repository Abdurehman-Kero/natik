import { getTranslations } from 'next-intl/server';
import { type PublicPolicy, publicFetch } from '@/lib/api/public';
import { LegalPage, type LegalSection } from './legal-page';
import { PageHero } from './page-hero';
import { PublicSection } from './section';

/**
 * Privacy and Terms. The text an admin saved in Admin › Website is shown when there is one;
 * otherwise the built-in plain-language draft is shown.
 */
async function builtIn(slug: 'privacy' | 'terms') {
  if (slug === 'privacy') {
    const t = await getTranslations('privacy');
    return {
      title: t('title'),
      subtitle: t('subtitle'),
      updated: t('updated'),
      sections: t.raw('sections') as LegalSection[],
    };
  }
  const t = await getTranslations('terms');
  return {
    title: t('title'),
    subtitle: t('subtitle'),
    updated: t('updated'),
    sections: t.raw('sections') as LegalSection[],
  };
}

export async function PolicyPage({ slug }: { slug: 'privacy' | 'terms' }) {
  const t = await builtIn(slug);
  const tc = await getTranslations('policyPage');
  const policy = await publicFetch<PublicPolicy | null>(`/public/policies/${slug}`, null);

  if (!policy) {
    return (
      <LegalPage title={t.title} subtitle={t.subtitle} updated={t.updated} sections={t.sections} />
    );
  }

  const updated = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Addis_Ababa',
  }).format(new Date(policy.updatedAt));

  return (
    <>
      <PageHero title={policy.title} subtitle={t.subtitle} />
      <PublicSection size="reading">
        <p className="mb-8 text-sm font-medium text-muted">{tc('updated', { date: updated })}</p>
        <div
          className="lesson-prose"
          // Safe: the API builds this HTML from an allow-list of tags (rich-text.ts).
          dangerouslySetInnerHTML={{ __html: policy.html }}
        />
      </PublicSection>
    </>
  );
}
