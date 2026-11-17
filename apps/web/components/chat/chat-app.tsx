'use client';

import { MessageCircle, SquarePen, Trash2, UsersRound } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ConfirmDialog } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { api, useErrorMessage } from '@/lib/api/client';
import { refreshCounts } from '@/lib/use-live-counts';
import { listTime } from '@/lib/chat/format';
import type { ChatListItem } from '@/lib/chat/types';
import { ChatThread } from './chat-thread';
import { NewChatDialog } from './new-chat-dialog';

const LIST_POLL_MS = 10_000;

/**
 * Messages for students, teachers and admins: the chat list and the open conversation side by side
 * on larger screens, one at a time on a phone. Looks and works like Telegram.
 */
export function ChatApp({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations('chat');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get('c');
  const to = params.get('to');
  const [list, setList] = useState<ChatListItem[] | null>(null);
  const [dialog, setDialog] = useState(false);
  const [removing, setRemoving] = useState<ChatListItem | null>(null);
  const errorMessage = useErrorMessage();

  const refresh = useCallback(() => {
    api<{ items: ChatListItem[] }>('/chat/conversations')
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

  // A "Message" link elsewhere (for example a teacher's student list) opens that person's chat.
  useEffect(() => {
    if (!to) return;
    let cancelled = false;
    api<{ id: string }>('/chat/conversations', { method: 'POST', json: { with: to } })
      .then(({ id }) => {
        if (cancelled) return;
        refresh();
        router.replace(`${pathname}?c=${encodeURIComponent(id)}`, { scroll: false });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(errorMessage(error));
        router.replace(pathname, { scroll: false });
      });
    return () => {
      cancelled = true;
    };
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps -- run once per link

  const open = (id: string | null) =>
    router.push(id ? `${pathname}?c=${encodeURIComponent(id)}` : pathname, { scroll: false });

  // Opening a chat marks it read; refresh the layout once so the menu badge updates.
  const onActivity = useCallback(() => {
    refresh();
    refreshCounts();
    router.refresh();
  }, [refresh, router]);

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] min-h-[26rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-card md:h-[calc(100dvh-8.5rem)]">
      <aside
        className={cn(
          'w-full flex-col border-border md:flex md:w-80 md:shrink-0 md:border-e lg:w-96',
          active ? 'hidden' : 'flex',
        )}
        aria-label={t('conversations')}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <h1 className="font-sans text-lg font-semibold">{t('title')}</h1>
          <Button size="sm" variant="ghost" onClick={() => setDialog(true)}>
            <SquarePen aria-hidden /> {t('newChat')}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {list === null ? null : list.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
                <MessageCircle className="size-7" aria-hidden />
              </span>
              <p className="font-semibold">{t('empty')}</p>
              <p className="text-muted">{isAdmin ? t('typeToSearch') : t('emptyText')}</p>
              <Button onClick={() => setDialog(true)}>{t('newChat')}</Button>
            </div>
          ) : (
            <ul>
              {list.map((c) => (
                <li key={c.id}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() => open(c.id)}
                        aria-current={active === c.id ? 'true' : undefined}
                        className={cn(
                          'flex min-h-[4.5rem] w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-start hover:bg-primary-soft',
                          active === c.id && 'bg-primary-soft',
                        )}
                      >
                        {c.team ? (
                          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                            <UsersRound className="size-5" aria-hidden />
                          </span>
                        ) : (
                          <Avatar name={c.title} src={c.avatarUrl} size="lg" decorative />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate font-semibold">{c.title}</span>
                            <span className="shrink-0 text-xs text-muted">
                              {listTime(c.lastMessageAt, { yesterday: t('yesterday') })}
                            </span>
                          </span>
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-sm',
                                c.unread ? 'font-medium text-ink' : 'text-muted',
                              )}
                            >
                              {c.lastMessageText ?? c.subtitle}
                            </span>
                            {c.unread > 0 ? (
                              <span
                                className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white"
                                aria-label={`${c.unread} ${t('unread')}`}
                              >
                                {c.unread}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem tone="danger" onSelect={() => setRemoving(c)}>
                        <Trash2 aria-hidden /> {t('deleteChat')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className={cn('min-w-0 flex-1 flex-col md:flex', active ? 'flex' : 'hidden')}>
        {active ? (
          <ChatThread key={active} id={active} onBack={() => open(null)} onActivity={onActivity} />
        ) : (
          <div className="m-auto flex max-w-xs flex-col items-center gap-2 p-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
              <MessageCircle className="size-7" aria-hidden />
            </span>
            <p className="font-semibold">{t('pick')}</p>
            <p className="text-muted">{t('pickText')}</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('deleteChatTitle')}
        description={t('deleteChatText')}
        confirmLabel={t('deleteChat')}
        tone="danger"
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api(`/chat/conversations/${removing.id}/clear`, { method: 'POST' });
            if (active === removing.id) open(null);
            refresh();
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error));
            throw error;
          }
        }}
      />

      <NewChatDialog
        open={dialog}
        onOpenChange={setDialog}
        isAdmin={isAdmin}
        onOpened={(id) => {
          refresh();
          open(id);
        }}
      />
    </div>
  );
}
