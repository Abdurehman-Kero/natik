'use client';

import { Captions, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';

/** Captions for a video we host: a WebVTT (.vtt) file that the player shows as subtitles. */
export function CaptionsControl({
  videoId,
  hasCaptions,
  onChange,
}: {
  videoId: string;
  hasCaptions: boolean;
  onChange: (hasCaptions: boolean) => void;
}) {
  const t = useTranslations('lessonEditor');
  const errorMessage = useErrorMessage();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File | undefined) {
    if (picker.current) picker.current.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      await api(`/videos/${videoId}/captions`, { method: 'POST', body: form });
      onChange(true);
      toast.success(t('captions.added'));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/videos/${videoId}/captions`, { method: 'DELETE' });
      onChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Captions className="size-4 text-primary" aria-hidden />
      <span className="text-muted">{hasCaptions ? t('captions.has') : t('captions.none')}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={busy}
        onClick={() => picker.current?.click()}
      >
        <Upload aria-hidden /> {hasCaptions ? t('captions.replace') : t('captions.add')}
      </Button>
      {hasCaptions ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void remove()}
        >
          <Trash2 aria-hidden /> {t('captions.remove')}
        </Button>
      ) : null}
      <input
        ref={picker}
        type="file"
        accept=".vtt,text/vtt"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void upload(e.target.files?.[0])}
      />
    </div>
  );
}
