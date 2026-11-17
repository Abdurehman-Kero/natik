'use client';

import { Check, ChevronLeft, ChevronRight, Clock, FileQuestion, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { LessonViewBlock, LessonViewModel } from '@/lib/api/types';
import { AudioPlayer } from './audio-player';
import { isGuided, type LessonStep, lessonSteps } from './lesson-steps';
import { PdfViewer } from './pdf-viewer';
import { SlideViewer } from './slide-viewer';
import { VideoEmbed } from './video-embed';

interface VideoProps {
  startAt: Record<string, number>;
  onPosition?: (videoId: string, seconds: number) => void;
}

function BlockView({
  block,
  dir,
  lang,
  video,
}: {
  block: LessonViewBlock;
  dir: 'ltr' | 'rtl';
  lang: string;
  video: VideoProps;
}) {
  switch (block.type) {
    case 'TEXT':
      return (
        <div
          className="lesson-prose"
          dir={dir}
          // Safe: the API builds this HTML from an allow-list of tags and attributes (rich-text.ts).
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );
    case 'IMAGE':
      return (
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.url}
            alt={block.caption ?? ''}
            loading="lazy"
            className="w-full rounded-2xl border border-border bg-surface"
          />
          {block.caption ? (
            <figcaption className="text-sm text-muted" dir={dir}>
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case 'PDF':
      return (
        <PdfViewer
          src={block.url}
          name={block.name}
          sizeBytes={block.sizeBytes}
          downloadUrl={block.downloadUrl}
        />
      );
    case 'AUDIO':
      return <AudioPlayer src={block.url} name={block.name} downloadUrl={block.downloadUrl} />;
    case 'SLIDES':
      return <SlideViewer slides={block.slides} dir={dir} />;
    case 'VIDEO':
      return (
        <VideoEmbed
          videoId={block.videoId}
          title={block.title}
          status={block.status}
          durationSec={block.durationSec}
          posterUrl={block.posterUrl}
          startAt={video.startAt[block.videoId] ?? 0}
          onPosition={video.onPosition}
          lang={lang}
        />
      );
  }
}

/** Title line of the lesson: what it is about, what you will be able to do, and how long it takes. */
function Intro({ lesson }: { lesson: LessonViewModel }) {
  const t = useTranslations('lessonView');
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
      {lesson.estimatedMinutes ? (
        <p className="flex items-center gap-2 font-semibold text-primary">
          <Clock className="size-5" aria-hidden /> {t('minutes', { n: lesson.estimatedMinutes })}
        </p>
      ) : null}
      {lesson.description ? <p className="text-lg leading-relaxed">{lesson.description}</p> : null}
      {lesson.objectives.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Target className="size-5 text-accent-strong" aria-hidden /> {t('objectives')}
          </h2>
          <ul className="flex flex-col gap-2">
            {lesson.objectives.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StepContent({
  step,
  lesson,
  video,
}: {
  step: LessonStep;
  lesson: LessonViewModel;
  video: VideoProps;
}) {
  if (step.key === 'INTRO') return <Intro lesson={lesson} />;
  return (
    <>
      {step.blocks.map((block) => (
        <BlockView
          key={block.id}
          block={block}
          dir={lesson.course.dir}
          lang={lesson.course.lang}
          video={video}
        />
      ))}
    </>
  );
}

/**
 * What a student sees for one lesson. Used for the teacher's preview and for students and free-lesson
 * visitors, so a preview is always exactly what students get. The text direction and language come
 * from the course language (FR-LEARN-011).
 *
 * A lesson whose blocks are put in stages becomes a short guided path (intro, prepare, watch, revise,
 * examples). Pass `step` and `onStep` to drive the path from outside (the student player does, so its
 * bottom bar can offer "Next step"); without them the view keeps its own step and shows Back and Next.
 */
export function LessonView({
  lesson,
  step,
  onStep,
  startVideoAt = {},
  onVideoPosition,
}: {
  lesson: LessonViewModel;
  step?: number;
  onStep?: (index: number) => void;
  startVideoAt?: Record<string, number>;
  onVideoPosition?: (videoId: string, seconds: number) => void;
}) {
  const t = useTranslations('lessonView');
  const steps = lessonSteps(lesson);
  const guided = isGuided(steps);
  const [own, setOwn] = useState(0);
  const controlled = step !== undefined;
  const current = Math.min(controlled ? step : own, steps.length - 1);
  const go = (index: number) => (controlled ? onStep?.(index) : setOwn(index));
  const video: VideoProps = { startAt: startVideoAt, onPosition: onVideoPosition };

  return (
    <article lang={lesson.course.lang} dir={lesson.course.dir} className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold md:text-3xl">{lesson.title}</h1>

      {steps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted">
          <FileQuestion className="size-8" aria-hidden />
          <p>{t('empty')}</p>
        </div>
      ) : !guided ? (
        <StepContent step={steps[0]!} lesson={lesson} video={video} />
      ) : (
        <>
          <nav
            aria-label={t('steps')}
            className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4"
          >
            <ol className="flex w-max min-w-full gap-2">
              {steps.map((s, index) => (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => go(index)}
                    aria-current={index === current ? 'step' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold whitespace-nowrap',
                      index === current
                        ? 'border-primary bg-primary text-white'
                        : index < current
                          ? 'border-accent bg-accent-soft text-accent-strong'
                          : 'border-border-strong bg-surface text-ink hover:border-primary',
                    )}
                  >
                    {index < current ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <span className="tabular-nums" aria-hidden>
                        {index + 1}
                      </span>
                    )}
                    {t(`step.${s.key}`)}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <div key={steps[current]!.key} className="flex flex-col gap-6">
            <StepContent step={steps[current]!} lesson={lesson} video={video} />
          </div>
          {!controlled ? (
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => go(current - 1)} disabled={current === 0}>
                <ChevronLeft className="rtl:rotate-180" aria-hidden /> {t('back')}
              </Button>
              <Button onClick={() => go(current + 1)} disabled={current === steps.length - 1}>
                {t('nextStep')} <ChevronRight className="rtl:rotate-180" aria-hidden />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </article>
  );
}
