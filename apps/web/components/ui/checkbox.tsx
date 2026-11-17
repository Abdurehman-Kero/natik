'use client';

import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';

export interface CheckboxProps extends Omit<
  ComponentProps<typeof CheckboxPrimitive.Root>,
  'children'
> {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
}

/** Checkbox with a large tap area: the whole row (box + label) is clickable. */
export function Checkbox({
  label,
  description,
  error,
  className,
  id: idProp,
  ...props
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-start gap-3">
        <CheckboxPrimitive.Root
          id={id}
          aria-describedby={[errorId, descriptionId].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 border-border-strong bg-surface transition-colors',
            'hover:border-primary data-[state=checked]:border-primary data-[state=checked]:bg-primary',
            'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
          )}
          {...props}
        >
          <CheckboxPrimitive.Indicator className="text-white">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        <div className="flex min-w-0 flex-col">
          <label htmlFor={id} className="cursor-pointer text-base text-ink">
            {label}
          </label>
          {description ? (
            <span id={descriptionId} className="text-sm text-muted">
              {description}
            </span>
          ) : null}
        </div>
      </div>
      {error ? (
        <p id={errorId} className="pl-9 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
