import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/register-form';
import { apiFetch } from '@/lib/api/server';
import { HOME_FOR_ROLE, type LanguageOption } from '@/lib/api/types';
import { getCurrentUser, safeNext } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('auth.register');
  return { title: t('title') };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getCurrentUser({ tolerant: true });
  if (user) redirect(next ?? HOME_FOR_ROLE[user.role]);

  // The language choice is optional: if the list can't load, the form still works.
  const languages = await apiFetch<{ items: LanguageOption[] }>('/public/languages')
    .then((r) => r.items)
    .catch(() => []);
  return <RegisterForm languages={languages} next={next} />;
}
