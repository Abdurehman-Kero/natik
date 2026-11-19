import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GoogleFinishForm } from '@/components/auth/google-finish-form';
import { HOME_FOR_ROLE } from '@/lib/api/types';
import { getCurrentUser } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('auth.google');
  return { title: t('finishTitle') };
}

/** Where "Continue with Google" lands for someone new, to accept the terms before the account is made. */
export default async function GoogleFinishPage() {
  const user = await getCurrentUser({ tolerant: true });
  if (user) redirect(HOME_FOR_ROLE[user.role]);
  return <GoogleFinishForm />;
}
