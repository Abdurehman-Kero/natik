'use client';

import { FileText, Mic, Paperclip, SendHorizontal, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from '@/components/ui/toast';
import { formatDuration, formatSize } from '@/lib/chat/format';
import type { Outgoing } from '@/lib/chat/types';
import { useRecorder } from '@/lib/chat/use-recorder';

const ACCEPT = 'image/*,application/pdf,audio/*,video/mp4,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * The message box: attach a file, type, or hold a voice note. Enter sends, Shift+Enter makes a new
 * line. With nothing typed the send button becomes the microphone, as in Telegram.
 */
export function Composer({
  onSend,
  disabled,
}: {
  onSend: (message: Outgoing) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('chat');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const recorder = useRecorder();

  const clearFile = useCallback(() => {
    setFile(null);
    setPreview((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
  }, []);

  useEffect(() => {
    if (recorder.error)
      toast.error(t(recorder.error === 'denied' ? 'micDenied' : 'micUnsupported'));
  }, [recorder.error, t]);

  function grow() {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = text.trim();
    if ((!body && !file) || disabled) return;
    onSend({ body, file: file ?? undefined });
    setText('');
    clearFile();
    if (input.current) input.current.style.height = 'auto';
    input.current?.focus();
  }

  function onKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  function choose(list: FileList | null) {
    const picked = list?.[0];
    if (picker.current) picker.current.value = '';
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      toast.error(t('tooBig'));
      return;
    }
    setFile(picked);
    setPreview(picked.type.startsWith('image/') ? URL.createObjectURL(picked) : null);
    input.current?.focus();
  }

  async function sendVoice() {
    const result = await recorder.stop();
    if (result)
      onSend({ body: '', file: result.file, voice: true, durationSec: result.durationSec });
  }

  if (recorder.recording) {
    return (
      <div className="flex items-center gap-2 border-t border-border bg-surface p-2">
        <button
          type="button"
          onClick={recorder.cancel}
          aria-label={t('cancelRecording')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-danger hover:bg-danger-soft"
        >
          <Trash2 className="size-5" aria-hidden />
        </button>
        <p
          role="status"
          className="flex flex-1 items-center justify-center gap-2 font-medium tabular-nums"
        >
          <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden />
          {t('recording')} {formatDuration(recorder.seconds)}
        </p>
        <button
          type="button"
          onClick={() => void sendVoice()}
          aria-label={t('sendVoice')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover"
        >
          <SendHorizontal className="size-5" aria-hidden />
        </button>
      </div>
    );
  }

  const canSend = text.trim().length > 0 || file !== null;
  return (
    <form onSubmit={submit} className="border-t border-border bg-surface p-2">
      {file ? (
        <div className="mb-2 flex items-center gap-3 rounded-xl bg-primary-soft p-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview of a file not yet sent
            <img src={preview} alt="" className="size-12 rounded-lg object-cover" />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg bg-surface text-primary">
              <FileText className="size-6" aria-hidden />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-muted">{formatSize(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={clearFile}
            aria-label={t('removeFile')}
            className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-ink"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-1.5">
        <input
          ref={picker}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => choose(e.target.files)}
        />
        <button
          type="button"
          onClick={() => picker.current?.click()}
          aria-label={t('attach')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-primary-soft hover:text-primary"
        >
          <Paperclip className="size-5" aria-hidden />
        </button>
        <textarea
          ref={input}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            grow();
          }}
          onKeyDown={onKey}
          placeholder={file ? t('caption') : t('placeholder')}
          aria-label={t('placeholder')}
          maxLength={2000}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-border-strong bg-canvas px-4 py-2.5 text-base leading-snug outline-none focus:border-primary"
        />
        {canSend ? (
          <button
            type="submit"
            disabled={disabled}
            aria-label={t('send')}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <SendHorizontal className="size-5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void recorder.start()}
            disabled={disabled}
            aria-label={t('record')}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <Mic className="size-5" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
