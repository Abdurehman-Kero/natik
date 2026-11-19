'use client';

import {
  ArrowRight,
  Award,
  Bell,
  CalendarDays,
  Compass,
  Globe,
  GraduationCap,
  LayoutGrid,
  Menu,
  type LucideIcon,
  Search,
  Sparkles,
  UserCheck,
  UserPlus,
  UserRound,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useAuthDialog } from '@/components/auth/auth-dialog';
import { Button, LinkButton } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/use-session';
import { placeCard } from './place-card';

export type TourVariant = 'public' | 'student';

interface TourStep {
  id: string;
  icon: LucideIcon;
  /** CSS selectors for the part of the page to point at; the first one on screen wins. */
  targets?: string[];
}

const PUBLIC_STEPS: TourStep[] = [
  { id: 'welcome', icon: Sparkles },
  {
    id: 'browse',
    icon: Compass,
    targets: ['[data-tour="nav"]', '[data-tour="menu"]'],
  },
  { id: 'search', icon: Search, targets: ['[data-tour="search"]'] },
  { id: 'language', icon: Globe, targets: ['[data-tour="language"]'] },
  { id: 'account', icon: UserRound, targets: ['[data-tour="account"]'] },
  { id: 'journey', icon: Award },
];

const STUDENT_STEPS: TourStep[] = [
  { id: 'welcome', icon: Sparkles },
  {
    id: 'menu',
    icon: Menu,
    targets: ['[data-tour="student-menu"]', '[data-tour="student-nav"]'],
  },
  { id: 'tabs', icon: LayoutGrid, targets: ['[data-tour="student-tabs"]'] },
  { id: 'bell', icon: Bell, targets: ['[data-tour="student-bell"]'] },
  { id: 'account', icon: UserRound, targets: ['[data-tour="student-account"]'] },
  { id: 'finish', icon: GraduationCap },
];

/**
 * One tour per area. `key` remembers in the browser that it was seen or skipped; the offer card
 * appears quietly on `offerPath` the first time.
 */
const CONFIG: Record<
  TourVariant,
  { key: string; offerPath: string; steps: TourStep[]; namespace: 'site.tour' | 'site.studentTour' }
> = {
  public: {
    key: 'natik.tour.v1',
    offerPath: '/',
    steps: PUBLIC_STEPS,
    namespace: 'site.tour',
  },
  student: {
    key: 'natik.tour.student.v1',
    offerPath: '/dashboard',
    steps: STUDENT_STEPS,
    namespace: 'site.studentTour',
  },
};

const JOURNEY_ICONS = [UserPlus, UserCheck, CalendarDays, Award];
const STUDENT_LIST_ICONS = [Compass, UserCheck, CalendarDays];

function readSeen(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return true;
  }
}
function markSeen(key: string) {
  try {
    localStorage.setItem(key, 'done');
  } catch {
    // private window: the tour may be offered again next time, which is fine
  }
}

/** The first element for these selectors that is actually on screen. */
function findTarget(selectors?: string[]): HTMLElement | null {
  for (const selector of selectors ?? []) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const box = el.getBoundingClientRect();
      if (box.width > 0 && box.height > 0) return el;
    }
  }
  return null;
}

interface TourApi {
  start: () => void;
}
const TourContext = createContext<TourApi | null>(null);

/** Start the guided tour from any button. Does nothing outside the public site. */
export function useTour(): TourApi {
  return useContext(TourContext) ?? { start: () => undefined };
}

export function TourProvider({
  children,
  variant = 'public',
}: {
  children: ReactNode;
  variant?: TourVariant;
}) {
  const config = CONFIG[variant];
  const [running, setRunning] = useState(false);
  const [offer, setOffer] = useState(false);
  const pathname = usePathname();

  const start = useCallback(() => {
    markSeen(config.key);
    setOffer(false);
    window.scrollTo({ top: 0 });
    setRunning(true);
  }, [config.key]);
  const value = useMemo(() => ({ start }), [start]);

  // First visit to the home page: a small, quiet invitation (never a blocking pop-up). Automated
  // browsers (tests, crawlers) are never invited.
  useEffect(() => {
    if (pathname !== config.offerPath || navigator.webdriver || readSeen(config.key)) return;
    const timer = window.setTimeout(() => setOffer(true), 3500);
    return () => window.clearTimeout(timer);
  }, [pathname, config.offerPath, config.key]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {offer && pathname === config.offerPath && !running ? (
        <TourOffer
          variant={variant}
          onStart={start}
          onSkip={() => {
            markSeen(config.key);
            setOffer(false);
          }}
        />
      ) : null}
      {running ? <TourRun variant={variant} onClose={() => setRunning(false)} /> : null}
    </TourContext.Provider>
  );
}

function TourOffer({
  variant,
  onStart,
  onSkip,
}: {
  variant: TourVariant;
  onStart: () => void;
  onSkip: () => void;
}) {
  const t = useTranslations('site.tour');
  return (
    <div
      role="region"
      aria-label={variant === 'student' ? t('studentOfferTitle') : t('offerTitle')}
      className="fixed inset-x-3 bottom-20 z-40 animate-pop-in rounded-2xl border border-border bg-surface p-4 shadow-overlay sm:inset-x-auto sm:left-5 sm:w-[22rem] lg:bottom-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {variant === 'student' ? t('studentOfferTitle') : t('offerTitle')}
          </p>
          <p className="text-sm text-muted">
            {variant === 'student' ? t('studentOfferText') : t('offerText')}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onStart} className="flex-1">
          {t('offerStart')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onSkip}>
          {t('offerSkip')}
        </Button>
      </div>
    </div>
  );
}

function TourRun({ variant, onClose }: { variant: TourVariant; onClose: () => void }) {
  const config = CONFIG[variant];
  const t = useTranslations('site.tour');
  const tc = useTranslations(config.namespace);
  const { user } = useSession();
  const auth = useAuthDialog();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // The card's real size, so it can be kept fully on screen wherever it is placed.
  const [cardHeight, setCardHeight] = useState(300);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  // Steps that point at something that is not on this screen (the language button on a small phone)
  // are left out, so the tour never points at nothing.
  const steps = useMemo(
    () => config.steps.filter((s) => !s.targets || findTarget(s.targets)),
    [config.steps],
  );
  const step = steps[index] ?? steps[0]!;
  const last = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = findTarget(step.targets);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [measure]);

  useLayoutEffect(() => {
    const height = cardRef.current?.offsetHeight;
    if (height) setCardHeight((current) => (current === height ? current : height));
    // The text (and so the height) changes with the step and with the width of the window.
  }, [index, rect]);

  useEffect(() => {
    nextRef.current?.focus();
  }, [index]);

  const finish = useCallback(
    (skipped: boolean) => {
      onClose();
      if (skipped) toast(t('restartHint'));
    },
    [onClose, t],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish(true);
      else if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1));
      else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else if (event.key === 'Tab') {
        // Keep the keyboard inside the tour card.
        const items = cardRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!items || items.length === 0) return;
        const first = items[0]!;
        const lastItem = items[items.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish, steps.length]);

  const Icon = step.icon;
  const journey = (variant === 'student' ? tc.raw('list') : tc.raw('journey')) as string[];

  // Where the card sits: beside the highlighted part on larger screens (always fully on screen, see
  // placeCard), the top or bottom edge on phones, the middle of the screen for steps that do not point
  // at anything.
  let cardStyle: CSSProperties = {};
  let cardClass =
    'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(26rem,calc(100vw-1.5rem))]';
  if (rect) {
    if (window.innerWidth < 640) {
      // On the opposite half from the highlighted part, so the card never covers what it points at.
      cardClass =
        rect.top + rect.height / 2 > window.innerHeight / 2
          ? 'inset-x-3 top-3'
          : 'inset-x-3 bottom-3';
    } else {
      const width = Math.min(384, window.innerWidth - 24);
      const spot = {
        top: rect.top - 6,
        left: rect.left - 6,
        right: rect.right + 6,
        bottom: rect.bottom + 6,
      };
      const { top, left } = placeCard(
        spot,
        { width, height: cardHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      cardStyle = { top, left, width };
      cardClass = '';
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* Blocks clicks on the page behind, and darkens it. */}
      <div className="absolute inset-0" onClick={() => undefined} aria-hidden />
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-xl ring-2 ring-accent transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: '0 0 0 9999px rgb(10 30 48 / 0.66)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-ink/65" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className={cn('fixed animate-pop-in rounded-2xl bg-surface p-5 shadow-overlay', cardClass)}
        style={cardStyle}
      >
        <button
          type="button"
          onClick={() => finish(true)}
          aria-label={t('close')}
          className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="flex items-center gap-3 pe-8">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-wider text-accent-strong uppercase">
              {t('step', { n: index + 1, total: steps.length })}
            </p>
            <h2 id="tour-title" className="text-lg leading-snug font-bold">
              {tc(`steps.${step.id}.title` as never)}
            </h2>
          </div>
        </div>
        <p className="mt-3 text-muted">{tc(`steps.${step.id}.text` as never)}</p>

        {step.id === 'journey' || step.id === 'finish' ? (
          <ol className="mt-4 flex flex-col gap-2">
            {journey.map((text, i) => {
              const StepIcon =
                (variant === 'student' ? STUDENT_LIST_ICONS : JOURNEY_ICONS)[i] ?? Award;
              return (
                <li key={text} className="flex items-center gap-3 rounded-xl bg-canvas p-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <StepIcon className="size-4.5" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{text}</span>
                </li>
              );
            })}
          </ol>
        ) : null}

        <div className="mt-5 flex items-center gap-1" aria-hidden>
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-accent' : 'w-1.5 bg-border-strong',
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {index > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setIndex(index - 1)}>
              {t('back')}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => finish(true)}>
              {t('skip')}
            </Button>
          )}
          {last && variant === 'student' ? (
            <LinkButton href="/browse" size="sm" onClick={() => finish(false)}>
              {tc('browse')}
            </LinkButton>
          ) : last && !user ? (
            <Button
              size="sm"
              ref={nextRef}
              onClick={() => {
                finish(false);
                auth.open('register');
              }}
            >
              {t('createAccount')}
            </Button>
          ) : (
            <Button
              size="sm"
              ref={nextRef}
              onClick={() => (last ? finish(false) : setIndex(index + 1))}
            >
              {last ? t('done') : t('next')}
              {last ? null : <ArrowRight className="rtl:rotate-180" aria-hidden />}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
