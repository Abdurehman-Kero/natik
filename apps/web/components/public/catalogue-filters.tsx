'use client';

import { Languages, SlidersHorizontal, X } from 'lucide-react';
import Link from '@/components/ui/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { type CatalogueKind, catalogueHref } from '@/lib/catalogue-url';

type Kind = CatalogueKind;

/**
 * Language and level as two dropdowns in one tidy bar. Phones open their own large pickers, and
 * choosing a value goes straight to that list (the choice stays in the address, so it can be shared).
 */
export function CatalogueFilters({
  basePath,
  kind,
  language,
  level,
  languages,
  levels,
}: {
  basePath: string;
  kind: Kind;
  language: string;
  level: string;
  languages: { code: string; name: string }[];
  levels: { id: string; name: string }[];
}) {
  const t = useTranslations('courses');
  const router = useRouter();
  const go = (nextLanguage: string, nextLevel: string) =>
    router.push(catalogueHref(basePath, nextLanguage, nextLevel, kind), { scroll: false });
  const filtered = Boolean(language || level);

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-surface p-4 shadow-card md:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted uppercase">
            <Languages className="size-4 text-primary" aria-hidden />
            {t('language')}
          </span>
          <Select
            aria-label={t('language')}
            value={language}
            onChange={(e) => go(e.target.value, level)}
            placeholder={t('all')}
            options={[...languages.map((l) => ({ value: l.code, label: l.name }))]}
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted uppercase">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden />
            {t('level')}
          </span>
          <Select
            aria-label={t('level')}
            value={level}
            onChange={(e) => go(language, e.target.value)}
            placeholder={t('anyLevel')}
            options={[...levels.map((l) => ({ value: l.name, label: l.name }))]}
          />
        </label>
        {filtered ? (
          <Link
            href={catalogueHref(basePath, '', '', kind)}
            scroll={false}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            <X className="size-4" aria-hidden />
            {t('clearFilters')}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
