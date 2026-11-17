'use client';

import { AlertCircle, Check, CheckCheck, Copy, Download, FileText, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { formatSize, formatTime } from '@/lib/chat/format';
import type { ChatMessage } from '@/lib/chat/types';
import { VoicePlayer } from './voice-player';

/** One message in the thread. Mine are navy on the right, theirs white on the left. */
export function MessageBubble({
  message,
  seen,
  onRetry,
  onDelete,
}: {
  message: ChatMessage;
  /** The other side has opened the chat since this message was sent. */
  seen: boolean;
  onRetry: (message: ChatMessage) => void;
  /** Ask to delete this message. Only offered for messages the viewer may delete. */
  onDelete: (message: ChatMessage) => void;
}) {
  const t = useTranslations('chat');
  const mine = message.mine;
  const media = message.kind === 'IMAGE' && message.file;
  const failed = message.pending === 'failed';
  const canDelete = message.mine && !message.pending;
  const canCopy = Boolean(message.body);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.body ?? '');
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  }

  const bubble = (
    <div
      className={cn(
        'flex max-w-[85%] flex-col gap-1 rounded-2xl text-[0.9375rem] leading-snug shadow-card sm:max-w-[70%]',
        media ? 'p-1' : 'px-3.5 py-2',
        mine
          ? 'rounded-br-md bg-primary text-white'
          : 'rounded-bl-md border border-border bg-surface',
        message.pending === 'sending' && 'opacity-70',
      )}
    >
      {media ? (
        <a href={message.file!.url} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated file */}
          <img
            src={message.file!.url}
            alt={message.body || t('photo')}
            loading="lazy"
            className="max-h-72 w-full rounded-xl object-cover"
          />
        </a>
      ) : null}

      {message.kind === 'VOICE' && message.file ? (
        <VoicePlayer src={message.file.url} durationSec={message.durationSec ?? 0} onDark={mine} />
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
        <p className={cn('break-words whitespace-pre-wrap', media && 'px-2 pt-1')}>
          {message.body}
        </p>
      ) : null}

      <span
        className={cn(
          'flex items-center justify-end gap-1 text-[0.6875rem] leading-none',
          media && 'px-2 pb-1',
          mine ? 'text-white/80' : 'text-muted',
        )}
      >
        {failed ? (
          <button
            type="button"
            onClick={() => onRetry(message)}
            className="flex min-h-6 items-center gap-1 rounded-full bg-danger-soft px-2 py-1 font-semibold text-danger"
          >
            <AlertCircle className="size-3.5" aria-hidden />
            {t('failed')}
          </button>
        ) : (
          <>
            {formatTime(message.createdAt)}
            {mine && message.pending !== 'sending' ? (
              seen ? (
                <CheckCheck className="size-3.5 text-accent" aria-label={t('seen')} />
              ) : (
                <Check className="size-3.5" aria-label={t('sent')} />
              )
            ) : null}
          </>
        )}
      </span>
    </div>
  );

  if (!canDelete && !canCopy) {
    return (
      <div className={cn('flex w-full', mine ? 'justify-end' : 'justify-start')}>{bubble}</div>
    );
  }
  return (
    <div className={cn('flex w-full', mine ? 'justify-end' : 'justify-start')}>
      <ContextMenu>
        <ContextMenuTrigger asChild>{bubble}</ContextMenuTrigger>
        <ContextMenuContent>
          {canCopy ? (
            <ContextMenuItem onSelect={() => void copy()}>
              <Copy aria-hidden /> {t('copy')}
            </ContextMenuItem>
          ) : null}
          {canDelete ? (
            <ContextMenuItem tone="danger" onSelect={() => onDelete(message)}>
              <Trash2 aria-hidden /> {t('deleteMessage')}
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}
