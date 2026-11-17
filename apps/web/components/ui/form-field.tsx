'use client';

import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createContext, type ReactNode, useContext, useId } from 'react';
import { cn } from '@/lib/cn';

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Controls read their id and aria attributes from the surrounding FormField. */
export function useFormField(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FormFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  /** Use a fieldset/legend for groups (radio cards, OTP boxes). */
  group?: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label above, control, then hint and error under the field (DESIGN.md §9).
 * Errors are linked to the control with aria-describedby.
 */
export function FormField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  group,
  id: idProp,
  className,
  children,
}: FormFieldProps) {
  const t = useTranslations('common');
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const labelContent = (
    <>
      {label}
      {optional ? <span className="font-normal text-muted"> ({t('optional')})</span> : null}
    </>
  );
  const labelClass = cn('text-base font-semibold text-ink', hideLabel && 'sr-only');

  const messages = (
    <>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </>
  );

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      {group ? (
        <fieldset
          className={cn('flex min-w-0 flex-col gap-1.5', className)}
          aria-describedby={describedBy}
        >
          <legend className={cn(labelClass, 'mb-1.5')}>{labelContent}</legend>
          {children}
          {messages}
        </fieldset>
      ) : (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
          <label htmlFor={id} className={labelClass}>
            {labelContent}
          </label>
          {children}
          {messages}
        </div>
      )}
    </FieldContext.Provider>
  );
}

/** Buttons at the end of a form: stacked full-width on phones, right-aligned on desktop. */
export function FormActions({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto',
        className,
      )}
    >
      {children}
    </div>
  );
}
