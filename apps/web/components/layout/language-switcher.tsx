'use client';

import { Check, ChevronDown, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { setLocale } from '@/i18n/actions';
import { LOCALE_NAMES, LOCALE_SHORT, LOCALES, type Locale } from '@/i18n/config';

/** Save the choice, then re-draw the page in that language without a full reload. */
function useChooseLanguage(onChosen?: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (locale: Locale) =>
    start(async () => {
      await setLocale(locale);
      router.refresh();
      onChosen?.();
    });
  return { choose, pending };
}

/** A globe button that opens the four languages. For headers. */
export function LanguageMenu({ className }: { className?: string }) {
  const t = useTranslations('nav');
  const current = useLocale() as Locale;
  const { choose, pending } = useChooseLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-busy={pending}
          className={cn(
            'inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-soft hover:text-primary sm:gap-1.5 sm:px-3 md:h-11',
            className,
          )}
        >
          <Globe className="size-4.5" aria-hidden />
          <span className="sr-only">
            {t('language')}: {LOCALE_NAMES[current]}
          </span>
          <span aria-hidden>{LOCALE_SHORT[current]}</span>
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {LOCALES.map((code) => (
          <DropdownMenuItem key={code} lang={code} onSelect={() => choose(code)}>
            <span className="flex-1">{LOCALE_NAMES[code]}</span>
            {code === current ? <Check className="text-primary" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The four languages as buttons in a row. For the phone menu and the footer. */
export function LanguageList({
  className,
  onChosen,
  tone = 'light',
}: {
  className?: string;
  /** "onDark" for the navy footer. */
  tone?: 'light' | 'onDark';
  /** Called once the page shows the new language, e.g. to close the phone menu. */
  onChosen?: () => void;
}) {
  const t = useTranslations('nav');
  const current = useLocale() as Locale;
  const { choose, pending } = useChooseLanguage(onChosen);

  return (
    <div
      role="group"
      aria-label={t('language')}
      aria-busy={pending}
      className={cn('flex flex-wrap justify-center gap-2 sm:justify-start', className)}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => choose(code)}
          aria-pressed={code === current}
          className={cn(
            'min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors',
            tone === 'onDark'
              ? code === current
                ? 'border-accent bg-accent text-ink'
                : 'border-white/40 text-white hover:border-white hover:bg-white/10'
              : code === current
                ? 'border-primary bg-primary text-white'
                : 'border-border-strong bg-surface text-ink hover:border-primary hover:text-primary',
          )}
        >
          {LOCALE_NAMES[code]}
        </button>
      ))}
    </div>
  );
}
