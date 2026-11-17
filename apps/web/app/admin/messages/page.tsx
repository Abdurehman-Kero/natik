import { getTranslations } from 'next-intl/server';
import { type InboxData, MessagesView } from '@/components/admin/messages-view';
import { apiFetch } from '@/lib/api/server';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('pages');
  return { title: t('messages') };
}

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(['ADMIN'], '/admin/messages');
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = raw === 'CLOSED' ? 'CLOSED' : 'NEW';
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? '', 10) || 1);
  const data = await apiFetch<InboxData>(
    `/admin/messages?status=${status}&page=${page}&pageSize=20`,
  );
  return <MessagesView data={data} status={status} page={page} />;
}
