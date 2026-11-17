import {
  ArrowRight,
  BadgeCheck,
  Languages,
  MessageSquareText,
  PlayCircle,
  Smartphone,
} from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { isFreeCourse } from '@/components/public/catalogue';
import { CourseList } from '@/components/public/course-list';
import { CoursesShowcase } from '@/components/public/courses-showcase';
import { CtaBand } from '@/components/public/cta-band';
import { FaqAccordion, type FaqItem } from '@/components/public/faq-accordion';
import { FeatureGrid, Steps } from '@/components/public/feature-grid';
import { HomeHero } from '@/components/public/home-hero';
import {
  CommunityBand,
  LearningFlow,
  LearningPath,
  StatsStrip,
  TeachersSection,
} from '@/components/public/home-extras';
import { InstallApp } from '@/components/public/install-app';
import { NewsList } from '@/components/public/news-list';
import { PublicSection } from '@/components/public/section';
import { PaymentSupport } from '@/components/public/support-contact';
import { Testimonials } from '@/components/public/testimonials';
import { LinkButton } from '@/components/ui/button';
import {
  type PublicAnnouncement,
  type PublicCourse,
  type PublicFaqItem,
  type PublicFilters,
  type PublicFreeLesson,
  type PublicStats,
  type PublicTeacher,
  type PublicTestimonial,
  publicFetch,
} from '@/lib/api/public';
import { siteUrl } from '@/lib/site-config';
import { getLiveSiteConfig, getSiteContent } from '@/lib/site-config-live';

/** Native names shown on the language cards. The list itself comes from the admin-editable languages. */
const NATIVE_NAME: Record<string, string> = { ar: 'العربية', en: 'English', om: 'Afaan Oromoo' };
const FALLBACK_LANGUAGES = [
  { code: 'ar', name: 'Arabic', courseCount: 0 },
  { code: 'en', name: 'English', courseCount: 0 },
  { code: 'om', name: 'Afaan Oromo', courseCount: 0 },
];

export default async function HomePage() {
  const t = await getTranslations('home');
  const locale = await getLocale();
  const tf = await getTranslations('faq');

  const [filters, courses, news, content, faqApi, testimonials, freeLessons, stats, teachers] =
    await Promise.all([
      publicFetch<PublicFilters>('/public/filters', { languages: [], levels: [] }),
      publicFetch<{ items: PublicCourse[] }>('/public/courses', { items: [] }),
      publicFetch<{ items: PublicAnnouncement[] }>('/public/announcements?limit=3', { items: [] }),
      getSiteContent(),
      publicFetch<{ items: PublicFaqItem[] }>('/public/faq', { items: [] }),
      publicFetch<{ items: PublicTestimonial[] }>('/public/testimonials', { items: [] }),
      publicFetch<{ items: PublicFreeLesson[] }>('/public/free-lessons', { items: [] }),
      publicFetch<PublicStats | null>('/public/stats', null),
      publicFetch<{ items: PublicTeacher[] }>('/public/teachers', { items: [] }),
    ]);
  const languages = filters.languages.length > 0 ? filters.languages : FALLBACK_LANGUAGES;
  // FAQ written in Admin › Website wins; the built-in questions are the fallback.
  const faq: FaqItem[] = (
    faqApi.items.length > 0
      ? faqApi.items.map((item) => ({ q: item.question, a: item.answer }))
      : (tf.raw('items') as FaqItem[])
  ).slice(0, 5);
  const site = await getLiveSiteConfig();

  const why = (t.raw('why') as { title: string; text: string }[]).map((item, i) => ({
    ...item,
    icon: [Languages, Smartphone, MessageSquareText, BadgeCheck][i] ?? Languages,
  }));

  // Free and premium courses are shown apart, three of each, so visitors choose by what suits them.
  const free = courses.items.filter(isFreeCourse);
  const premium = courses.items.filter((c) => !isFreeCourse(c));
  const groups = [
    free.length > 0
      ? {
          value: 'free' as const,
          label: t('tabFree'),
          content: <CourseList courses={free.slice(0, 3)} />,
          seeAll: { href: '/courses?type=free', label: t('seeAllFree') },
        }
      : null,
    premium.length > 0
      ? {
          value: 'premium' as const,
          label: t('tabPremium'),
          content: <CourseList courses={premium.slice(0, 3)} />,
          seeAll: { href: '/courses?type=premium', label: t('seeAllPremium') },
        }
      : null,
  ].filter((g): g is NonNullable<typeof g> => g !== null);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Natik Language Centre',
    url: siteUrl(),
    logo: `${siteUrl()}/brand/natik-logo-full.png`,
    ...(site.phone ? { telephone: site.phone } : {}),
    ...(site.email ? { email: site.email } : {}),
    ...(site.address ? { address: site.address } : {}),
    ...(site.socials.length > 0 ? { sameAs: site.socials.map((s) => s.href) } : {}),
  };

  // Feature a free lesson that has a video picture, so the block shows the real lesson.
  const firstFree = freeLessons.items.find((l) => l.posterUrl) ?? freeLessons.items[0];

  return (
    <>
      <script
        type="application/ld+json"
        // Static, server-built data (no user input).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Admins write the hero in English; other languages use the translated wording. */}
      <HomeHero
        eyebrow={locale === 'en' ? content.home?.heroEyebrow : undefined}
        title={locale === 'en' ? content.home?.heroTitle : undefined}
        subtitle={locale === 'en' ? content.home?.heroSubtitle : undefined}
      />

      <PublicSection
        eyebrow={t('languagesEyebrow')}
        title={t('languagesTitle')}
        intro={t('languagesText')}
      >
        <ul className="grid gap-5 sm:grid-cols-3">
          {languages.map((language) => (
            <li key={language.code}>
              <Link
                href={`/courses?language=${language.code}`}
                className="group relative flex h-full flex-col items-center gap-2 overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-card transition duration-300 hover:-translate-y-1 hover:border-accent/60 hover:shadow-overlay"
              >
                <span
                  className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-accent to-transparent opacity-0 transition group-hover:opacity-100"
                  aria-hidden
                />
                {language.code === 'ar' ? (
                  <span
                    lang="ar"
                    dir="rtl"
                    className="font-arabic text-3xl leading-relaxed font-bold text-primary md:text-4xl"
                  >
                    {NATIVE_NAME.ar}
                  </span>
                ) : (
                  <span className="font-heading text-3xl font-bold text-primary md:text-4xl">
                    {language.name}
                  </span>
                )}
                {language.code === 'ar' ? (
                  <span className="text-lg font-semibold text-ink">{language.name}</span>
                ) : null}
                <span className="text-muted">
                  {language.courseCount > 0
                    ? t('courseCount', { count: language.courseCount })
                    : t('comingSoon')}
                </span>
                <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  {t('exploreLanguage')}
                  <ArrowRight
                    className="size-4 transition group-hover:translate-x-1 rtl:rotate-180"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PublicSection>

      {groups.length > 0 ? (
        <PublicSection
          tone="white"
          eyebrow={t('coursesEyebrow')}
          title={t('coursesTitle')}
          intro={t('coursesText')}
        >
          <CoursesShowcase groups={groups} />
        </PublicSection>
      ) : null}

      <PublicSection eyebrow={t('howEyebrow')} title={t('howTitle')}>
        <Steps items={t.raw('steps') as { title: string; text: string }[]} />
        <PaymentSupport
          className="mx-auto mt-12 max-w-2xl"
          title={t('payTitle')}
          text={t('payText')}
        />
      </PublicSection>

      {firstFree ? (
        <PublicSection tone="white">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Link
              href={`/courses/${firstFree.course.slug}/lessons/${firstFree.id}`}
              aria-label={t('openFreeLesson', { title: firstFree.title })}
              className="group relative block aspect-[3/2] overflow-hidden rounded-3xl shadow-overlay ring-1 ring-border"
            >
              {firstFree.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the lesson video's own picture
                <img
                  src={firstFree.posterUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <Image
                  src={firstFree.course.imageUrl ?? '/images/try-before-you-register.jpg'}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              )}
              <span className="absolute inset-0 bg-linear-to-t from-primary/40 via-transparent to-transparent" />
              <span
                className="absolute inset-0 m-auto flex size-20 items-center justify-center rounded-full bg-white text-primary shadow-overlay transition group-hover:scale-110"
                aria-hidden
              >
                <PlayCircle className="size-10" />
              </span>
            </Link>
            <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-start">
              <span className="text-sm font-bold tracking-[0.18em] text-accent-strong uppercase">
                {t('freeEyebrow')}
              </span>
              <h2 className="text-2xl font-bold tracking-[-0.01em] md:text-[2.5rem]">
                {t('freeTitle')}
              </h2>
              <p className="max-w-lg text-base text-muted md:text-lg">{t('freeText')}</p>
              <ul className="flex w-full max-w-lg flex-col gap-2.5 text-start">
                {freeLessons.items.slice(0, 3).map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/courses/${lesson.course.slug}/lessons/${lesson.id}`}
                      className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2 shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:bg-primary-soft"
                    >
                      <PlayCircle className="size-5 shrink-0 text-primary" aria-hidden />
                      <span className="line-clamp-2 font-medium">{lesson.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <LinkButton
                href="/free-lessons"
                size="lg"
                className="h-auto min-h-12 w-full py-2 text-center whitespace-normal sm:w-auto"
              >
                {t('allFreeLessons')}
              </LinkButton>
            </div>
          </div>
        </PublicSection>
      ) : null}

      <PublicSection eyebrow={t('whyEyebrow')} title={t('whyTitle')}>
        <FeatureGrid items={why} />
      </PublicSection>

      <LearningFlow />
      <LearningPath levels={filters.levels} />

      <TeachersSection teachers={teachers.items} />
      <StatsStrip stats={stats} />

      {testimonials.items.length > 0 ? (
        <PublicSection eyebrow={t('testimonialsEyebrow')} title={t('testimonialsTitle')}>
          <Testimonials items={testimonials.items} label={t('testimonialsTitle')} />
        </PublicSection>
      ) : null}

      {news.items.length > 0 ? (
        <PublicSection
          tone="white"
          eyebrow={t('newsEyebrow')}
          title={t('newsTitle')}
          link={{ href: '/news', label: t('allNews') }}
        >
          <NewsList items={news.items} preview />
        </PublicSection>
      ) : null}

      <PublicSection
        size="reading"
        eyebrow={t('faqEyebrow')}
        title={t('faqTitle')}
        link={{ href: '/faq', label: t('allFaq') }}
        tone={news.items.length > 0 ? 'canvas' : 'white'}
      >
        <FaqAccordion items={faq} />
      </PublicSection>

      <CommunityBand />
      <InstallApp />

      <CtaBand title={t('ctaTitle')} text={t('ctaText')}>
        <LinkButton href="/register" variant="onDark" size="lg">
          {t('ctaRegister')}
        </LinkButton>
        <LinkButton href="/contact" variant="outlineOnDark" size="lg">
          {t('ctaContact')}
        </LinkButton>
      </CtaBand>
    </>
  );
}
