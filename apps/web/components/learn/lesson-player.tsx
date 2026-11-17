'use client';

import { reportProblemSchema } from '@natik/shared';
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  PartyPopper,
} from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { UnitList } from '@/components/learn/unit-list';
import { isGuided, lessonSteps } from '@/components/lesson/lesson-steps';
import { LessonView } from '@/components/lesson/lesson-view';
import { Alert } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FormActions } from '@/components/ui/form-field';
import { TextareaField } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toast';
import { api, useErrorMessage } from '@/lib/api/client';
import type { CompleteResult, LessonPage } from '@/lib/api/learn-types';
import { cn } from '@/lib/cn';
import { validate } from '@/lib/forms';

const OUTLINE_KEY = 'natik:outline';
const OUTLINE_EVENT = 'natik-outline-change';

/** Whether the course outline is open beside the lesson; remembered in this browser. */
function useOutlinePreference(): [boolean, () => void] {
  const open = useSyncExternalStore(
    (notify) => {
      window.addEventListener('storage', notify);
      window.addEventListener(OUTLINE_EVENT, notify);
      return () => {
        window.removeEventListener('storage', notify);
        window.removeEventListener(OUTLINE_EVENT, notify);
      };
    },
    () => {
      try {
        return localStorage.getItem(OUTLINE_KEY) !== 'closed';
      } catch {
        return true;
      }
    },
    () => true,
  );
  const toggle = () => {
    try {
      localStorage.setItem(OUTLINE_KEY, open ? 'closed' : 'open');
    } catch {
      // Not saved: it keeps its current state.
    }
    window.dispatchEvent(new Event(OUTLINE_EVENT));
  };
  return [open, toggle];
}

/**
 * The lesson page for a student: the lesson itself, a progress bar on top, and a sticky bar at the
 * bottom with Previous · Mark as complete · Next (FR-LEARN-002/003). Everything a thumb needs sits at
 * the bottom of the screen.
 */
export function LessonPlayer({ page }: { page: LessonPage }) {
  const t = useTranslations('learn');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const lessonId = page.lesson.id;
  const slug = page.course.slug;

  const [completed, setCompleted] = useState(page.state.completed);
  const [pct, setPct] = useState(page.state.progressPct);
  const [busy, setBusy] = useState(false);
  const [courseDone, setCourseDone] = useState(false);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const nextRef = useRef<HTMLAnchorElement>(null);

  // The guided path: which step the student is on, remembered between visits.
  const steps = lessonSteps(page.lesson);
  const guided = isGuided(steps);
  const [step, setStep] = useState(() =>
    page.state.completed ? 0 : Math.min(page.state.resume.stage, steps.length - 1),
  );
  const atEnd = !guided || step >= steps.length - 1;

  // The course outline beside the lesson on large screens; the student can fold it away.
  const [outlineOpen, toggleOutline] = useOutlinePreference();

  function goStep(index: number) {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!page.state.readOnly) {
      void api(`/learn/lessons/${lessonId}/resume`, {
        method: 'PUT',
        quiet: true,
        json: { stage: next },
      }).catch(() => undefined);
    }
  }

  const saveVideoPosition = useCallback(
    (videoId: string, seconds: number) => {
      void api(`/learn/lessons/${lessonId}/resume`, {
        method: 'PUT',
        quiet: true,
        json: { video: { id: videoId, sec: seconds } },
      }).catch(() => undefined);
    },
    [lessonId],
  );

  // Remember where the student is, so "Continue learning" comes back here (FR-LEARN-005).
  useEffect(() => {
    void api(`/learn/lessons/${lessonId}/open`, { method: 'POST', quiet: true }).catch(
      () => undefined,
    );
  }, [lessonId]);

  async function complete() {
    setBusy(true);
    setCompleted(true); // Optimistic: the bar updates at once, and goes back if the server says no.
    try {
      const result = await api<CompleteResult>(`/learn/lessons/${lessonId}/complete`, {
        method: 'POST',
      });
      setPct(result.progressPct);
      if (result.courseCompleted) setCourseDone(true);
      else toast.success(t('completedToast'));
      router.refresh();
      // Move focus to "Next" so keyboard and screen-reader users keep going.
      setTimeout(() => nextRef.current?.focus(), 50);
    } catch (error) {
      setCompleted(false);
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const navButton = 'min-w-11 px-0';
  const { prevId, nextId } = page.nav;

  return (
    <div className="flex flex-col gap-5 pb-24 md:relative md:left-1/2 md:w-[min(1100px,calc(100vw-2rem))] md:-translate-x-1/2">
      <div className="sticky top-0 z-20 -mx-4 flex flex-col gap-2 border-b border-border bg-canvas px-4 py-2 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/learn/${slug}`}
            aria-label={t('backToCourse')}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'px-2')}
          >
            <ArrowLeft className="rtl:rotate-180" aria-hidden />
          </Link>
          <p className="min-w-0 flex-1 truncate font-semibold">{page.course.title}</p>
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
            onClick={toggleOutline}
            aria-expanded={outlineOpen}
          >
            {outlineOpen ? <PanelLeftClose aria-hidden /> : <PanelLeftOpen aria-hidden />}
            {outlineOpen ? t('hideOutline') : t('showOutline')}
          </Button>
          <Sheet open={contentsOpen} onOpenChange={setContentsOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="md:hidden">
                <ListTree aria-hidden /> {t('contents')}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="p-4">
              <SheetTitle className="pb-3 text-lg font-semibold">{t('contentsTitle')}</SheetTitle>
              <UnitList
                units={page.units}
                slug={slug}
                currentId={lessonId}
                openAll
                onNavigate={() => setContentsOpen(false)}
              />
            </SheetContent>
          </Sheet>
        </div>
        <ProgressBar value={pct} size="sm" showValue />
      </div>

      <div
        className={cn(
          'md:grid md:items-start md:gap-8',
          outlineOpen && 'md:grid-cols-[17rem_minmax(0,1fr)]',
        )}
      >
        {outlineOpen ? (
          <aside
            aria-label={t('contentsTitle')}
            className="sticky top-4 hidden max-h-[calc(100dvh-9rem)] overflow-y-auto md:block"
          >
            <UnitList units={page.units} slug={slug} currentId={lessonId} />
          </aside>
        ) : null}
        <div className="mx-auto flex w-full max-w-[760px] min-w-0 flex-col gap-5">
          {page.state.readOnly && !courseDone ? (
            <Alert tone="success">{t('readOnly')}</Alert>
          ) : null}

          <p className="text-sm text-muted">
            {t('lessonOf', { n: page.nav.position, total: page.nav.total })}
          </p>
          <LessonView
            lesson={page.lesson}
            step={step}
            onStep={goStep}
            startVideoAt={page.state.resume.videos}
            onVideoPosition={page.state.readOnly ? undefined : saveVideoPosition}
          />

          {courseDone ? (
            <Card className="border-accent bg-accent-soft">
              <CardContent className="flex flex-col items-center gap-3 text-center">
                <PartyPopper className="size-8 text-accent-strong" aria-hidden />
                <h2 className="text-xl font-bold">{t('courseCompletedTitle')}</h2>
                <p className="text-muted">{t('courseCompletedText')}</p>
                <Link href={`/learn/${slug}`} className={buttonVariants({ variant: 'primary' })}>
                  {t('backToCourse')}
                </Link>
              </CardContent>
            </Card>
          ) : null}

          <p className="text-sm text-muted">
            {t('problemLine')}{' '}
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
            >
              {t('reportIt')}
            </button>
          </p>
        </div>
      </div>

      <nav
        aria-label={t('lessonOf', { n: page.nav.position, total: page.nav.total })}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-safe"
      >
        <div
          className={cn(
            'mx-auto flex w-full items-center gap-3 px-4 py-3',
            outlineOpen ? 'max-w-[1100px] md:ps-[20rem]' : 'max-w-[760px]',
          )}
        >
          {guided && step > 0 ? (
            <Button
              variant="secondary"
              className={navButton}
              aria-label={t('previousStep')}
              onClick={() => goStep(step - 1)}
            >
              <ChevronLeft aria-hidden className="rtl:rotate-180" />
            </Button>
          ) : prevId ? (
            <Link
              href={`/learn/${slug}/lessons/${prevId}`}
              aria-label={t('previous')}
              className={cn(buttonVariants({ variant: 'secondary' }), navButton)}
            >
              <ChevronLeft aria-hidden className="rtl:rotate-180" />
            </Link>
          ) : (
            <span
              aria-hidden
              className={cn(buttonVariants({ variant: 'secondary' }), navButton, 'opacity-40')}
            >
              <ChevronLeft className="rtl:rotate-180" />
            </span>
          )}

          <div className="flex-1">
            {!atEnd ? (
              <Button fullWidth onClick={() => goStep(step + 1)}>
                {t('nextStep')} <ChevronRight aria-hidden className="rtl:rotate-180" />
              </Button>
            ) : completed ? (
              <p
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-soft font-semibold text-accent-strong"
                role="status"
              >
                <Check className="size-5" aria-hidden /> {t('completed')}
              </p>
            ) : page.state.readOnly ? null : page.state.quiz ? (
              <Link
                href={`/learn/${slug}/quiz/${page.state.quiz.id}`}
                className={buttonVariants({ variant: 'primary', fullWidth: true })}
              >
                <ClipboardCheck aria-hidden /> {t('takeQuiz')}
              </Link>
            ) : (
              <Button fullWidth loading={busy} onClick={complete}>
                <Check aria-hidden /> {t('markComplete')}
              </Button>
            )}
          </div>

          {nextId ? (
            <Link
              ref={nextRef}
              href={`/learn/${slug}/lessons/${nextId}`}
              aria-label={t('next')}
              className={cn(
                buttonVariants({ variant: completed ? 'primary' : 'secondary' }),
                navButton,
                completed && !page.state.readOnly && 'animate-pulse',
              )}
            >
              <ChevronRight aria-hidden className="rtl:rotate-180" />
            </Link>
          ) : (
            <span
              aria-hidden
              className={cn(buttonVariants({ variant: 'secondary' }), navButton, 'opacity-40')}
            >
              <ChevronRight className="rtl:rotate-180" />
            </span>
          )}
        </div>
      </nav>

      <ReportDialog open={reporting} onOpenChange={setReporting} lessonId={lessonId} />
    </div>
  );
}

/** A short form to tell the centre something is wrong with this lesson (FR-LEARN-012). */
function ReportDialog({
  open,
  onOpenChange,
  lessonId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
}) {
  const t = useTranslations('learn');
  const tc = useTranslations('common');
  const errorMessage = useErrorMessage();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { data, errors } = validate(reportProblemSchema, { message });
    setError(errors.message);
    if (!data) return;
    setBusy(true);
    try {
      await api(`/learn/lessons/${lessonId}/report`, { method: 'POST', json: data });
      toast.success(t('reportSent'));
      setMessage('');
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('reportTitle')}</DialogTitle>
        <DialogDescription>{t('reportHint')}</DialogDescription>
        <form onSubmit={submit} noValidate className="mt-4 flex flex-col gap-4">
          <TextareaField
            label={t('reportLabel')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            error={error}
            rows={4}
            maxLength={1000}
            autoFocus
          />
          <FormActions>
            <Button type="submit" loading={busy}>
              {t('reportSend')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
