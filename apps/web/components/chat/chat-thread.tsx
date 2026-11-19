'use client';

import { ArrowLeft, Eraser, MoreVertical, Trash2, UsersRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PersonButton } from '@/components/people/person-card';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { dayKey, dayLabel } from '@/lib/chat/format';
import type { ChatMessage, ChatThreadData, Outgoing } from '@/lib/chat/types';
import { Composer } from './composer';
import { MessageBubble } from './message-bubble';

const POLL_MS = 3000;

/** One open conversation: the messages, new ones arriving, and the message box. */
export function ChatThread({
  id,
  onBack,
  onActivity,
}: {
  id: string;
  onBack: () => void;
  /** Something changed (sent, or marked as read): refresh the chat list and unread badge. */
  onActivity: () => void;
}) {
  const t = useTranslations('chat');
  const message_ = useErrorMessage();
  const [header, setHeader] = useState<ChatThreadData['conversation'] | null>(null);
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [seenAt, setSeenAt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [confirm, setConfirm] = useState<'clear' | 'delete' | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const queued = useRef(new Map<string, Outgoing>());
  // Messages go out one after another, so they arrive in the order they were written.
  const outbox = useRef<Promise<void>>(Promise.resolve());
  const itemsRef = useRef<ChatMessage[]>([]);
  const revisionRef = useRef<number | null>(null);
  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const markRead = useCallback(() => {
    api(`/chat/conversations/${id}/read`, { method: 'POST', quiet: true })
      .then(onActivity)
      .catch(() => undefined);
  }, [id, onActivity]);

  /** Loads the whole chat again (keeping messages that are still being sent). */
  const reload = useCallback(async () => {
    try {
      const data = await api<ChatThreadData>(`/chat/conversations/${id}/messages`);
      setHeader(data.conversation);
      setSeenAt(new Date(data.seenAt).getTime());
      setRevision(data.revision);
      revisionRef.current = data.revision;
      setItems((current) => [...data.items, ...current.filter((m) => m.pending)]);
    } catch {
      // The next check tries again.
    }
  }, [id]);

  // First load.
  useEffect(() => {
    let active = true;
    stick.current = true;
    api<ChatThreadData>(`/chat/conversations/${id}/messages`)
      .then((data) => {
        if (!active) return;
        setHeader(data.conversation);
        setItems(data.items);
        setSeenAt(new Date(data.seenAt).getTime());
        setRevision(data.revision);
        scrollDown();
        markRead();
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [id, markRead, scrollDown]);

  // Look for new messages every few seconds while the tab is visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const last = [...itemsRef.current].reverse().find((m) => !m.pending);
      const query = last ? `?after=${encodeURIComponent(last.id)}` : '';
      api<ChatThreadData>(`/chat/conversations/${id}/messages${query}`)
        .then((data) => {
          setSeenAt(new Date(data.seenAt).getTime());
          // A message was deleted or the chat was cleared (here or on the other side): load it again.
          if (revisionRef.current !== null && data.revision !== revisionRef.current) {
            void reload();
            return;
          }
          if (data.items.length === 0) return;
          setItems((current) => {
            const known = new Set(current.map((m) => m.id));
            const fresh = data.items.filter((m) => !known.has(m.id));
            return fresh.length ? [...current, ...fresh] : current;
          });
          if (data.items.some((m) => !m.mine)) markRead();
          if (stick.current) scrollDown();
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [id, markRead, reload, scrollDown]);

  async function post(tempId: string, out: Outgoing) {
    const form = new FormData();
    if (out.body) form.set('body', out.body);
    if (out.file) form.set('file', out.file);
    if (out.voice) {
      form.set('voice', 'true');
      form.set('durationSec', String(out.durationSec ?? 1));
    }
    try {
      const sent = await api<ChatMessage>(`/chat/conversations/${id}/messages`, {
        method: 'POST',
        body: form,
      });
      queued.current.delete(tempId);
      setItems((current) => {
        const without = current.filter((m) => m.id !== tempId);
        return without.some((m) => m.id === sent.id) ? without : [...without, sent];
      });
      onActivity();
    } catch (error) {
      toast.error(message_(error));
      setItems((current) =>
        current.map((m) => (m.id === tempId ? { ...m, pending: 'failed' as const } : m)),
      );
    }
  }

  function send(out: Outgoing) {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const file = out.file;
    const temp: ChatMessage = {
      id: tempId,
      kind: out.voice
        ? 'VOICE'
        : file
          ? file.type.startsWith('image/')
            ? 'IMAGE'
            : 'FILE'
          : 'TEXT',
      body: out.body || null,
      mine: true,
      senderName: '',
      createdAt: new Date().toISOString(),
      durationSec: out.durationSec ?? null,
      file: file
        ? { url: URL.createObjectURL(file), name: file.name, mime: file.type, sizeBytes: file.size }
        : null,
      pending: 'sending',
    };
    queued.current.set(tempId, out);
    setItems((current) => [...current, temp]);
    stick.current = true;
    scrollDown();
    outbox.current = outbox.current.then(() => post(tempId, out));
  }

  function retry(failedMessage: ChatMessage) {
    const out = queued.current.get(failedMessage.id);
    if (!out) return;
    setItems((current) =>
      current.map((m) => (m.id === failedMessage.id ? { ...m, pending: 'sending' as const } : m)),
    );
    outbox.current = outbox.current.then(() => post(failedMessage.id, out));
  }

  async function deleteMessage(message: ChatMessage) {
    try {
      await api(`/chat/messages/${message.id}`, { method: 'DELETE' });
      setItems((current) => current.filter((m) => m.id !== message.id));
      onActivity();
    } catch (error) {
      toast.error(message_(error));
      throw error;
    }
  }

  async function clearChat(leave: boolean) {
    try {
      await api(`/chat/conversations/${id}/clear`, { method: 'POST' });
      setItems((current) => current.filter((m) => m.pending));
      onActivity();
      if (leave) onBack();
    } catch (error) {
      toast.error(message_(error));
      throw error;
    }
  }

  function onScroll() {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  const labels = { today: t('today'), yesterday: t('yesterday') };
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={header?.title ?? t('title')}>
      <header className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2 md:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary-soft md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        {header ? (
          <>
            {/* Tap the picture or the name to see who this is (not for the Natik team). */}
            <PersonButton
              id={header.personId}
              name={header.title}
              decorative
              className="rounded-full"
            >
              {header.team ? (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                  <UsersRound className="size-5" aria-hidden />
                </span>
              ) : (
                <Avatar name={header.title} src={header.avatarUrl} decorative />
              )}
            </PersonButton>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <h2 className="truncate font-sans text-base font-semibold">
                <PersonButton
                  id={header.personId}
                  name={header.title}
                  className="max-w-full truncate"
                >
                  {header.title}
                </PersonButton>
              </h2>
              <p className="text-sm text-muted">{header.subtitle}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('chatMenu')}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-primary-soft hover:text-primary"
              >
                <MoreVertical className="size-5" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setConfirm('clear')}>
                  <Eraser aria-hidden /> {t('clearHistory')}
                </DropdownMenuItem>
                <DropdownMenuItem tone="danger" onSelect={() => setConfirm('delete')}>
                  <Trash2 aria-hidden /> {t('deleteChat')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </header>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-primary-soft/60 px-3 py-4 md:px-6"
      >
        {failed ? <p className="m-auto text-muted">{t('loadFailed')}</p> : null}
        {items.map((m, index) => {
          const previous = items[index - 1];
          const newDay = !previous || dayKey(previous.createdAt) !== dayKey(m.createdAt);
          return (
            <Fragment key={m.id}>
              {newDay ? (
                <p className="my-2 self-center rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-muted shadow-card">
                  {dayLabel(m.createdAt, labels)}
                </p>
              ) : null}
              <MessageBubble
                message={m}
                seen={m.mine && new Date(m.createdAt).getTime() <= seenAt}
                onRetry={retry}
                onDelete={setDeleting}
              />
            </Fragment>
          );
        })}
      </div>

      <Composer onSend={send} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteMessageTitle')}
        description={t('deleteMessageText')}
        confirmLabel={t('deleteMessage')}
        tone="danger"
        onConfirm={async () => {
          if (deleting) await deleteMessage(deleting);
        }}
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === 'delete' ? t('deleteChatTitle') : t('clearTitle')}
        description={confirm === 'delete' ? t('deleteChatText') : t('clearText')}
        confirmLabel={confirm === 'delete' ? t('deleteChat') : t('clearHistory')}
        tone="danger"
        onConfirm={async () => {
          await clearChat(confirm === 'delete');
        }}
      />
    </section>
  );
}
