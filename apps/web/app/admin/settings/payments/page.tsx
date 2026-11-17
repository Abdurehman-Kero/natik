import { getTranslations } from 'next-intl/server';
import { PaymentAccountsManager } from '@/components/admin/payment-accounts';
import type { PaymentAccountView } from '@/lib/api/learn-types';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('paymentAccounts');
  return { title: t('title') };
}

export default async function PaymentAccountsPage() {
  await requireRole(['ADMIN'], '/admin/settings/payments');
  const { items } = await apiFetch<{ items: PaymentAccountView[] }>('/admin/payment-accounts');
  return <PaymentAccountsManager initial={items} />;
}
