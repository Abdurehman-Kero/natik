'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { api, useErrorMessage } from '@/lib/api/client';
import type { VideoPlayback } from '@/lib/api/types';
import { VideoPosterFace } from './video-poster';

interface VideoEmbedProps {
  videoId: string;
  title: string;
  status: string;
  durationSec: number | null;
  /** Where the student stopped last time, in seconds (videos we host only). */
  startAt?: number;
  /** Called every few seconds while playing, and when paused or finished. */
  onPosition?: (videoId: string, seconds: number) => void;
  /** Language code of the captions file, for the player's caption menu. */
  lang?: string;
  /** The video's still picture, shown until it plays. */
  posterUrl?: string | null;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const REPORT_EVERY_MS = 10_000;

/**
 * The video's own still picture with a play button. The player is only loaded after a tap, so the page
 * stays light on slow phones: no autoplay, no preload (FR-LEARN-006). The link is fetched fresh on each
 * play, after the server checks access.
 */
export function VideoEmbed({
  videoId,
  title,
  status,
  durationSec,
  startAt = 0,
  onPosition,
  lang,
  posterUrl = null,
}: VideoEmbedProps) {
  const t = useTranslations('lessonView');
  const errorMessage = useErrorMessage();
  const [playback, setPlayback] = useState<VideoPlayback | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const video = useRef<HTMLVideoElement>(null);
  const lastReport = useRef(0);

  function report(force = false) {
    const el = video.current;
    if (!el || !onPosition) return;
    const now = Date.now();
    if (!force && now - lastReport.current < REPORT_EVERY_MS) return;
    lastReport.current = now;
    onPosition(videoId, el.currentTime);
  }

  function changeSpeed(value: number) {
    setSpeed(value);
    if (video.current) video.current.playbackRate = value;
  }

  async function start() {
    setLoading(true);
    setError(null);
    try {
      setPlayback(await api<VideoPlayback>(`/videos/${videoId}/embed`));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const ready = status === 'READY';

  return (
    <figure className="overflow-hidden rounded-2xl bg-primary shadow-card">
      <div className="relative aspect-video w-full">
        {playback?.kind === 'iframe' ? (
          <iframe
            src={playback.url}
            title={title}
            className="absolute inset-0 size-full"
            loading="lazy"
            allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : playback?.kind === 'file' ? (
          <video
            ref={video}
            src={playback.url}
            title={title}
            onLoadedMetadata={(e) => {
              const el = e.currentTarget;
              // Pick up where the student stopped, unless they had nearly finished it.
              if (startAt > 3 && (!Number.isFinite(el.duration) || startAt < el.duration - 5)) {
                el.currentTime = startAt;
              }
              el.playbackRate = speed;
            }}
            onTimeUpdate={() => report()}
            onPause={() => report(true)}
            onEnded={() => onPosition?.(videoId, 0)}
            className="absolute inset-0 size-full bg-black"
            poster={posterUrl ?? undefined}
            controls
            autoPlay
            playsInline
            preload="none"
            controlsList="nodownload"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
          >
            {playback.captionsUrl ? (
              <track
                kind="captions"
                src={playback.captionsUrl}
                srcLang={lang ?? 'und'}
                label={t('captions')}
                default
              />
            ) : null}
          </video>
        ) : ready ? (
          <VideoPosterFace
            posterUrl={posterUrl}
            title={title}
            durationSec={durationSec}
            label={t('playVideo', { title })}
            loading={loading}
            onPlay={start}
          />
        ) : (
          <div className="on-dark absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
            {status === 'FAILED' ? (
              <p className="flex items-center gap-2 text-white">
                <TriangleAlert className="size-5 shrink-0" aria-hidden /> {t('videoFailed')}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-white" role="status">
                <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />{' '}
                {t('videoProcessing')}
              </p>
            )}
          </div>
        )}
      </div>
      {playback?.kind === 'file' ? (
        <figcaption className="flex items-center justify-end gap-2 bg-surface px-3 py-1.5 text-sm">
          <label htmlFor={`speed-${videoId}`} className="text-muted">
            {t('playbackSpeed')}
          </label>
          <select
            id={`speed-${videoId}`}
            value={speed}
            onChange={(e) => changeSpeed(Number(e.target.value))}
            className="h-11 rounded-lg border border-border-strong bg-surface px-2 font-semibold text-ink"
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {value}x
              </option>
            ))}
          </select>
        </figcaption>
      ) : null}
      {error ? (
        <figcaption className="bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {error}{' '}
          <button type="button" className="font-semibold underline" onClick={start}>
            {t('tryAgain')}
          </button>
        </figcaption>
      ) : null}
    </figure>
  );
}
