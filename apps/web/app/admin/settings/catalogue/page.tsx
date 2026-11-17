import { getTranslations } from 'next-intl/server';
import { CatalogueSettings } from '@/components/admin/catalogue-settings';
import { apiFetch } from '@/lib/api/server';
import type { LanguageItem, LevelItem } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('catalogue');
  return { title: t('title') };
}

export default async function CatalogueSettingsPage() {
  await requireRole(['ADMIN'], '/admin/settings/catalogue');
  const [languages, levels] = await Promise.all([
    apiFetch<{ items: LanguageItem[] }>('/admin/languages'),
    apiFetch<{ items: LevelItem[] }>('/admin/levels'),
  ]);
  return <CatalogueSettings languages={languages.items} levels={levels.items} />;
}
