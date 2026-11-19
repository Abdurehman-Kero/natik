import type { ContentStatus, EnrolmentStatus, PaymentStatus } from '@natik/shared';
import {
  Award,
  CalendarX,
  Check,
  CirclePlay,
  CircleX,
  Clock,
  EyeOff,
  Globe,
  Hourglass,
  type LucideIcon,
  Pencil,
  RotateCcw,
  Wallet,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

export type StatusKey =
  | `enrolment.${EnrolmentStatus}`
  | `payment.${PaymentStatus}`
  | `content.${ContentStatus}`
  | 'quiz.passed'
  | 'quiz.failed'
  | 'quiz.waiting';

type Tone = 'primary' | 'accent' | 'warning' | 'muted' | 'danger' | 'success';

/** One mapping for the whole product (DESIGN.md §7): same status, same look, everywhere. */
const STATUS: Record<StatusKey, { tone: Tone; icon: LucideIcon }> = {
  'enrolment.ACTIVE': { tone: 'primary', icon: CirclePlay },
  'enrolment.COMPLETED': { tone: 'accent', icon: Award },
  'enrolment.AWAITING_APPROVAL': { tone: 'warning', icon: Hourglass },
  'enrolment.AWAITING_PAYMENT': { tone: 'warning', icon: Wallet },
  'enrolment.PAYMENT_SUBMITTED': { tone: 'warning', icon: Clock },
  'enrolment.EXPIRED': { tone: 'muted', icon: CalendarX },
  'enrolment.CANCELLED': { tone: 'danger', icon: CircleX },
  'payment.SUBMITTED': { tone: 'warning', icon: Clock },
  'payment.CONFIRMED': { tone: 'success', icon: Check },
  'payment.REJECTED': { tone: 'danger', icon: X },
  'content.DRAFT': { tone: 'muted', icon: Pencil },
  'content.PUBLISHED': { tone: 'success', icon: Globe },
  'content.HIDDEN': { tone: 'muted', icon: EyeOff },
  'quiz.passed': { tone: 'accent', icon: Award },
  'quiz.failed': { tone: 'danger', icon: RotateCcw },
  'quiz.waiting': { tone: 'warning', icon: Hourglass },
};

export const toneClass: Record<Tone, string> = {
  primary: 'bg-primary-soft text-primary',
  accent: 'bg-accent-soft text-accent-strong',
  warning: 'bg-warning-soft text-warning',
  muted: 'bg-subtle text-muted',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success-soft text-success',
};

export interface StatusPillProps {
  status: StatusKey;
  size?: 'sm' | 'md';
  className?: string;
}

/** Icon + word, never colour alone (DESIGN.md §2). */
export function StatusPill({ status, size = 'md', className }: StatusPillProps) {
  const t = useTranslations('status');
  const { tone, icon: Icon } = STATUS[status];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        toneClass[tone],
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
      {t(status)}
    </span>
  );
}

export const STATUS_KEYS = Object.keys(STATUS) as StatusKey[];
