'use client';

import {
  AlertCircle,
  Ban,
  Copy,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Reply,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { PersonButton } from '@/components/people/person-card';
import { cn } from '@/lib/cn';
import { formatSize, formatTime } from '@/lib/chat/format';
import { type GroupMessage, REACTIONS } from '@/lib/groups/types';
import { VoicePlayer } from '../chat/voice-player';

/** A small label next to a name, so students know who is the teacher or the Natik team. */
function RoleTag({ role }: { role: GroupMessage['sender']['role'] }) {
  const t = useTranslations('groups');
  if (role === 'STUDENT') return null;
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[0.625rem] leading-none font-bold tracking-wide uppercase',
        role === 'TEACHER' ? 'bg-accent-soft text-accent-strong' : 'bg-primary text-white',
      )}
    >
      {role === 'TEACHER' ? t('roleTeacher') : t('roleTeam')}
    </span>
  );
}

export interface MessageActions {
  onReply: (message: GroupMessage) => void;
  onEdit: (message: GroupMessage) => void;
  onDelete: (message: GroupMessage) => void;
  onPin: (message: GroupMessage) => void;
  onReact: (message: GroupMessage, emoji: string) => void;
  onRetry: (message: GroupMessage) => void;
  onJumpTo: (messageId: string) => void;
}

/**
 * One message in a course group, the way Telegram shows it: others on the left with their picture and
 * name (the teacher and the Natik team are tagged), mine on the right in navy, quoted replies,
 * reactions under the text, and a menu for everything you can do with it.
 */
export function GroupMessageBubble({
  message,
  showSender,
  canModerate,
  actions,
}: {
  message: GroupMessage;
  /** Show the sender's picture and name (first of a run of messages from one person). */
  showSender: boolean;
  canModerate: boolean;
  actions: MessageActions;
}) {
  const t = useTranslations('groups');
  const tc = useTranslations('chat');
  const mine = message.mine;
  const failed = message.pending === 'failed';
  const sending = message.pending === 'sending';

  // Announcements from the platform ("New session: …") sit in the middle.
  if (message.kind === 'SYSTEM') {
    return (
      <p
        id={`m-${message.id}`}
        className="my-1 flex items-center gap-1.5 self-center rounded-full bg-accent-soft px-3.5 py-1.5 text-center text-sm font-semibold text-accent-strong shadow-card"
      >
        <Sparkles className="size-4 shrink-0" aria-hidden />
        {message.body}
      </p>
    );
  }

  if (message.deleted) {
    return (
      <div className={cn('flex w-full', mine ? 'justify-end' : 'justify-start ps-10')}>
        <p
          id={`m-${message.id}`}
          className="flex items-center gap-1.5 rounded-2xl border border-dashed border-border-strong px-3.5 py-2 text-sm text-muted italic"
        >
          <Ban className="size-4" aria-hidden /> {t('deleted')}
        </p>
      </div>
    );
  }

  const isMedia = (message.kind === 'IMAGE' || message.kind === 'VIDEO') && message.file;
  const canEdit = mine && !message.pending && message.kind === 'TEXT';
  const canDelete = !message.pending && (mine || canModerate);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.body ?? '');
      toast.success(tc('copied'));
    } catch {
      toast.error(tc('copyFailed'));
    }
  }

  const menu = !message.pending ? (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('messageMenu')}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center self-center rounded-full text-muted transition-opacity hover:bg-primary-soft hover:text-primary focus-visible:opacity-100 data-[state=open]:opacity-100',
          'md:opacity-0 md:group-hover/msg:opacity-100',
        )}
      >
        <MoreHorizontal className="size-4.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={mine ? 'end' : 'start'} className="min-w-56">
        <div className="flex justify-between gap-1 px-1 pb-1" role="group" aria-label={t('react')}>
          {REACTIONS.map((emoji) => (
            <DropdownMenuItem
              key={emoji}
              aria-label={emoji}
              onSelect={() => actions.onReact(message, emoji)}
              className="size-10 min-h-10 justify-center rounded-full px-0 text-xl"
            >
              {emoji}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.onReply(message)}>
          <Reply aria-hidden /> {t('reply')}
        </DropdownMenuItem>
        {message.body ? (
          <DropdownMenuItem onSelect={() => void copy()}>
            <Copy aria-hidden /> {tc('copy')}
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem onSelect={() => actions.onEdit(message)}>
            <Pencil aria-hidden /> {t('edit')}
          </DropdownMenuItem>
        ) : null}
        {canModerate ? (
          <DropdownMenuItem onSelect={() => actions.onPin(message)}>
            {message.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}{' '}
            {message.pinned ? t('unpin') : t('pin')}
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem tone="danger" onSelect={() => actions.onDelete(message)}>
            <Trash2 aria-hidden /> {tc('deleteMessage')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const bubble = (
    <div
      className={cn(
        'flex max-w-full min-w-0 flex-col gap-1 rounded-2xl text-[0.9375rem] leading-snug shadow-card',
        isMedia ? 'w-64 p-1 sm:w-72' : 'px-3.5 py-2',
        mine
          ? 'rounded-br-md bg-primary text-white'
          : 'rounded-bl-md border border-border bg-surface',
        sending && 'opacity-70',
      )}
    >
      {!mine && showSender ? (
        <p className={cn('flex items-center gap-1.5', isMedia && 'px-2 pt-1')}>
          <PersonButton id={message.sender.id} name={message.sender.name} className="min-w-0">
            <span className="block truncate text-sm font-bold text-primary hover:underline">
              {message.sender.name}
            </span>
          </PersonButton>
          <RoleTag role={message.sender.role} />
        </p>
      ) : null}

      {message.replyTo ? (
        <button
          type="button"
          onClick={() => actions.onJumpTo(message.replyTo!.id)}
          className={cn(
            'flex min-w-0 flex-col rounded-lg border-s-4 px-2.5 py-1 text-start text-sm',
            mine
              ? 'border-accent bg-white/10 text-white/90'
              : 'border-accent bg-primary-soft text-ink',
            isMedia && 'mx-2 mt-1',
          )}
        >
          <span className={cn('truncate font-semibold', mine ? 'text-accent' : 'text-primary')}>
            {message.replyTo.senderName}
          </span>
          <span className="line-clamp-2 break-words opacity-90">{message.replyTo.text}</span>
        </button>
      ) : null}

      {message.kind === 'IMAGE' && message.file ? (
        <a href={message.file.url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated file */}
          <img
            src={message.file.url}
            alt={message.body || tc('photo')}
            loading="lazy"
            className="max-h-80 w-full rounded-xl object-cover"
          />
        </a>
      ) : null}

      {message.kind === 'VIDEO' && message.file ? (
        <video
          src={message.file.url}
          controls
          playsInline
          preload="metadata"
          aria-label={message.file.name}
          className="max-h-80 w-full rounded-xl bg-black"
        />
      ) : null}

      {message.kind === 'VOICE' && message.file ? (
        <VoicePlayer src={message.file.url} durationSec={message.durationSec ?? 0} onDark={mine} />
      ) : null}

      {message.kind === 'AUDIO' && message.file ? (
        <div className="flex flex-col gap-1">
          <p className="truncate text-sm font-medium">{message.file.name}</p>
          <audio src={message.file.url} controls preload="none" className="h-10 w-full min-w-48" />
        </div>
      ) : null}

      {message.kind === 'FILE' && message.file ? (
        <a href={`${message.file.url}?download=1`} className="flex items-center gap-3 py-1">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full',
              mine ? 'bg-white text-primary' : 'bg-primary-soft text-primary',
            )}
            aria-hidden
          >
            <FileText className="size-5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium break-all">{message.file.name}</span>
            <span className={cn('text-xs', mine ? 'text-white/80' : 'text-muted')}>
              {formatSize(message.file.sizeBytes)}
            </span>
          </span>
          <Download className="ms-1 size-4 shrink-0 opacity-70" aria-hidden />
        </a>
      ) : null}

      {message.body ? (
        <p className={cn('break-words whitespace-pre-wrap', isMedia && 'px-2 pt-1')}>
          {message.body}
        </p>
      ) : null}

      <span
        className={cn(
          'flex items-center justify-end gap-1.5 text-[0.6875rem] leading-none',
          isMedia && 'px-2 pb-1',
          mine ? 'text-white/80' : 'text-muted',
        )}
      >
        {message.pinned ? <Pin className="size-3" aria-label={t('pinned')} /> : null}
        {message.edited ? <span>{t('edited')}</span> : null}
        {failed ? (
          <button
            type="button"
            onClick={() => actions.onRetry(message)}
            className="flex min-h-6 items-center gap-1 rounded-full bg-danger-soft px-2 py-1 font-semibold text-danger"
          >
            <AlertCircle className="size-3.5" aria-hidden />
            {tc('failed')}
          </button>
        ) : (
          formatTime(message.createdAt)
        )}
      </span>
    </div>
  );

  return (
    <div
      id={`m-${message.id}`}
      className={cn(
        'group/msg flex w-full items-end gap-2',
        mine ? 'justify-end' : 'justify-start',
      )}
    >
      {!mine ? (
        showSender ? (
          <PersonButton
            id={message.sender.id}
            name={message.sender.name}
            decorative
            className="rounded-full"
          >
            <Avatar
              name={message.sender.name}
              src={message.sender.avatarUrl}
              size="sm"
              decorative
            />
          </PersonButton>
        ) : (
          <span className="size-8 shrink-0" aria-hidden />
        )
      ) : null}
      {mine ? menu : null}
      <div
        className={cn(
          'flex max-w-[calc(100%-5.5rem)] min-w-0 flex-col gap-1 sm:max-w-[70%]',
          mine ? 'items-end' : 'items-start',
        )}
      >
        {bubble}
        {message.reactions.length > 0 ? (
          <ul className={cn('flex flex-wrap gap-1', mine && 'justify-end')}>
            {message.reactions.map((r) => (
              <li key={r.emoji}>
                <button
                  type="button"
                  onClick={() => actions.onReact(message, r.emoji)}
                  aria-pressed={r.mine}
                  aria-label={t('reactionLabel', { emoji: r.emoji, count: r.count })}
                  className={cn(
                    'flex h-7 items-center gap-1 rounded-full border px-2 text-sm font-semibold transition-colors',
                    r.mine
                      ? 'border-primary bg-primary text-white'
                      : 'border-border-strong bg-surface text-ink hover:border-primary',
                  )}
                >
                  <span aria-hidden>{r.emoji}</span>
                  {r.count}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {!mine ? menu : null}
    </div>
  );
}
