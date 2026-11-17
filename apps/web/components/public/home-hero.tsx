import { Check } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { LinkButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import hero from '@/public/images/hero-learner.jpg';

/**
 * The first screen. A photograph of someone actually studying, a single clear promise, one main
 * action. No effects: the photo and the type carry it. On phones the photo sits above the text so
 * the headline and buttons are still visible without scrolling.
 *
 * Photo: stand-in stock image (see plan/assets/IMAGE-CREDITS.md), to be replaced with Natik's own.
 */
export async function HomeHero({
  eyebrow,
  title,
  subtitle,
}: {
  /** Optional wording edited in Admin › Website; the built-in text is used when empty. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const t = await getTranslations('home');
  const points = [t('trust.free'), t('trust.certificates'), t('trust.languages')];

  return (
    <section className="on-dark bg-primary text-white">
      {/* Phones and small tablets: a photo band above the text */}
      <div className="relative h-48 sm:h-64 md:hidden">
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
          <div className="flex max-w-xl flex-col gap-5 pt-2 pb-10 md:min-h-[32rem] md:w-[54%] md:max-w-none md:justify-center md:py-20 lg:min-h-[38rem] lg:py-24">
            <p className="flex items-center gap-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">
              <span className="h-px w-8 bg-accent" aria-hidden />
              {eyebrow || t('heroEyebrow')}
            </p>

            <h1 className="text-[1.875rem] leading-[1.15] font-bold tracking-[-0.01em] text-white sm:text-5xl lg:text-[3.5rem]">
              {title || t('heroTitle')}
            </h1>

            <p className="max-w-md text-base leading-relaxed text-white/85 md:text-xl">
              {subtitle || t('heroSubtitle')}
            </p>

            <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <LinkButton href="/courses" variant="onDark" size="lg">
                {t('browseCourses')}
              </LinkButton>
              <LinkButton href="/free-lessons" variant="outlineOnDark" size="lg">
                {t('tryFreeLesson')}
              </LinkButton>
            </div>

            <p>
              <Link
                href="/find-your-level"
                className="inline-flex min-h-11 items-center font-semibold text-white underline decoration-accent decoration-2 underline-offset-4"
              >
                {t('findLevel')}
              </Link>
            </p>

            <ul className="mt-3 flex flex-col gap-2.5 border-t border-white/15 pt-5 sm:flex-row sm:flex-wrap sm:gap-x-7">
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
