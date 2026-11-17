'use client';

import { Pause, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatDuration } from '@/lib/chat/format';

/** A voice message: play button, progress bar and time, like Telegram. `onDark` is for my own (navy) bubbles. */
export function VoicePlayer({
  src,
  durationSec,
  onDark,
}: {
  src: string;
  durationSec: number;
  onDark?: boolean;
}) {
  const t = useTranslations('chat');
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(durationSec);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const tick = () => setTime(el.currentTime);
    const meta = () => Number.isFinite(el.duration) && el.duration > 0 && setLength(el.duration);
    const end = () => {
      setPlaying(false);
      setTime(0);
    };
    el.addEventListener('timeupdate', tick);
    el.addEventListener('loadedmetadata', meta);
    el.addEventListener('ended', end);
    return () => {
      el.removeEventListener('timeupdate', tick);
      el.removeEventListener('loadedmetadata', meta);
      el.removeEventListener('ended', end);
    };
  }, []);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      void el.play().then(() => setPlaying(true));
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function seek(event: React.ChangeEvent<HTMLInputElement>) {
    const el = audio.current;
    if (!el || !length) return;
    el.currentTime = (Number(event.target.value) / 100) * length;
    setTime(el.currentTime);
  }

  const pct = length ? Math.min(100, (time / length) * 100) : 0;
  return (
    <div className="flex w-56 max-w-full items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t('pause') : t('play')}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-full',
          onDark ? 'bg-white text-primary' : 'bg-primary text-white',
        )}
      >
        {playing ? (
          <Pause className="size-5" aria-hidden />
        ) : (
          <Play className="size-5" aria-hidden />
        )}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          onChange={seek}
          aria-label={t('voice')}
          className={cn('h-2 w-full cursor-pointer', onDark ? 'accent-white' : 'accent-primary')}
        />
        <span className={cn('text-xs tabular-nums', onDark ? 'text-white/80' : 'text-muted')}>
          {formatDuration(playing || time > 0 ? time : length)}
        </span>
      </div>
      <audio ref={audio} src={src} preload="metadata" />
    </div>
  );
}
