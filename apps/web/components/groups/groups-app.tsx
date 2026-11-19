'use client';

import { UsersRound } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api/client';
import { PersonCardProvider } from '@/components/people/person-card';
import { cn } from '@/lib/cn';
import { listTime } from '@/lib/chat/format';
import type { GroupListItem } from '@/lib/groups/types';
import { refreshCounts } from '@/lib/use-live-counts';
import { GroupThread } from './group-thread';

const LIST_POLL_MS = 10_000;

/**
 * Course groups for students, teachers and admins: the list of groups and the open one side by side on
 * larger screens, one at a time on a phone. Looks and works like a Telegram group.
 */
export function GroupsApp() {
  const t = useTranslations('groups');
  const tc = useTranslations('chat');
  const router = useRouter();
  const pathname = usePathname();
  const active = useSearchParams().get('c');
  const [list, setList] = useState<GroupListItem[] | null>(null);

  const refresh = useCallback(() => {
    api<{ items: GroupListItem[] }>('/groups')
      .then((r) => setList(r.items))
      .catch(() => setList((current) => current ?? []));
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const open = useCallback(
    (id: string | null, replace = false) => {
      const href = id ? `${pathname}?c=${encodeURIComponent(id)}` : pathname;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router],
  );

  // One group only: open it straight away.
  useEffect(() => {
    if (!active && list && list.length === 1) open(list[0]!.courseId, true);
  }, [active, list, open]);

  const onActivity = useCallback(() => {
    refresh();
    refreshCounts();
  }, [refresh]);

  return (
    <PersonCardProvider>
      <div className="flex h-[calc(100dvh-10.5rem)] min-h-[26rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-card md:h-[calc(100dvh-8.5rem)]">
        <aside
          className={cn(
            'w-full flex-col border-border md:flex md:w-80 md:shrink-0 md:border-e lg:w-96',
            active ? 'hidden' : 'flex',
          )}
          aria-label={t('listLabel')}
        >
          <div className="flex items-center border-b border-border px-4 py-3">
            <h1 className="font-sans text-lg font-semibold">{t('title')}</h1>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list === null ? null : list.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <UsersRound className="size-7" aria-hidden />
                </span>
                <p className="font-semibold">{t('noGroups')}</p>
                <p className="text-muted">{t('noGroupsText')}</p>
              </div>
            ) : (
              <ul>
                {list.map((g) => (
                  <li key={g.courseId}>
                    <button
                      type="button"
                      onClick={() => open(g.courseId)}
                      aria-current={active === g.courseId ? 'true' : undefined}
                      className={cn(
                        'flex min-h-[4.5rem] w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-start hover:bg-primary-soft',
                        active === g.courseId && 'bg-primary-soft',
                      )}
                    >
                      <Avatar name={g.title} src={g.imageUrl} size="lg" decorative />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate font-semibold">{g.title}</span>
                          {g.lastMessageAt ? (
                            <span className="shrink-0 text-xs text-muted">
                              {listTime(g.lastMessageAt, { yesterday: tc('yesterday') })}
                            </span>
                          ) : null}
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-sm',
                              g.unread ? 'font-medium text-ink' : 'text-muted',
                            )}
                          >
                            {g.lastMessageText ?? t('noMessages')}
                          </span>
                          {g.unread > 0 ? (
                            <span
                              className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white"
                              aria-label={`${g.unread} ${tc('unread')}`}
                            >
                              {g.unread > 99 ? '99+' : g.unread}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className={cn('min-w-0 flex-1 flex-col md:flex', active ? 'flex' : 'hidden')}>
          {active ? (
            <GroupThread
              key={active}
              courseId={active}
              onBack={() => open(null)}
              onActivity={onActivity}
            />
          ) : (
            <div className="m-auto flex max-w-xs flex-col items-center gap-2 p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                <UsersRound className="size-7" aria-hidden />
              </span>
              <p className="font-semibold">{t('pick')}</p>
              <p className="text-muted">{t('pickText')}</p>
            </div>
          )}
        </div>
      </div>
    </PersonCardProvider>
  );
}
