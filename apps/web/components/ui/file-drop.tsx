'use client';

import { bytesToMb } from '@natik/shared';
import { FileText, RotateCcw, UploadCloud, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type DragEvent, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { FormField, type FormFieldProps } from './form-field';
import { ProgressBar } from './progress';

export interface FileDropProps extends Omit<FormFieldProps, 'children' | 'group' | 'hint'> {
  /** e.g. "application/pdf" or "image/jpeg,image/png" (MIME types or .extensions). */
  accept: string;
  /** Human label for the accepted types, e.g. "PDF" or "JPG, PNG". */
  typesLabel: string;
  maxBytes: number;
  multiple?: boolean;
  files?: File[];
  onFilesChange?: (files: File[]) => void;
  /** 0–100 while uploading. */
  progress?: number;
  onRetry?: () => void;
  disabled?: boolean;
}

function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) =>
    rule.startsWith('.')
      ? name.endsWith(rule)
      : rule.endsWith('/*')
        ? type.startsWith(rule.slice(0, -1))
        : type === rule,
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Pick or drag files. Checks type and size in the browser first, with the SRS §10
 * wording ("This file is 32 MB. The maximum is 25 MB."). The server checks again.
 */
export function FileDrop({
  accept,
  typesLabel,
  maxBytes,
  multiple = false,
  files: controlled,
  onFilesChange,
  progress,
  onRetry,
  disabled,
  error: externalError,
  ...field
}: FileDropProps) {
  const t = useTranslations('fields.file');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inner, setInner] = useState<File[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const files = controlled ?? inner;
  const uploading = progress !== undefined && progress < 100;

  const update = (next: File[]) => {
    if (controlled === undefined) setInner(next);
    onFilesChange?.(next);
  };

  const accept_ = (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);
    for (const file of list) {
      if (!matchesAccept(file, accept)) {
        setLocalError(t('wrongType'));
        return;
      }
      if (file.size > maxBytes) {
        setLocalError(t('tooLarge', { size: bytesToMb(file.size), max: bytesToMb(maxBytes) }));
        return;
      }
    }
    setLocalError(null);
    update(multiple ? [...files, ...list] : list.slice(0, 1));
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) accept_(event.dataTransfer.files);
  };

  const showDropZone = multiple || files.length === 0;

  return (
    <FormField
      {...field}
      id={inputId}
      error={localError ?? externalError}
      hint={t('limits', { types: typesLabel, max: bytesToMb(maxBytes) })}
    >
      {showDropZone ? (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors',
            'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary',
            dragging
              ? 'border-primary bg-primary-soft'
              : 'border-border-strong bg-surface hover:border-primary',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary">
            <UploadCloud className="size-5" aria-hidden />
          </span>
          <span className="font-semibold text-primary">{t('choose')}</span>
          <span className="hidden text-sm text-muted sm:block">{t('drop')}</span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            className="sr-only"
            onChange={(e) => {
              accept_(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      ) : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3"
            >
              <div className="flex items-center gap-3">
                <FileText className="size-5 shrink-0 text-primary" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-ink">{file.name}</span>
                  <span className="text-sm text-muted">
                    {uploading
                      ? t('uploading', { progress: Math.round(progress ?? 0) })
                      : formatSize(file.size)}
                  </span>
                </div>
                {onRetry && externalError ? (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
                  >
                    <RotateCcw className="size-4" aria-hidden />
                    {t('retry')}
                  </button>
                ) : null}
                {!uploading ? (
                  <button
                    type="button"
                    onClick={() => update(files.filter((_, i) => i !== index))}
                    className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-danger"
                    aria-label={t('remove', { name: file.name })}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              {uploading ? <ProgressBar value={progress ?? 0} size="sm" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </FormField>
  );
}
