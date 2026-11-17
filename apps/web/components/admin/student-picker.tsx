'use client';

import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/client';
import type { StudentChoice } from '@/lib/api/learn-types';

/**
 * Finds a student by name or phone number. Used wherever an admin acts for a student: enrolling,
 * recording a cash payment, filtering the enrolment list.
 */
export function StudentPicker({
  value,
  onChange,
  error,
  label,
}: {
  value: StudentChoice | null;
  onChange: (student: StudentChoice | null) => void;
  error?: string;
  label?: string;
}) {
  const t = useTranslations('studentPicker');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentChoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(text: string) {
    setQuery(text);
    clearTimeout(timer.current);
    const q = text.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      const ticket = ++latest.current;
      setBusy(true);
      try {
        const res = await api<{ items: StudentChoice[] }>(
          `/admin/students?q=${encodeURIComponent(q)}`,
        );
        if (ticket === latest.current) setResults(res.items);
      } catch {
        if (ticket === latest.current) setResults([]);
      } finally {
        if (ticket === latest.current) setBusy(false);
      }
    }, 250);
  }

  if (value) {
    return (
      <FormField label={label ?? t('label')} group error={error}>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface py-2 pr-2 pl-4">
          <UserRound className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{value.fullName}</span>
            <span className="block text-sm text-muted" dir="ltr">
              {value.phone}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setQuery('');
              setResults(null);
            }}
          >
            {t('change')}
          </Button>
        </div>
      </FormField>
    );
  }

  return (
    <FormField label={label ?? t('label')} hint={t('hint')} error={error}>
      <div className="flex flex-col gap-2">
        <Input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder={t('placeholder')}
          autoComplete="off"
        />
        {busy ? <p className="text-sm text-muted">{t('searching')}</p> : null}
        {results && !busy ? (
          results.length === 0 ? (
            <p className="text-sm text-muted">{t('none')}</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-canvas"
                    onClick={() => {
                      onChange(s);
                      setResults(null);
                    }}
                  >
                    <span className="font-semibold">{s.fullName}</span>
                    <span className="text-sm text-muted" dir="ltr">
                      {s.phone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </FormField>
  );
}
