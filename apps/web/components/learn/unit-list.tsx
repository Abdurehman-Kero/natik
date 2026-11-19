import { formatDate } from '@natik/shared';
import { Check, ChevronDown, Circle, CircleDot, Lock } from 'lucide-react';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { OutlineUnit } from '@/lib/api/learn-types';

/** Marks a session added in the last few days that the student has not opened yet. */
function NewBadge() {
  const t = useTranslations('learn');
  return (
    <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-bold tracking-wide text-white uppercase">
      {t('new')}
    </span>
  );
}

/** "Greetings" with its date underneath, when the teacher set one. */
function SessionTitle({ lesson }: { lesson: OutlineUnit['lessons'][number] }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{lesson.title}</span>
      {lesson.sessionDate ? (
        <span className="text-xs font-normal text-muted">{formatDate(lesson.sessionDate)}</span>
      ) : null}
    </span>
  );
}

/** ✓ done (gold) · ● where you are · ○ not started. Never colour alone: each has its own shape and label. */
function StateIcon({ state }: { state: 'done' | 'current' | 'todo' | 'locked' }) {
  const t = useTranslations('learn');
  if (state === 'locked') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center text-muted">
        <Lock className="size-5" aria-hidden />
        <span className="sr-only">{t('stateLocked')}</span>
      </span>
    );
  }
  if (state === 'done') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-ink">
        <Check className="size-4" aria-hidden />
        <span className="sr-only">{t('stateDone')}</span>
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center text-primary">
        <CircleDot className="size-6" aria-hidden />
        <span className="sr-only">{t('stateCurrent')}</span>
      </span>
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center text-border-strong">
      <Circle className="size-6" aria-hidden />
      <span className="sr-only">{t('stateTodo')}</span>
    </span>
  );
}

/**
 * Units that fold open, each with its lessons and their state (FR-LEARN-001). The unit the student is
 * in starts open. Used on the course outline and in the lesson's "Contents" panel.
 */
export function UnitList({
  units,
  slug,
  currentId,
  openAll,
  onNavigate,
}: {
  units: OutlineUnit[];
  slug: string;
  /** The lesson being read, highlighted in the list. */
  currentId?: string;
  openAll?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('learn');
  return (
    <div className="flex flex-col gap-3">
      {units.map((unit, unitIndex) => {
        const hasCurrent = unit.lessons.some((l) => l.state === 'current' || l.id === currentId);
        return (
          <details
            key={unit.id}
            open={openAll || hasCurrent || undefined}
            className="group rounded-xl border border-border bg-surface"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
              <ChevronDown
                className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                aria-hidden
              />
              <span className="min-w-0 flex-1 font-semibold">
                <span className="text-muted">{t('weekN', { n: unitIndex + 1 })} · </span>
                {unit.title}
              </span>
              {unit.lessons.some((l) => l.isNew) ? <NewBadge /> : null}
              <span className="text-sm text-muted tabular-nums">
                {t('unitCount', { done: unit.done, total: unit.total })}
              </span>
            </summary>
            <ul className="flex flex-col border-t border-border">
              {unit.lessons.map((lesson) =>
                lesson.state === 'locked' ? (
                  <li key={lesson.id}>
                    <p className="flex min-h-12 items-center gap-3 px-4 py-2 text-muted">
                      <StateIcon state="locked" />
                      <SessionTitle lesson={lesson} />
                    </p>
                  </li>
                ) : (
                  <li key={lesson.id}>
                    <Link
                      href={`/learn/${slug}/lessons/${lesson.id}`}
                      onClick={onNavigate}
                      aria-current={lesson.id === currentId ? 'page' : undefined}
                      className={cn(
                        'flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-canvas',
                        lesson.id === currentId && 'bg-primary-soft font-semibold',
                      )}
                    >
                      <StateIcon state={lesson.state} />
                      <SessionTitle lesson={lesson} />
                      {lesson.isNew ? <NewBadge /> : null}
                      {lesson.minutes ? (
                        <span className="text-sm font-normal text-muted tabular-nums">
                          {t('minutesShort', { n: lesson.minutes })}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
