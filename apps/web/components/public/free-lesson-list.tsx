import { AudioLines, FileText, Play, PlayCircle, Type } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { formatDuration } from '@/components/lesson/video-poster';
import type { PublicFreeLesson } from '@/lib/api/public';
import { contentLang } from '@/lib/script';

/**
 * Shown only when a lesson has no video picture and its course has no picture either.
 * Stand-in photos: see plan/assets/IMAGE-CREDITS.md. Neighbouring cards get different ones.
 */
const PHOTOS = [
  '/images/lessons/lesson-1.jpg',
  '/images/lessons/lesson-2.jpg',
  '/images/lessons/lesson-3.jpg',
];

const ICON: Record<string, typeof Type> = {
  VIDEO: PlayCircle,
  PDF: FileText,
  AUDIO: AudioLines,
  TEXT: Type,
};

/** Free lessons as cards: a picture, the lesson, and which course it belongs to. */
export async function FreeLessonList({ lessons }: { lessons: PublicFreeLesson[] }) {
  const t = await getTranslations('freeLessons');
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lessons.map((lesson, index) => {
        const title = contentLang(lesson.title);
        return (
          <li key={lesson.id}>
            <Link
              href={`/courses/${lesson.course.slug}/lessons/${lesson.id}`}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-overlay"
            >
              <div className="relative aspect-video overflow-hidden bg-primary">
                {lesson.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- the video's own picture
                  <img
                    src={lesson.posterUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <Image
                    src={lesson.course.imageUrl ?? PHOTOS[index % PHOTOS.length]!}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                )}
                <span
                  className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent"
                  aria-hidden
                />
                <span className="absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full bg-white/95 text-primary shadow-overlay transition duration-300 group-hover:scale-110">
                  <Play className="ms-0.5 size-6 fill-current" aria-hidden />
                </span>
                {lesson.durationSec ? (
                  <span className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                    {formatDuration(lesson.durationSec)}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <h3
                  {...title}
                  className="line-clamp-2 text-lg leading-snug font-semibold group-hover:underline group-hover:decoration-accent group-hover:decoration-2 group-hover:underline-offset-4"
                >
                  {lesson.title}
                </h3>
                <p className="text-sm text-muted">
                  {lesson.course.language.name} · {lesson.course.level}
                </p>
                <p className="mt-auto flex items-center gap-2 pt-2 text-sm text-muted">
                  {lesson.blockTypes.slice(0, 4).map((type) => {
                    const Icon = ICON[type] ?? Type;
                    return <Icon key={type} className="size-4" aria-hidden />;
                  })}
                  <span className="ms-auto font-semibold text-primary">{t('watch')}</span>
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
