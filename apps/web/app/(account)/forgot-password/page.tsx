import { getTranslations } from 'next-intl/server';
import { ForgotPasswordFlow } from '@/components/auth/forgot-password-flow';

export async function generateMetadata() {
  const t = await getTranslations('auth.forgot');
  return { title: t('title') };
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordFlow />;
}
