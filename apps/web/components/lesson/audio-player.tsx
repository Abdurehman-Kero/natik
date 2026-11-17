'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * Audio for language practice: play or pause, jump back 10 seconds to hear a phrase again, and slow
 * the speed down (FR-LEARN-008). Nothing downloads until the learner presses play.
 */
export function AudioPlayer({
  src,
  name,
  downloadUrl,
}: {
  src: string;
  name: string;
  downloadUrl?: string | null;
}) {
  const t = useTranslations('lessonView');
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [failed, setFailed] = useState(false);

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => setFailed(true));
    } else {
      el.pause();
    }
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]!;
    setSpeed(next);
    if (audio.current) audio.current.playbackRate = next;
  }

  const back10 = () => {
    if (audio.current) audio.current.currentTime = Math.max(0, audio.current.currentTime - 10);
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <audio
        ref={audio}
        src={src}
        preload="none"
        controlsList="nodownload"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          e.currentTarget.playbackRate = speed;
        }}
        onError={() => setFailed(true)}
      />
      <p className="mb-3 truncate text-sm font-semibold text-ink">{name}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t('pause') : t('playAudio')}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover"
        >
          {playing ? (
            <Pause className="size-5" aria-hidden />
          ) : (
            <Play className="size-5" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={back10}
          aria-label={t('back10')}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary-soft"
        >
          <RotateCcw className="size-5" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={Math.min(time, duration || 0)}
            onChange={(e) => {
              const value = Number(e.target.value);
              setTime(value);
              if (audio.current) audio.current.currentTime = value;
            }}
            aria-label={t('seek')}
            aria-valuetext={`${clock(time)} / ${clock(duration)}`}
            className="h-6 w-full cursor-pointer accent-[var(--color-primary)]"
          />
          <p className="text-xs text-muted tabular-nums" aria-hidden>
            {clock(time)} / {clock(duration)}
          </p>
        </div>
        <button
          type="button"
          onClick={cycleSpeed}
          aria-label={t('speed', { speed })}
          className={cn(
            'min-h-11 min-w-12 shrink-0 rounded-lg border border-border-strong px-2 text-sm font-semibold text-primary tabular-nums hover:bg-primary-soft',
          )}
        >
          {speed}×
        </button>
      </div>
      {failed ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {t('audioFailed')}
        </p>
      ) : null}
      {downloadUrl ? (
        <a
          href={downloadUrl}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
        >
          {t('download')}
        </a>
      ) : null}
    </div>
  );
}
