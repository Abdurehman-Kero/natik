import { ArrowRight, BookOpen, Crown } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import Link from '@/components/ui/link';
import { cn } from '@/lib/cn';

export interface CourseCardProps {
  href: string;
  title: string;
  /** Content language of the title, e.g. "ar" for an Arabic title. */
  titleLang?: string;
  imageUrl?: string | null;
  language: string;
  level: string;
  duration?: string | null;
  /** Already formatted: "ETB 1,500" or "Free". */
  priceLabel: string;
  isFree?: boolean;
  className?: string;
  /** Say "Free" or "Premium" on the picture. */
  showBadge?: boolean;
}

/** Image, title and three facts (DESIGN.md text budget). The whole card is one link. */
export function CourseCard({
  href,
  title,
  titleLang,
  imageUrl,
  language,
  level,
  duration,
  priceLabel,
  isFree,
  className,
  showBadge = true,
}: CourseCardProps) {
  const t = useTranslations('courses');
  const facts = [language, level, duration].filter(Boolean);
  return (
    <Link
      href={href}
      className={cn(
        'group flex card-hover flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card',
        className,
      )}
    >
      <div className="relative aspect-video bg-primary">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            quality={60}
            className="card-hover-image object-cover"
          />
        ) : (
          <div
            className="flex size-full items-center justify-center bg-linear-to-br from-primary to-[#1f5277]"
            aria-hidden
          >
            <BookOpen className="size-10 text-white/60" />
          </div>
        )}
        {showBadge ? (
          <span
            className={cn(
              'absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold shadow-card',
              isFree ? 'bg-success-soft text-success' : 'bg-primary text-white',
            )}
          >
            {isFree ? null : <Crown className="size-3.5 text-accent" aria-hidden />}
            {isFree ? t('kindFree') : t('kindPremium')}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3
          lang={titleLang}
          className="line-clamp-2 text-lg leading-snug font-semibold group-hover:underline group-hover:decoration-accent group-hover:decoration-2 group-hover:underline-offset-4"
        >
          {title}
        </h3>
        <ul className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted">
          {facts.map((fact, index) => (
            <li key={fact} className="flex items-center gap-2">
              {index > 0 ? (
                <span className="size-1 rounded-full bg-border-strong" aria-hidden />
              ) : null}
              {fact}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <p
            className={cn(
              'font-heading text-lg font-bold',
              isFree ? 'text-success' : 'text-primary',
            )}
          >
            {priceLabel}
          </p>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {t('view')}
            <ArrowRight
              className="size-4 transition group-hover:translate-x-1 rtl:rotate-180"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
