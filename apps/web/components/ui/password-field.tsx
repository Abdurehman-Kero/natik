'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';
import { FormField, type FormFieldProps, useFormField } from './form-field';
import { controlShellClass, ShellInput } from './input';

export type PasswordFieldProps = Omit<FormFieldProps, 'children' | 'group'> &
  Omit<ComponentProps<'input'>, 'id' | 'className' | 'type'> & {
    /** "new-password" on register/reset, "current-password" on sign-in. */
    autoComplete: 'new-password' | 'current-password';
  };

function Toggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const t = useTranslations('fields.password');
  const field = useFormField();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-controls={field?.id}
      aria-label={visible ? t('hide') : t('show')}
      className="mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-primary"
    >
      {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
    </button>
  );
}

/** Password input with a show/hide toggle (helps on small phone keyboards). */
export function PasswordField({
  label,
  hint,
  error,
  optional,
  hideLabel,
  id,
  className,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField {...{ label, hint, error, optional, hideLabel, id, className }}>
      <div className={controlShellClass}>
        <ShellInput
          type={visible ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...rest}
        />
        <Toggle visible={visible} onToggle={() => setVisible((v) => !v)} />
      </div>
    </FormField>
  );
}
