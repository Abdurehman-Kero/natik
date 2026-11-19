'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { VideoPosterFace } from '@/components/lesson/video-poster';

/** YouTube's own thumbnail for a YouTube player address; Vimeo has none we can link to directly. */
function youtubeThumbnail(embedUrl: string): string | null {
  const id = /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/.exec(embedUrl)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/**
 * The course trailer: the video's real thumbnail with a play button. The YouTube or Vimeo player is
 * only loaded after a tap, so the page stays light on slow phones and nothing is sent to the video
 * site until the visitor chooses to watch.
 */
export function TrailerPlayer({ embedUrl, title }: { embedUrl: string; title: string }) {
  const t = useTranslations('courses');
  const [playing, setPlaying] = useState(false);
  const src = playing ? `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}autoplay=1` : '';
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-primary shadow-card">
      {playing ? (
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 size-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <VideoPosterFace
          posterUrl={youtubeThumbnail(embedUrl)}
          title={title}
          durationSec={null}
          label={`${t('watchTrailer')}: ${title}`}
          onPlay={() => setPlaying(true)}
        />
      )}
    </div>
  );
}
