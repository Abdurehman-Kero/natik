'use client';

import { useTranslations } from 'next-intl';
import { type ClipboardEvent, type KeyboardEvent, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { FormField, type FormFieldProps } from './form-field';

export interface OtpFieldProps extends Omit<FormFieldProps, 'children' | 'group'> {
  length?: number;
  value?: string;
  onValueChange?: (value: string) => void;
  /** Called once every box is filled (e.g. to submit automatically). */
  onComplete?: (code: string) => void;
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Six boxes for an SMS code. Supports typing, backspace, arrow keys, paste and
 * SMS autofill (autocomplete="one-time-code" on the first box).
 */
export function OtpField({
  length = 6,
  value,
  onValueChange,
  onComplete,
  name,
  disabled,
  autoFocus,
  ...field
}: OtpFieldProps) {
  const t = useTranslations('fields.otp');
  const [inner, setInner] = useState('');
  const code = (value ?? inner).replace(/\D/g, '').slice(0, length);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    if (value === undefined) setInner(clean);
    onValueChange?.(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };

  const focusBox = (index: number) => {
    const box = refs.current[Math.max(0, Math.min(length - 1, index))];
    box?.focus();
    box?.select();
  };

  const handleInput = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return;
    // Autofill or fast typing can put several digits into one box.
    const next = (code.slice(0, index) + digits).slice(0, length);
    const clean = commit(next + code.slice(index + digits.length));
    focusBox(Math.min(clean.length, length - 1));
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (code[index]) {
        commit(code.slice(0, index) + code.slice(index + 1));
      } else if (index > 0) {
        commit(code.slice(0, index - 1) + code.slice(index));
        focusBox(index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const clean = commit(event.clipboardData.getData('text'));
    focusBox(Math.min(clean.length, length - 1));
  };

  return (
    <FormField group {...field}>
      <div className="flex gap-1.5 sm:gap-3" dir="ltr">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={length}
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            value={code[index] ?? ''}
            aria-label={t('digit', { index: index + 1, count: length })}
            aria-invalid={field.error ? true : undefined}
            onChange={(e) => handleInput(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={cn(
              // Boxes share the row so six fit a 320 px phone inside a card; capped at 48 px wide.
              'h-13 w-full max-w-12 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface text-center font-heading text-xl font-semibold text-primary sm:h-14',
              'transition-colors focus-visible:border-primary disabled:bg-canvas aria-invalid:border-danger',
            )}
          />
        ))}
      </div>
      {name ? <input type="hidden" name={name} value={code} /> : null}
    </FormField>
  );
}
