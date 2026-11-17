import { getTranslations } from 'next-intl/server';
import { UsersView } from '@/components/admin/users-view';
import { apiFetch } from '@/lib/api/server';
import type { Paged, UserView } from '@/lib/api/types';
import { requireRole } from '@/lib/auth';

export async function generateMetadata() {
  const t = await getTranslations('users');
  return { title: t('title') };
}

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requireRole(['ADMIN'], '/admin/users');
  const params = await searchParams;
  const query = {
    q: one(params.q).slice(0, 100),
    role: ['STUDENT', 'TEACHER', 'ADMIN'].includes(one(params.role)) ? one(params.role) : '',
    status: ['ACTIVE', 'DISABLED'].includes(one(params.status)) ? one(params.status) : '',
    page: Math.max(1, Number.parseInt(one(params.page), 10) || 1),
  };

  const search = new URLSearchParams({ page: String(query.page), pageSize: '20' });
  if (query.q) search.set('q', query.q);
  if (query.role) search.set('role', query.role);
  if (query.status) search.set('status', query.status);

  const data = await apiFetch<Paged<UserView>>(`/admin/users?${search}`);
  return <UsersView data={data} query={query} actor={{ id: actor.id, isOwner: actor.isOwner }} />;
}
