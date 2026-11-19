import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SignInForm } from '@/components/auth/sign-in-form';
import { HOME_FOR_ROLE } from '@/lib/api/types';
import { getCurrentUser, safeNext } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('auth.signIn');
  return { title: t('title') };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; google?: string | string[] }>;
}) {
  const query = await searchParams;
  const next = safeNext(query.next);
  const google = typeof query.google === 'string' ? query.google : null;
  const user = await getCurrentUser({ tolerant: true });
  if (user) redirect(next ?? HOME_FOR_ROLE[user.role]);
  return <SignInForm next={next} notice={google} />;
}
