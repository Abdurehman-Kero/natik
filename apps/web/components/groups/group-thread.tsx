'use client';

import { ArrowLeft, ChevronUp, Pin, PinOff, Reply, UsersRound, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Composer, GROUP_ACCEPT } from '@/components/chat/composer';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import { dayKey, dayLabel } from '@/lib/chat/format';
import type { Outgoing } from '@/lib/chat/types';
import type { GroupInfo, GroupMessage, GroupReaction } from '@/lib/groups/types';
import { GroupMessageBubble, type MessageActions } from './group-message';
import { MembersDialog } from './members-dialog';

const POLL_MS = 4000;
const PAGE = 50;
const MAX_FILE = 60 * 1024 * 1024;

interface Page {
  hasMore: boolean;
  items: GroupMessage[];
}

/** One open course group: the pinned message, the conversation, and the message box. */
export function GroupThread({
  courseId,
  onBack,
  onActivity,
}: {
  courseId: string;
  onBack: () => void;
  /** Something changed (sent, or read): refresh the list and the unread badge. */
  onActivity: () => void;
}) {
  const t = useTranslations('groups');
  const tc = useTranslations('chat');
  const errorMessage = useErrorMessage();
  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [items, setItems] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editing, setEditing] = useState<GroupMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [deleting, setDeleting] = useState<GroupMessage | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const queued = useRef(new Map<string, Outgoing & { replyToId?: string }>());
  const outbox = useRef<Promise<void>>(Promise.resolve());
  const itemsRef = useRef<GroupMessage[]>([]);
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
    api(`/groups/${courseId}/read`, { method: 'POST', quiet: true })
      .then(onActivity)
      .catch(() => undefined);
  }, [courseId, onActivity]);

  const loadInfo = useCallback(() => {
    api<GroupInfo>(`/groups/${courseId}`)
      .then(setInfo)
      .catch(() => undefined);
  }, [courseId]);

  /** Puts the newest messages in place without losing older ones the person already scrolled to. */
  const mergeLatest = useCallback((page: Page) => {
    setItems((current) => {
      const pending = current.filter((m) => m.pending);
      const first = page.items[0];
      const keep =
        page.hasMore && first
          ? current.filter(
              (m) =>
                !m.pending && new Date(m.createdAt).getTime() < new Date(first.createdAt).getTime(),
            )
          : [];
      return [...keep, ...page.items, ...pending];
    });
    setHasMore((was) => (page.hasMore ? was || page.hasMore : false));
  }, []);

  // Open: the header and the newest messages. (The thread starts afresh for each group: it is keyed by it.)
  useEffect(() => {
    let active = true;
    stick.current = true;
    loadInfo();
    api<Page>(`/groups/${courseId}/messages?limit=${PAGE}`)
      .then((page) => {
        if (!active) return;
        setItems(page.items);
        setHasMore(page.hasMore);
        setLoaded(true);
        scrollDown();
        markRead();
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [courseId, loadInfo, markRead, scrollDown]);

  // New messages, edits, reactions and deletions: look again every few seconds while the tab is open.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      api<Page>(`/groups/${courseId}/messages?limit=${PAGE}`)
        .then((page) => {
          const before = itemsRef.current.filter((m) => !m.pending);
          const lastBefore = before[before.length - 1];
          const lastNow = page.items[page.items.length - 1];
          mergeLatest(page);
          if (lastNow && lastNow.id !== lastBefore?.id) {
            if (
              page.items.some(
                (m) => !m.mine && new Date(m.createdAt) > new Date(lastBefore?.createdAt ?? 0),
              )
            ) {
              markRead();
            }
            if (stick.current) scrollDown();
          }
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [courseId, markRead, mergeLatest, scrollDown]);

  async function loadOlder() {
    const first = items.find((m) => !m.pending);
    if (!first) return;
    const el = scroller.current;
    const heightBefore = el?.scrollHeight ?? 0;
    try {
      const page = await api<Page>(
        `/groups/${courseId}/messages?limit=${PAGE}&before=${encodeURIComponent(first.id)}`,
      );
      setItems((current) => [...page.items, ...current]);
      setHasMore(page.hasMore);
      // Keep the reader where they were instead of jumping to the top.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - heightBefore;
      });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function post(tempId: string, out: Outgoing & { replyToId?: string }) {
    const form = new FormData();
    if (out.body) form.set('body', out.body);
    if (out.file) form.set('file', out.file);
    if (out.replyToId) form.set('replyToId', out.replyToId);
    if (out.voice) {
      form.set('voice', 'true');
      form.set('durationSec', String(out.durationSec ?? 1));
    }
    try {
      const sent = await api<GroupMessage>(`/groups/${courseId}/messages`, {
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
      toast.error(errorMessage(error));
      setItems((current) =>
        current.map((m) => (m.id === tempId ? { ...m, pending: 'failed' as const } : m)),
      );
    }
  }

  function send(out: Outgoing) {
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const file = out.file;
    const kind: GroupMessage['kind'] = out.voice
      ? 'VOICE'
      : !file
        ? 'TEXT'
        : file.type.startsWith('image/')
          ? 'IMAGE'
          : file.type.startsWith('video/')
            ? 'VIDEO'
            : file.type.startsWith('audio/')
              ? 'AUDIO'
              : 'FILE';
    const reply = replyTo;
    const temp: GroupMessage = {
      id: tempId,
      kind,
      body: out.body || null,
      mine: true,
      deleted: false,
      edited: false,
      pinned: false,
      createdAt: new Date().toISOString(),
      sender: { id: 'me', name: '', role: info?.me.role ?? 'STUDENT', avatarUrl: null },
      durationSec: out.durationSec ?? null,
      file: file
        ? { url: URL.createObjectURL(file), name: file.name, mime: file.type, sizeBytes: file.size }
        : null,
      replyTo: reply
        ? {
            id: reply.id,
            senderName: reply.sender.name,
            text: reply.body ?? reply.file?.name ?? '',
          }
        : null,
      reactions: [],
      pending: 'sending',
    };
    const full = { ...out, replyToId: reply?.id };
    queued.current.set(tempId, full);
    setItems((current) => [...current, temp]);
    setReplyTo(null);
    stick.current = true;
    scrollDown();
    outbox.current = outbox.current.then(() => post(tempId, full));
  }

  function retry(message: GroupMessage) {
    const out = queued.current.get(message.id);
    if (!out) return;
    setItems((current) =>
      current.map((m) => (m.id === message.id ? { ...m, pending: 'sending' as const } : m)),
    );
    outbox.current = outbox.current.then(() => post(message.id, out));
  }

  async function react(message: GroupMessage, emoji: string) {
    try {
      const result = await api<{ reactions: GroupReaction[] }>(
        `/groups/messages/${message.id}/react`,
        { method: 'POST', json: { emoji } },
      );
      setItems((current) =>
        current.map((m) => (m.id === message.id ? { ...m, reactions: result.reactions } : m)),
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function togglePin(message: GroupMessage) {
    try {
      await api(`/groups/messages/${message.id}/pin`, {
        method: message.pinned ? 'DELETE' : 'POST',
      });
      setItems((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, pinned: !message.pinned } : { ...m, pinned: false },
        ),
      );
      loadInfo();
      toast.success(message.pinned ? t('unpinned') : t('pinnedToast'));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setEditBusy(true);
    try {
      const updated = await api<GroupMessage>(`/groups/messages/${editing.id}`, {
        method: 'PATCH',
        json: { body: editText },
      });
      setItems((current) => current.map((m) => (m.id === updated.id ? updated : m)));
      setEditing(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setEditBusy(false);
    }
  }

  async function remove(message: GroupMessage) {
    try {
      await api(`/groups/messages/${message.id}`, { method: 'DELETE' });
      setItems((current) =>
        current.map((m) =>
          m.id === message.id
            ? { ...m, deleted: true, body: null, file: null, reactions: [], pinned: false }
            : m,
        ),
      );
      loadInfo();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    }
  }

  function jumpTo(id: string) {
    const el = document.getElementById(`m-${id}`);
    if (!el) {
      toast(t('notLoaded'));
      return;
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('ring-2', 'ring-accent', 'rounded-2xl');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-accent', 'rounded-2xl'), 1400);
  }

  const actions: MessageActions = {
    onReply: (m) => setReplyTo(m),
    onEdit: (m) => {
      setEditing(m);
      setEditText(m.body ?? '');
    },
    onDelete: setDeleting,
    onPin: (m) => void togglePin(m),
    onReact: (m, emoji) => void react(m, emoji),
    onRetry: retry,
    onJumpTo: jumpTo,
  };

  function onScroll() {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  const labels = { today: tc('today'), yesterday: tc('yesterday') };
  const canModerate = info?.me.canModerate ?? false;
  const title = info?.course.title ?? '';

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={title || t('title')}>
      <header className="flex items-center gap-2 border-b border-border bg-surface px-2 py-2 md:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={t('back')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary-soft md:hidden"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        {info ? (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            title={t('showMembers')}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-start hover:bg-primary-soft"
          >
            <Avatar name={info.course.title} src={info.course.imageUrl} decorative />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <h2 className="truncate font-sans text-base font-semibold">{info.course.title}</h2>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <UsersRound className="size-3.5" aria-hidden />
                {t('memberCount', { count: info.counts.total })}
              </span>
            </span>
          </button>
        ) : (
          <span className="flex-1" />
        )}
      </header>

      {info?.pinned ? (
        <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5">
          <button
            type="button"
            onClick={() => jumpTo(info.pinned!.id)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-start hover:bg-primary-soft"
          >
            <Pin className="size-4 shrink-0 text-accent-strong" aria-hidden />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="text-xs font-bold text-accent-strong">{t('pinnedMessage')}</span>
              <span className="truncate text-sm">{info.pinned.text}</span>
            </span>
          </button>
          {canModerate ? (
            <button
              type="button"
              onClick={() => {
                const target = items.find((m) => m.id === info.pinned!.id);
                if (target) void togglePin(target);
              }}
              aria-label={t('unpin')}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-primary-soft hover:text-primary"
            >
              <PinOff className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-primary-soft/60 px-3 py-4 md:px-6"
      >
        {failed ? (
          <div className="m-auto flex max-w-xs flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-surface text-primary shadow-card">
              <UsersRound className="size-7" aria-hidden />
            </span>
            <p className="font-semibold">{t('unavailableTitle')}</p>
            <p className="text-muted">{t('unavailableText')}</p>
            <Button variant="secondary" onClick={onBack}>
              {t('back')}
            </Button>
          </div>
        ) : null}
        {hasMore ? (
          <Button
            variant="secondary"
            size="sm"
            className="mb-2 self-center"
            onClick={() => void loadOlder()}
          >
            <ChevronUp aria-hidden /> {t('loadEarlier')}
          </Button>
        ) : null}
        {loaded && items.length === 0 ? (
          <div className="m-auto flex max-w-xs flex-col items-center gap-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-surface text-primary shadow-card">
              <UsersRound className="size-7" aria-hidden />
            </span>
            <p className="font-semibold">{t('emptyTitle')}</p>
            <p className="text-muted">{t('emptyText')}</p>
          </div>
        ) : null}
        {items.map((m, index) => {
          const previous = items[index - 1];
          const newDay = !previous || dayKey(previous.createdAt) !== dayKey(m.createdAt);
          const sameSender =
            !!previous &&
            !newDay &&
            previous.kind !== 'SYSTEM' &&
            !previous.deleted &&
            previous.sender.id === m.sender.id;
          return (
            <Fragment key={m.id}>
              {newDay ? (
                <p className="my-2 self-center rounded-full bg-surface/90 px-3 py-1 text-xs font-semibold text-muted shadow-card">
                  {dayLabel(m.createdAt, labels)}
                </p>
              ) : null}
              <GroupMessageBubble
                message={m}
                showSender={!sameSender}
                canModerate={canModerate}
                actions={actions}
              />
            </Fragment>
          );
        })}
      </div>

      <Composer
        onSend={send}
        accept={GROUP_ACCEPT}
        maxBytes={MAX_FILE}
        tooBigText={t('tooBig')}
        focusKey={replyTo?.id ?? null}
        banner={
          replyTo ? (
            <div className="mb-2 flex items-center gap-2 rounded-xl border-s-4 border-accent bg-primary-soft py-1.5 ps-3 pe-1">
              <Reply className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-primary">
                  {t('replyingTo', { name: replyTo.sender.name })}
                </span>
                <span className="truncate text-sm text-muted">
                  {replyTo.body ?? replyTo.file?.name ?? ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={t('cancelReply')}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null
        }
      />

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogTitle>{t('editTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('editTitle')}</DialogDescription>
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void saveEdit();
            }}
          >
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              aria-label={t('editLabel')}
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-xl border border-border-strong bg-canvas p-3 text-base outline-none focus:border-primary"
              autoFocus
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" loading={editBusy} disabled={!editText.trim()}>
                {t('saveEdit')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t('deleteTitle')}
        description={deleting?.mine ? t('deleteMine') : t('deleteOthers')}
        confirmLabel={tc('deleteMessage')}
        tone="danger"
        onConfirm={async () => {
          if (deleting) await remove(deleting);
        }}
      />

      {info ? <MembersDialog open={membersOpen} onOpenChange={setMembersOpen} info={info} /> : null}
    </section>
  );
}
