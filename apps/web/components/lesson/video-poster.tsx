import { Play } from 'lucide-react';
import { cn } from '@/lib/cn';

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(Math.round(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

/**
 * What a video looks like before it plays: its own still picture (or the Natik colours when it has
 * none), a large play button in the middle, and the title and length along the bottom. Pointing at
 * it brightens the picture and lifts the button, so it is clear it can be played.
 */
export function VideoPosterFace({
  posterUrl,
  title,
  durationSec,
  label,
  loading,
  onPlay,
  className,
}: {
  posterUrl: string | null;
  title: string;
  durationSec: number | null;
  /** Read out by screen readers, for example "Play video: Greetings". */
  label: string;
  loading?: boolean;
  onPlay: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={label}
      aria-busy={loading || undefined}
      className={cn(
        'group/video absolute inset-0 flex size-full cursor-pointer items-center justify-center overflow-hidden text-white',
        'bg-linear-to-br from-primary to-[#0b2a42] outline-offset-[-4px] focus-visible:outline-white',
        className,
      )}
    >
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- our own file or YouTube's thumbnail
        <img
          src={posterUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition duration-500 ease-out group-hover/video:scale-[1.03] motion-reduce:transition-none"
        />
      ) : null}
      <span
        className="absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-black/5 transition-opacity duration-300 group-hover/video:opacity-80"
        aria-hidden
      />
      <span
        className={cn(
          'relative flex size-16 items-center justify-center rounded-full bg-white/95 text-primary shadow-overlay ring-4 ring-white/25 transition duration-300 md:size-20',
          'group-hover/video:scale-110 group-hover/video:bg-white group-hover/video:ring-accent/60 group-active/video:scale-95',
          loading && 'animate-pulse',
        )}
        aria-hidden
      >
        <Play className="ms-1 size-7 fill-current md:size-9" />
      </span>
      <span
        className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 text-start md:p-4"
        aria-hidden
      >
        <span className="line-clamp-2 text-sm font-semibold drop-shadow md:text-base">{title}</span>
        {durationSec ? (
          <span className="shrink-0 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold tabular-nums">
            {formatDuration(durationSec)}
          </span>
        ) : null}
      </span>
    </button>
  );
}
