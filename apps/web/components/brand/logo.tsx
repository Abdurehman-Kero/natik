import Image from 'next/image';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import fullLogo from '@/public/brand/natik-logo-full.png';
import mark from '@/public/brand/natik-mark.png';

export interface LogoProps {
  /**
   * compact: mark + "NATIK" (headers) · full: complete lockup (footer, sign-in) ·
   * mark: the calligraphic mark only (tight spaces). See DESIGN.md §16.
   */
  variant?: 'compact' | 'full' | 'mark';
  /** Rendered height in px of the image part. */
  height?: number;
  href?: string | null;
  priority?: boolean;
  className?: string;
}

export function Logo({ variant = 'compact', height, href = '/', priority, className }: LogoProps) {
  const t = useTranslations('brand');

  const content =
    variant === 'full' ? (
      <Image
        src={fullLogo}
        alt={href ? '' : t('fullName')}
        priority={priority}
        style={{ height: height ?? 120, width: 'auto' }}
        sizes="200px"
      />
    ) : (
      <span className="flex items-center gap-2.5">
        <Image
          src={mark}
          alt={href || variant === 'compact' ? '' : t('fullName')}
          priority={priority}
          style={{ height: height ?? 40, width: 'auto' }}
          sizes="64px"
        />
        {variant === 'compact' ? (
          <span className="flex flex-col leading-none">
            <span className="font-heading text-xl font-bold tracking-wide text-primary">
              {t('wordmark')}
            </span>
            <span className="mt-1 text-[0.625rem] font-semibold tracking-[0.2em] text-muted uppercase max-[400px]:hidden">
              {t('centre')}
            </span>
          </span>
        ) : null}
      </span>
    );

  if (!href) return <span className={cn('inline-flex', className)}>{content}</span>;
  // The compact logo has visible words, so they form the link name (WCAG 2.5.3 "label in name");
  // image-only variants get an explicit name.
  return (
    <Link
      href={href}
      aria-label={variant === 'compact' ? undefined : t('homeLink')}
      className={cn('inline-flex shrink-0 rounded-lg', className)}
    >
      {content}
      {variant === 'compact' ? <span className="sr-only">{t('homeSuffix')}</span> : null}
    </Link>
  );
}
