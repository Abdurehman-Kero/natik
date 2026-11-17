'use client';

import { formatDate } from '@natik/shared';
import { ChevronRight, ScrollText } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { TextField } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/layout';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { api } from '@/lib/api/client';
import type { ActivityDetail, ActivityList } from '@/lib/api/ops-types';

const GROUPS = [
  'SIGN_IN',
  'ACCOUNTS',
  'ENROLMENTS',
  'PAYMENTS',
  'MARKS',
  'CERTIFICATES',
  'COURSES',
  'OTHER',
] as const;

/** "PAYMENT_CONFIRMED" → "Payment confirmed". */
export function humanize(action: string): string {
  const text = action.toLowerCase().replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const time = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));

/** The read-only activity log: filter, scan, open a row for its details (FR-REP-004). No edit or delete anywhere. */
export function ActivityView({
  data,
  filters,
}: {
  data: ActivityList;
  filters: { group: string; actorId: string; from: string; to: string };
}) {
  const t = useTranslations('activityLog');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [group, setGroup] = useState(filters.group);
  const [actorId, setActorId] = useState(filters.actorId);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [open, setOpen] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  function apply(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (group) next.set('group', group);
    if (actorId) next.set('actorId', actorId);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  async function show(id: string) {
    setLoading(id);
    try {
      setOpen(await api<ActivityDetail>(`/admin/activity/${id}`));
    } finally {
      setLoading(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const hrefFor = (page: number) => {
    const next = new URLSearchParams(search.toString());
    next.set('page', String(page));
    return `${pathname}?${next}`;
  };

  // Group rows by day, like a timeline.
  const days = new Map<string, ActivityList['items']>();
  for (const item of data.items) {
    const key = formatDate(item.createdAt);
    days.set(key, [...(days.get(key) ?? []), item]);
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <form
        onSubmit={apply}
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="sm:w-52">
          <Select
            aria-label={t('group')}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder={t('allActions')}
            options={GROUPS.map((g) => ({ value: g, label: t(`groups.${g}`) }))}
          />
        </div>
        <div className="sm:w-52">
          <Select
            aria-label={t('person')}
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            placeholder={t('allPeople')}
            options={data.actors.map((a) => ({ value: a.id, label: a.fullName }))}
          />
        </div>
        <TextField
          label={t('from')}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <TextField label={t('to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button type="submit" variant="secondary">
          {t('apply')}
        </Button>
      </form>

      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={ScrollText} title={t('emptyTitle')} description={t('emptyText')} />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {[...days].map(([day, items]) => (
            <section key={day} aria-label={day}>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">
                {day}
              </h2>
              <Card>
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => void show(item.id)}
                        disabled={loading === item.id}
                        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
                      >
                        <span className="w-12 shrink-0 text-sm text-muted tabular-nums">
                          {time(item.createdAt)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">
                            {humanize(item.action)}
                            <span className="font-normal text-muted">
                              {' '}
                              · {item.actor?.name ?? t('system')}
                            </span>
                          </span>
                          {item.subject ? (
                            <span className="block truncate text-sm text-muted">
                              {item.subject}
                            </span>
                          ) : null}
                        </span>
                        <ChevronRight
                          className="size-5 shrink-0 text-muted rtl:rotate-180"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}

      <Pagination className="mt-6" page={data.page} totalPages={totalPages} hrefFor={hrefFor} />

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open ? (
            <>
              <DialogTitle>{humanize(open.action)}</DialogTitle>
              <DialogDescription>{t('detailsTitle')}</DialogDescription>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted">{t('when')}</dt>
                <dd>
                  {formatDate(open.createdAt)}, {time(open.createdAt)}
                </dd>
                <dt className="text-muted">{t('who')}</dt>
                <dd>{open.actor?.name ?? t('system')}</dd>
                {open.subject ? (
                  <>
                    <dt className="text-muted">{t('about')}</dt>
                    <dd>{open.subject}</dd>
                  </>
                ) : null}
                {open.details
                  ? Object.entries(open.details).map(([key, value]) => (
                      <div key={key} className="contents">
                        <dt className="text-muted">{humanize(key)}</dt>
                        <dd className="break-words">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </dd>
                      </div>
                    ))
                  : null}
                {open.ip ? (
                  <>
                    <dt className="text-muted">{t('address')}</dt>
                    <dd dir="ltr">{open.ip}</dd>
                  </>
                ) : null}
              </dl>
              {!open.details && !open.subject ? (
                <p className="mt-3 text-sm text-muted">{t('nothingElse')}</p>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
