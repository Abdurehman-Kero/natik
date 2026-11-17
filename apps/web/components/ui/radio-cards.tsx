'use client';

import type { LucideIcon } from 'lucide-react';
import { RadioGroup } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FormField, type FormFieldProps } from './form-field';

export interface RadioCardOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Content language for the label, e.g. "ar" for عربي. */
  lang?: string;
  disabled?: boolean;
}

export type RadioCardsProps = Omit<FormFieldProps, 'children' | 'group'> &
  Omit<ComponentProps<typeof RadioGroup.Root>, 'children' | 'className'> & {
    options: RadioCardOption[];
    /** "chips" for short choices on one line, "cards" for choices with descriptions. */
    layout?: 'chips' | 'cards';
  };

/** A small set of choices shown as tappable chips or cards (better than a dropdown for 2–4 options). */
export function RadioCards({
  label,
  hint,
  error,
  optional,
  hideLabel,
  id,
  className,
  options,
  layout = 'chips',
  ...rootProps
}: RadioCardsProps) {
  return (
    <FormField group {...{ label, hint, error, optional, hideLabel, id, className }}>
      <RadioGroup.Root
        className={cn(layout === 'chips' ? 'flex flex-wrap gap-2' : 'grid gap-3 sm:grid-cols-2')}
        aria-invalid={error ? true : undefined}
        {...rootProps}
      >
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <RadioGroup.Item
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                'group flex items-center gap-3 border bg-surface text-left text-ink transition-colors',
                'border-border-strong hover:border-primary disabled:cursor-not-allowed disabled:opacity-50',
                'data-[state=checked]:border-primary data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary',
                layout === 'chips'
                  ? 'min-h-11 rounded-full px-4 font-medium'
                  : 'min-h-16 rounded-xl p-4',
              )}
            >
              {layout === 'cards' ? (
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-border-strong group-data-[state=checked]:border-primary"
                >
                  <RadioGroup.Indicator className="size-2.5 rounded-full bg-primary" />
                </span>
              ) : null}
              {Icon ? <Icon className="size-5 shrink-0" aria-hidden /> : null}
              <span className="flex min-w-0 flex-col">
                <span lang={option.lang} className="leading-snug">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="text-sm font-normal text-muted">{option.description}</span>
                ) : null}
              </span>
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>
    </FormField>
  );
}
