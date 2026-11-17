import { getTranslations } from 'next-intl/server';
import { SetPasswordForm } from '@/components/auth/set-password-form';

export async function generateMetadata() {
  const t = await getTranslations('auth.setPassword');
  return { title: t('title') };
}

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = (await searchParams).token;
  return <SetPasswordForm token={typeof token === 'string' ? token : null} />;
}
