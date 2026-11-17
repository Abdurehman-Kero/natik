import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

export interface StepperProps {
  steps: string[];
  /** 0-based index of the current step. */
  current: number;
  className?: string;
}

/** Short multi-step flows (e.g. forgot password: phone → code → new password). */
export function Stepper({ steps, current, className }: StepperProps) {
  const t = useTranslations('stepper');
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium text-muted sm:sr-only">
        {t('summary', { current: current + 1, total: steps.length })}
        {steps[current] ? ` · ${steps[current]}` : ''}
      </p>
      <ol aria-label={t('label')} className="flex items-center gap-2">
        {steps.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className="flex flex-1 items-center gap-2 last:flex-none"
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  done && 'bg-accent text-primary',
                  active && 'bg-primary text-white',
                  !done && !active && 'border-2 border-border-strong text-muted',
                )}
              >
                {done ? (
                  <Check className="size-4" strokeWidth={3} aria-label={t('done')} />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'hidden text-sm font-semibold whitespace-nowrap sm:inline',
                  active ? 'text-primary' : 'text-muted',
                )}
              >
                {label}
              </span>
              {index < steps.length - 1 ? (
                <span
                  className={cn('h-0.5 flex-1 rounded-full', done ? 'bg-accent' : 'bg-border')}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
