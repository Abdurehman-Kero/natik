'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentProps, type ReactNode, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { FormField, type FormFieldProps, useFormField } from './form-field';

/** Shared look for every text-like control. */
export const controlClass = cn(
  'h-11 w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3.5 text-base text-ink',
  'transition-colors duration-150 placeholder:text-muted/80',
  'hover:border-ink/60 focus-visible:border-primary',
  'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted aria-invalid:border-danger',
);

/** Wrapper used when a control has a prefix/suffix inside its border. */
export const controlShellClass = cn(
  'flex h-11 w-full min-w-0 items-center overflow-hidden rounded-lg border border-border-strong bg-surface',
  'transition-colors duration-150 hover:border-ink/60',
  'focus-within:border-primary focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary',
  'has-[input:disabled]:bg-canvas has-[input[aria-invalid=true]]:border-danger',
);

/** Bare input: picks up id/aria from FormField when inside one. */
export function Input({ className, ...props }: ComponentProps<'input'>) {
  const field = useFormField();
  return (
    <input
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(controlClass, className)}
      {...props}
    />
  );
}

type FieldProps = Omit<FormFieldProps, 'children' | 'group'>;

function splitFieldProps<T extends FieldProps>(props: T) {
  const { label, hint, error, optional, hideLabel, id, className, ...rest } = props;
  return { field: { label, hint, error, optional, hideLabel, id, className }, rest };
}

export type TextFieldProps = FieldProps & Omit<ComponentProps<'input'>, 'id' | 'className'>;

/** Label + input + hint + error. */
export function TextField(props: TextFieldProps) {
  const { field, rest } = splitFieldProps(props);
  return (
    <FormField {...field}>
      <Input {...rest} />
    </FormField>
  );
}

export type TextareaFieldProps = FieldProps & Omit<ComponentProps<'textarea'>, 'id' | 'className'>;

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  const field = useFormField();
  return (
    <textarea
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(controlClass, 'h-auto min-h-28 resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  );
}

export function TextareaField(props: TextareaFieldProps) {
  const { field, rest } = splitFieldProps(props);
  return (
    <FormField {...field}>
      <Textarea {...rest} />
    </FormField>
  );
}

function Affix({ children, side }: { children: ReactNode; side: 'start' | 'end' }) {
  return (
    <span
      className={cn(
        'flex h-full shrink-0 items-center bg-canvas px-3 text-base font-medium text-muted select-none',
        side === 'start' ? 'border-r border-border' : 'border-l border-border',
      )}
    >
      {children}
    </span>
  );
}

/** Bare input inside a shell (no own border). */
function ShellInput({ className, ...props }: ComponentProps<'input'>) {
  const field = useFormField();
  return (
    <input
      id={field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        'h-full w-full min-w-0 bg-transparent px-3.5 text-base text-ink placeholder:text-muted/80 focus:outline-none disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  );
}

export type MoneyFieldProps = FieldProps &
  Omit<ComponentProps<'input'>, 'id' | 'className' | 'type'>;

/** Amount in birr with a fixed "ETB" prefix and a decimal keypad on phones. */
export function MoneyField(props: MoneyFieldProps) {
  const t = useTranslations('fields.money');
  const { field, rest } = splitFieldProps(props);
  return (
    <FormField {...field}>
      <div className={controlShellClass}>
        <Affix side="start">{t('currency')}</Affix>
        <ShellInput type="text" inputMode="decimal" autoComplete="off" {...rest} />
      </div>
    </FormField>
  );
}

export type DateFieldProps = FieldProps &
  Omit<ComponentProps<'input'>, 'id' | 'className' | 'type'>;

/** Native date picker: the friendliest option on phones (the browser draws its own calendar icon). */
export function DateField(props: DateFieldProps) {
  const { field, rest } = splitFieldProps(props);
  return (
    <FormField {...field}>
      <Input type="date" className="pr-3" {...rest} />
    </FormField>
  );
}

export type SearchFieldProps = Omit<FieldProps, 'label'> & {
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
} & Omit<ComponentProps<'input'>, 'id' | 'className' | 'type' | 'value' | 'defaultValue'>;

/** Search box with an icon and a clear button. The label is visually hidden by default. */
export function SearchField({
  value,
  defaultValue,
  onValueChange,
  placeholder,
  hideLabel = true,
  ...props
}: SearchFieldProps) {
  const t = useTranslations('fields.search');
  const { field, rest } = splitFieldProps({ ...props, hideLabel });
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = value ?? inner;
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  return (
    <FormField {...field}>
      <div className={controlShellClass}>
        <span className="pl-3 text-muted" aria-hidden>
          <Search className="size-5" />
        </span>
        <ShellInput
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          placeholder={placeholder ?? t('placeholder')}
          value={current}
          onChange={(e) => update(e.target.value)}
          className="pl-2.5 [&::-webkit-search-cancel-button]:hidden"
          {...rest}
        />
        {current ? (
          <button
            type="button"
            onClick={() => {
              update('');
              inputRef.current?.focus();
            }}
            className="mr-1 flex size-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
            aria-label={t('clear')}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    </FormField>
  );
}

export { Affix, ShellInput };
