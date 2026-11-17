import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import mark from '@/public/brand/natik-mark.png';

/**
 * The loading screen: the Natik mark breathing inside a thin ring with a gold arc going round it.
 * It fades in only after a short moment, so pages that load quickly never show it.
 * `screen` covers the whole window (first load); `area` fills just the page area (moving between pages).
 */
export function BrandLoader({
  variant = 'area',
  className,
}: {
  variant?: 'area' | 'screen';
  className?: string;
}) {
  const t = useTranslations('common');
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center',
        variant === 'screen' ? 'fixed inset-0 z-50 bg-canvas' : 'min-h-[60vh] w-full',
        className,
      )}
    >
      <div className="flex animate-loader-in flex-col items-center gap-5">
        <span className="relative flex size-32 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full border-[3px] border-primary/10"
            aria-hidden
          />
          <span
            className="absolute inset-0 animate-loader-orbit rounded-full border-[3px] border-transparent border-t-accent"
            aria-hidden
          />
          <Image
            src={mark}
            alt=""
            priority
            className="h-12 w-auto animate-loader-pulse"
            sizes="80px"
          />
        </span>
        <span className="h-[3px] w-8 rounded-full bg-accent" aria-hidden />
        <span className="sr-only">{t('loading')}</span>
      </div>
    </div>
  );
}
