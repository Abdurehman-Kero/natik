'use client';

import {
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Eraser,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { type Column, DataTable } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { Paged, UserView } from '@/lib/api/types';
import { UserFormDialog } from './user-form-dialog';

export interface UsersQuery {
  q: string;
  role: string;
  status: string;
  page: number;
}

function hrefFor(query: UsersQuery, overrides: Partial<UsersQuery>): string {
  const merged = { ...query, ...overrides };
  const params = new URLSearchParams();
  if (merged.q) params.set('q', merged.q);
  if (merged.role) params.set('role', merged.role);
  if (merged.status) params.set('status', merged.status);
  if (merged.page > 1) params.set('page', String(merged.page));
  const text = params.toString();
  return text ? `/admin/users?${text}` : '/admin/users';
}

export function UsersView({
  data,
  query,
  actor,
}: {
  data: Paged<UserView>;
  query: UsersQuery;
  actor: { id: string; isOwner: boolean };
}) {
  const t = useTranslations('users');
  const tp = useTranslations('profile');
  const tt = useTranslations('table');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [search, setSearch] = useState(query.q);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserView | null>(null);
  const [disabling, setDisabling] = useState<UserView | null>(null);
  const [erasing, setErasing] = useState<UserView | null>(null);

  const filtered = Boolean(query.q || query.role || query.status);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function go(overrides: Partial<UsersQuery>) {
    router.push(hrefFor(query, { page: 1, ...overrides }));
  }

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  // Admin accounts can only be managed by the Owner (BR-ROLE-004).
  const canManage = (u: UserView) => u.role !== 'ADMIN' || actor.isOwner || u.id === actor.id;

  const columns: Column<UserView>[] = [
    {
      key: 'name',
      header: t('columns.name'),
      mobile: 'title',
      cell: (u) => (
        <span className="flex items-center gap-3">
          <Avatar name={u.fullName} src={u.photoUrl} size="sm" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-ink">{u.fullName}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'phone',
      header: t('columns.phone'),
      mobile: 'meta',
      cell: (u) => <span className="tabular-nums">{u.phone}</span>,
    },
    {
      key: 'role',
      header: t('columns.role'),
      mobile: 'meta',
      cell: (u) => (
        <span className="inline-flex items-center gap-1">
          {tp(`roles.${u.role}`)}
          {u.isOwner ? (
            <ShieldCheck className="size-4 text-accent-strong" aria-label={t('owner')} />
          ) : null}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      mobile: 'side',
      cell: (u) => (
        <Badge tone={u.status === 'ACTIVE' ? 'success' : 'muted'}>
          {u.status === 'ACTIVE' ? t('active') : t('disabled')}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> {t('newUser')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end">
        <form
          className="min-w-0 flex-1"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            go({ q: search.trim() });
          }}
          role="search"
        >
          <SearchField
            label={t('search')}
            placeholder={t('search')}
            value={search}
            onValueChange={(value) => {
              setSearch(value);
              if (value === '' && query.q) go({ q: '' });
            }}
          />
        </form>
        <div className="grid grid-cols-2 gap-3 md:w-80">
          <Select
            aria-label={t('role')}
            value={query.role}
            onChange={(e) => go({ role: e.target.value })}
            placeholder={t('allRoles')}
            options={[
              { value: '', label: t('allRoles') },
              { value: 'STUDENT', label: tp('roles.STUDENT') },
              { value: 'TEACHER', label: tp('roles.TEACHER') },
              { value: 'ADMIN', label: tp('roles.ADMIN') },
            ]}
          />
          <Select
            aria-label={t('status')}
            value={query.status}
            onChange={(e) => go({ status: e.target.value })}
            placeholder={t('allStatuses')}
            options={[
              { value: '', label: t('allStatuses') },
              { value: 'ACTIVE', label: t('active') },
              { value: 'DISABLED', label: t('disabled') },
            ]}
          />
        </div>
      </div>

      <DataTable
        caption={t('title')}
        columns={columns}
        rows={data.items}
        getRowId={(u) => u.id}
        empty={
          <EmptyState
            icon={Users}
            title={t('empty')}
            description={t('emptyText')}
            action={
              filtered ? (
                <Button asChild variant="secondary">
                  <Link href="/admin/users">{t('clear')}</Link>
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={(u) =>
          canManage(u) ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={tt('rowActions', { name: u.fullName })}>
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditing(u)}>
                  <Pencil aria-hidden /> {t('edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    run(
                      () => api(`/admin/users/${u.id}/password-link`, { method: 'POST' }),
                      t('linkSent'),
                    )
                  }
                >
                  <Send aria-hidden /> {t('sendLink')}
                </DropdownMenuItem>
                {u.id !== actor.id ? (
                  <>
                    <DropdownMenuSeparator />
                    {u.status === 'ACTIVE' ? (
                      <DropdownMenuItem tone="danger" onSelect={() => setDisabling(u)}>
                        <PowerOff aria-hidden /> {t('disable')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() =>
                          run(
                            () => api(`/admin/users/${u.id}/enable`, { method: 'POST' }),
                            t('enabledToast'),
                          )
                        }
                      >
                        <Power aria-hidden /> {t('enable')}
                      </DropdownMenuItem>
                    )}
                    {u.role !== 'ADMIN' && !u.erased ? (
                      <DropdownMenuItem tone="danger" onSelect={() => setErasing(u)}>
                        <Eraser aria-hidden /> {t('erase')}
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      <Pagination
        className="mt-6"
        page={query.page}
        totalPages={totalPages}
        hrefFor={(page) => hrefFor(query, { page })}
      />

      <UserFormDialog open={creating} onOpenChange={setCreating} user={null} actor={actor} />
      <UserFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        user={editing}
        actor={actor}
      />
      <ConfirmDialog
        open={erasing !== null}
        onOpenChange={(open) => !open && setErasing(null)}
        title={t('eraseTitle')}
        description={erasing ? t('eraseText', { name: erasing.fullName }) : undefined}
        confirmLabel={t('eraseCta')}
        tone="danger"
        requireReason
        reasonLabel={t('eraseReason')}
        onConfirm={async (reason) => {
          if (!erasing) return;
          try {
            await api(`/admin/users/${erasing.id}/erase`, { method: 'POST', json: { reason } });
            toast.success(t('erasedToast'));
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
      <ConfirmDialog
        open={disabling !== null}
        onOpenChange={(open) => !open && setDisabling(null)}
        title={t('disableTitle')}
        description={disabling ? t('disableText', { name: disabling.fullName }) : undefined}
        confirmLabel={t('disableCta')}
        onConfirm={async () => {
          if (!disabling) return;
          try {
            await api(`/admin/users/${disabling.id}/disable`, { method: 'POST' });
            toast.success(t('disabledToast'));
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />
    </>
  );
}
