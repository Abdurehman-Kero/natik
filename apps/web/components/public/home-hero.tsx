import { Check, Search } from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ToolButton } from '@/components/public/site-tool-links';
import { LinkButton } from '@/components/ui/button';
import Link from '@/components/ui/link';
import { Container } from '@/components/ui/layout';
import hero from '@/public/images/hero-learner.jpg';

/**
 * The first screen. A photograph of someone actually studying, a single clear promise, a search box
 * that opens the course search at once, the three languages as one-tap chips, and the two main
 * actions. On phones the photo sits above the text so the headline and buttons are still visible
 * without scrolling.
 *
 * Photo: stand-in stock image (see plan/assets/IMAGE-CREDITS.md), to be replaced with Natik's own.
 */
export async function HomeHero({
  eyebrow,
  title,
  subtitle,
  languages,
}: {
  /** Optional wording edited in Admin › Website; the built-in text is used when empty. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  /** The languages with courses, as one-tap chips. */
  languages: { code: string; name: string }[];
}) {
  const t = await getTranslations('home');
  const ts = await getTranslations('site.hero');
  const points = [t('trust.free'), t('trust.certificates'), t('trust.languages')];

  return (
    <section className="on-dark bg-primary text-white" data-tour="hero">
      {/* Phones and small tablets: a photo band above the text */}
      <div className="relative h-44 sm:h-60 md:hidden">
        <Image
          src={hero}
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 1px, 100vw"
          className="object-cover object-[60%_40%]"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-primary to-transparent" />
      </div>

      <div className="relative">
        {/* Tablets and up: the photo fills the right side */}
        <div className="absolute inset-y-0 right-0 hidden w-[46%] md:block">
          <Image
            src={hero}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 46vw, 1px"
            className="object-cover object-[62%_38%]"
          />
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-primary to-transparent lg:w-48" />
        </div>

        <Container className="relative">
          <div className="flex max-w-xl flex-col gap-5 pt-2 pb-10 max-md:mx-auto max-md:items-center max-md:text-center md:min-h-[34rem] md:w-[56%] md:max-w-none md:justify-center md:py-16 lg:min-h-[40rem] lg:py-20">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.16em] text-white/80 uppercase max-md:justify-center sm:text-sm">
              <span className="h-px w-8 bg-accent" aria-hidden />
              {eyebrow || t('heroEyebrow')}
            </p>

            <h1 className="text-[1.875rem] leading-[1.15] font-bold tracking-[-0.01em] text-balance text-white sm:text-5xl lg:text-[3.5rem]">
              {title || t('heroTitle')}
            </h1>

            <p className="max-w-md text-base leading-relaxed text-white/85 md:text-xl">
              {subtitle || t('heroSubtitle')}
            </p>

            {/* Looks like a search box and opens the course search dialog */}
            <ToolButton
              tool="search"
              plain
              className="group flex h-14 w-full max-w-lg items-center gap-3 rounded-2xl bg-white px-4 text-start text-muted shadow-overlay transition hover:shadow-[0_8px_30px_rgb(0_0_0/0.25)] focus-visible:outline-accent max-sm:order-2"
            >
              <Search className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-base text-muted md:text-lg">
                {ts('searchPlaceholder')}
              </span>
              <span className="hidden rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white sm:block">
                {ts('searchCta')}
              </span>
            </ToolButton>

            {languages.length > 0 ? (
              <ul
                aria-label={ts('chipsLabel')}
                className="flex flex-wrap gap-2 max-md:justify-center max-sm:order-2"
              >
                {languages.map((language) => (
                  <li key={language.code}>
                    <Link
                      href={`/courses?language=${language.code}`}
                      className="inline-flex min-h-11 items-center rounded-full border border-white/35 px-4 text-[0.9375rem] font-semibold text-white transition hover:border-accent hover:bg-white/10"
                    >
                      {language.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-1 flex w-full gap-2 max-sm:order-1 sm:w-auto sm:flex-wrap sm:gap-3">
              <LinkButton
                href="/courses"
                variant="onDark"
                size="lg"
                className="max-sm:h-auto max-sm:min-h-11 max-sm:flex-1 max-sm:px-3 max-sm:py-2 max-sm:text-[0.9375rem] max-sm:leading-tight max-sm:whitespace-normal"
              >
                {t('browseCourses')}
              </LinkButton>
              <ToolButton
                tool="level"
                variant="outlineOnDark"
                size="lg"
                className="max-sm:h-auto max-sm:min-h-11 max-sm:flex-1 max-sm:px-3 max-sm:py-2 max-sm:text-[0.9375rem] max-sm:leading-tight max-sm:whitespace-normal"
              >
                {t('findLevelButton')}
              </ToolButton>
            </div>

            <ul className="mt-2 flex w-full flex-col gap-2 border-t border-white/15 pt-5 max-md:items-center max-sm:order-3 sm:flex-row sm:flex-wrap sm:gap-x-7">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-2 text-[0.9375rem] text-white/90">
                  <Check className="size-4 shrink-0 text-accent" strokeWidth={3} aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </div>
    </section>
  );
}
