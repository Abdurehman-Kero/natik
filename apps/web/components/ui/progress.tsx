import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export interface ProgressBarProps {
  value: number;
  size?: 'sm' | 'md';
  /** Show "42%" next to the bar. */
  showValue?: boolean;
  label?: string;
  /** For a navy background: light track, gold bar, white number. */
  onDark?: boolean;
  className?: string;
}

/** Course or upload progress. Turns gold at 100% (achievement, DESIGN.md §4). */
export function ProgressBar({
  value,
  size = 'md',
  showValue,
  label,
  onDark,
  className,
}: ProgressBarProps) {
  const t = useTranslations('progress');
  const v = clamp(value);
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        aria-label={label ?? t('complete', { value: v })}
        className={cn(
          'flex-1 overflow-hidden rounded-full',
          onDark ? 'bg-white/25' : 'bg-primary-soft',
          size === 'sm' ? 'h-1.5' : 'h-2.5',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            v >= 100 || onDark ? 'bg-accent' : 'bg-primary',
          )}
          style={{ width: `${v}%` }}
        />
      </div>
      {showValue ? (
        <span
          className={cn(
            'w-10 shrink-0 text-right text-sm font-semibold tabular-nums',
            onDark ? 'text-white' : 'text-ink',
          )}
        >
          {v}%
        </span>
      ) : null}
    </div>
  );
}

export interface ProgressRingProps {
  value: number;
  /** "accent" (gold) for a passed result, "primary" otherwise. */
  tone?: 'primary' | 'accent';
  size?: 'md' | 'lg';
  label?: string;
  className?: string;
}

/** Big score ring for quiz results. */
export function ProgressRing({
  value,
  tone = 'primary',
  size = 'lg',
  label,
  className,
}: ProgressRingProps) {
  const t = useTranslations('progress');
  const v = clamp(value);
  const px = size === 'lg' ? 128 : 96;
  const stroke = size === 'lg' ? 10 : 8;
  const radius = (px - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="img"
      aria-label={label ?? t('complete', { value: v })}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: px, height: px }}
    >
      <svg width={px} height={px} className="-rotate-90" aria-hidden>
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-primary-soft"
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - v / 100)}
          className={cn(
            'transition-[stroke-dashoffset] duration-700 ease-out',
            tone === 'accent' ? 'stroke-accent' : 'stroke-primary',
          )}
        />
      </svg>
      <span
        className={cn(
          'absolute font-heading font-bold text-primary tabular-nums',
          size === 'lg' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl',
        )}
        aria-hidden
      >
        {v}%
      </span>
    </div>
  );
}
