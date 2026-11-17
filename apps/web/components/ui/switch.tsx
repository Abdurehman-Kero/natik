'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';

export interface SwitchProps extends Omit<ComponentProps<typeof SwitchPrimitive.Root>, 'children'> {
  label: ReactNode;
  description?: ReactNode;
}

/** On/off setting, e.g. "Free preview" or "Allow downloads". Label on the left, switch on the right. */
export function Switch({ label, description, className, id: idProp, ...props }: SwitchProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex min-w-0 flex-col">
        <label htmlFor={id} className="cursor-pointer text-base font-medium text-ink">
          {label}
        </label>
        {description ? (
          <span id={descriptionId} className="text-sm text-muted">
            {description}
          </span>
        ) : null}
      </div>
      <SwitchPrimitive.Root
        id={id}
        aria-describedby={descriptionId}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'bg-border-strong disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb className="block size-6 rounded-full bg-white shadow-card transition-transform data-[state=checked]:translate-x-5" />
      </SwitchPrimitive.Root>
    </div>
  );
}
