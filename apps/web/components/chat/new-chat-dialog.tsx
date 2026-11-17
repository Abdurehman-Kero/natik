'use client';

import { Search, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { ChatContact } from '@/lib/chat/types';

/** Pick who to chat with: the Natik team and teachers or students you share a course with; admins search by name. */
export function NewChatDialog({
  open,
  onOpenChange,
  isAdmin,
  onOpened,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onOpened: (conversationId: string) => void;
}) {
  const t = useTranslations('chat');
  const message = useErrorMessage();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ChatContact[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      api<{ items: ChatContact[] }>(`/chat/contacts?q=${encodeURIComponent(q)}`)
        .then((r) => active && setItems(r.items))
        .catch((e) => {
          if (active) toast.error(message(e));
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, q]); // eslint-disable-line react-hooks/exhaustive-deps -- `message` changes every render

  async function start(contact: ChatContact) {
    setBusy(contact.id);
    try {
      const { id } = await api<{ id: string }>('/chat/conversations', {
        method: 'POST',
        json: { with: contact.id },
      });
      onOpenChange(false);
      setQ('');
      onOpened(id);
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('newTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('searchPlaceholder')}</DialogDescription>
        <div className="mt-4 flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">{t('searchPlaceholder')}</span>
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-11 w-full rounded-xl border border-border-strong bg-surface ps-10 pe-3 text-base outline-none focus:border-primary"
            />
          </label>
          {items === null ? null : items.length === 0 ? (
            <p className="py-6 text-center text-muted">
              {isAdmin ? t('typeToSearch') : t('noContacts')}
            </p>
          ) : (
            <ul className="-mx-2 flex max-h-80 flex-col overflow-y-auto">
              {items.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => void start(c)}
                    disabled={busy !== null}
                    className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-start hover:bg-primary-soft disabled:opacity-60"
                  >
                    {c.id === 'TEAM' ? (
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <UsersRound className="size-5" aria-hidden />
                      </span>
                    ) : (
                      <Avatar name={c.name} src={c.avatarUrl} decorative />
                    )}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="text-sm text-muted">{c.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
