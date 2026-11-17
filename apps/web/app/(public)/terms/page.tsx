import { getTranslations } from 'next-intl/server';
import { PolicyPage } from '@/components/public/policy-page';

export async function generateMetadata() {
  const t = await getTranslations('terms');
  return { title: t('title'), description: t('subtitle') };
}

export default function TermsPage() {
  return <PolicyPage slug="terms" />;
}
