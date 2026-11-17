'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, type ComponentProps, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { FormField, type FormFieldProps, useFormField } from './form-field';
import { controlClass } from './input';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectFieldProps = Omit<FormFieldProps, 'children' | 'group'> &
  Omit<ComponentProps<'select'>, 'id' | 'className' | 'children'> & {
    options: SelectOption[];
    placeholder?: string;
  };

/**
 * A styled native <select>: phones show their own large, familiar picker,
 * and it adds no JavaScript weight.
 */
export function SelectField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  id,
  className,
  options,
  placeholder,
  ...rest
}: SelectFieldProps) {
  return (
    <FormField {...{ label, hint, error, optional, hideLabel, id, className }}>
      <Select options={options} placeholder={placeholder} {...rest} />
    </FormField>
  );
}

export function Select({
  options,
  placeholder,
  className,
  ...props
}: Omit<ComponentProps<'select'>, 'children'> & { options: SelectOption[]; placeholder?: string }) {
  const t = useTranslations('fields.select');
  const field = useFormField();
  const hasValue = props.value !== undefined || props.defaultValue !== undefined;
  const ref = useRef<HTMLSelectElement>(null);
  const { value, onChange } = props;

  // A choice made while the page was still starting up shows in the box but never reached the form,
  // which then says "Choose…" on save. Once the page is ready, take over what the person picked.
  useEffect(() => {
    const el = ref.current;
    if (!el || value === undefined || !onChange) return;
    if (el.value !== String(value)) {
      onChange({ target: el, currentTarget: el } as ChangeEvent<HTMLSelectElement>);
    }
    // Only once, when the page has just become ready.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative">
      <select
        ref={ref}
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(controlClass, 'cursor-pointer appearance-none pr-10', className)}
        defaultValue={hasValue ? undefined : ''}
        {...props}
      >
        {placeholder !== undefined || !hasValue ? (
          <option value="" disabled={!hasValue}>
            {placeholder ?? t('placeholder')}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}
