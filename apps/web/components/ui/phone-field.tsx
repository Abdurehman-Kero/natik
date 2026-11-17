'use client';

import { useTranslations } from 'next-intl';
import { type ComponentProps, useId, useState } from 'react';
import { FormField, type FormFieldProps, useFormField } from './form-field';
import { Affix, controlShellClass, ShellInput } from './input';

/**
 * Keeps digits only and groups them as the user types:
 * "0912345678" → "091 234 5678", "912345678" → "91 234 5678".
 * Pasted "+251…" numbers lose the country code (it is shown as a fixed prefix).
 * The server normalises every form to +2519…/+2517… (BR-AUTH-002).
 */
export function formatPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length > 9) digits = digits.slice(3);
  const max = digits.startsWith('0') ? 10 : 9;
  digits = digits.slice(0, max);
  const groups = digits.startsWith('0') ? [3, 3, 4] : [2, 3, 4];
  const parts: string[] = [];
  let index = 0;
  for (const size of groups) {
    if (index >= digits.length) break;
    parts.push(digits.slice(index, index + size));
    index += size;
  }
  return parts.join(' ');
}

export type PhoneFieldProps = Omit<FormFieldProps, 'children' | 'group'> &
  Omit<
    ComponentProps<'input'>,
    'id' | 'className' | 'type' | 'value' | 'defaultValue' | 'onChange'
  > & {
    value?: string;
    defaultValue?: string;
    /** Receives the formatted value ("91 234 5678"). */
    onValueChange?: (value: string) => void;
  };

/** Ethiopian mobile number with a fixed +251 prefix and a numeric keypad. */
export function PhoneField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  id,
  className,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  ...rest
}: PhoneFieldProps) {
  const t = useTranslations('fields.phone');
  const prefixId = useId();
  const [inner, setInner] = useState(() => formatPhoneInput(defaultValue ?? ''));
  const current = value !== undefined ? formatPhoneInput(value) : inner;

  return (
    <FormField {...{ label, hint, error, optional, hideLabel, id, className }}>
      <div className={controlShellClass}>
        <Affix side="start">
          <span aria-hidden>{t('prefix')}</span>
          <span id={prefixId} className="sr-only">
            {t('prefixLabel')}
          </span>
        </Affix>
        <PhoneInput
          prefixId={prefixId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={placeholder ?? t('placeholder')}
          value={current}
          onChange={(e) => {
            const next = formatPhoneInput(e.target.value);
            if (value === undefined) setInner(next);
            onValueChange?.(next);
          }}
          {...rest}
        />
      </div>
    </FormField>
  );
}

/** Adds the "+251" explanation to the field's own hint/error description. */
function PhoneInput({ prefixId, ...props }: ComponentProps<'input'> & { prefixId: string }) {
  const field = useFormField();
  const describedBy = [prefixId, field?.describedBy].filter(Boolean).join(' ');
  return <ShellInput {...props} aria-describedby={describedBy} />;
}
