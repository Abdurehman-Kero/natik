import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  Compass,
  GraduationCap,
  Languages,
  MessageCircleQuestion,
  PlayCircle,
  Presentation,
  UserCheck,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { AuthLink } from '@/components/auth/auth-dialog';
import { PublicSection } from '@/components/public/section';
import { ToolButton } from '@/components/public/site-tool-links';
import { Avatar } from '@/components/ui/avatar';
import { ExternalLinkButton, LinkButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { SocialIcon } from '@/components/ui/social-icon';
import type { PublicStats, PublicTeacher } from '@/lib/api/public';
import { cn } from '@/lib/cn';
import { whatsappUrl } from '@/lib/site-config';
import { getLiveSiteConfig } from '@/lib/site-config-live';

const FLOW_ICONS = [PlayCircle, Presentation, ClipboardCheck, Award];

const JOURNEY_ICONS = [UserPlus, UserCheck, CalendarDays, Award];

/**
 * The whole journey in four steps, from the first click to the certificate. A line joins the steps
 * on wide screens; on phones they stack as a timeline.
 */
export async function JourneySection() {
  const t = await getTranslations('site.journey');
  const steps = t.raw('steps') as { title: string; text: string }[];
  return (
    <PublicSection eyebrow={t('eyebrow')} title={t('title')}>
      <ol className="relative grid gap-6 lg:grid-cols-4 lg:gap-8">
        <span
          aria-hidden
          className="absolute top-8 right-[12.5%] left-[12.5%] hidden h-0.5 bg-linear-to-r from-transparent via-accent/60 to-transparent lg:block"
        />
        {steps.map((step, index) => {
          const Icon = JOURNEY_ICONS[index] ?? Award;
          return (
            <li
              key={step.title}
              className="relative flex gap-4 lg:flex-col lg:items-center lg:gap-4 lg:text-center"
            >
              <span className="relative z-10 flex size-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-[#1f5277] text-white shadow-raised ring-4 ring-canvas">
                <Icon className="size-7" aria-hidden />
                <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-ink">
                  {index + 1}
                </span>
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-sans text-lg font-semibold">{step.title}</h3>
                <p className="text-muted">{step.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </PublicSection>
  );
}

/** Four steps of how a lesson works: watch, study, quiz, certificate. Wording comes from the messages. */
export async function LearningFlow() {
  const t = await getTranslations('home');
  const steps = t.raw('flow') as { title: string; text: string }[];
  return (
    <PublicSection tone="white" eyebrow={t('flowEyebrow')} title={t('flowTitle')}>
      <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const Icon = FLOW_ICONS[index] ?? PlayCircle;
          return (
            <li
              key={step.title}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-canvas p-7 text-center"
            >
              <span
                className="flex size-16 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-[#1f5277] text-white shadow-raised"
                aria-hidden
              >
                <Icon className="size-7" />
              </span>
              <h3 className="font-sans text-lg font-semibold">
                <span className="text-accent-strong">{index + 1}.</span> {step.title}
              </h3>
              <p className="text-muted">{step.text}</p>
            </li>
          );
        })}
      </ol>
    </PublicSection>
  );
}

/** Beginner to advanced as a path, each step leading to that level's courses. Uses the real levels. */
export async function LearningPath({ levels }: { levels: { id: string; name: string }[] }) {
  const t = await getTranslations('home');
  if (levels.length < 2) return null;
  return (
    <PublicSection eyebrow={t('pathEyebrow')} title={t('pathTitle')} intro={t('pathText')}>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {levels.map((level, index) => (
          <li key={level.id}>
            <Link
              href={`/courses?level=${encodeURIComponent(level.name)}`}
              className="group flex h-full card-hover items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft font-heading text-xl font-bold text-accent-strong">
                {index + 1}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold group-hover:underline">{level.name}</span>
                <span className="text-sm text-muted">{t('seeCoursesAt')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex justify-center">
        <LinkButton href="/find-your-level" variant="secondary" size="lg">
          {t('findLevelButton')}
        </LinkButton>
      </div>
    </PublicSection>
  );
}

/**
 * "Natik in numbers": real totals on a deep-blue band, shown only when they are big enough to be
 * worth showing. Each figure gets a gold icon badge, so the band reads at a glance on a phone.
 */
export async function StatsStrip({ stats }: { stats: PublicStats | null }) {
  const t = await getTranslations('home');
  if (!stats) return null;
  const items = [
    { value: stats.learners, label: t('statLearners'), min: 20, icon: Users },
    { value: stats.courses, label: t('statCourses'), min: 3, icon: BookOpen },
    { value: stats.lessons, label: t('statLessons'), min: 10, icon: Video },
    { value: stats.languages, label: t('statLanguages'), min: 2, icon: Languages },
  ].filter((item) => item.value >= item.min);
  if (items.length < 2) return null;
  return (
    <section
      aria-labelledby="stats-heading"
      className="on-dark relative overflow-hidden bg-linear-to-br from-primary via-primary to-[#0b2a42] text-white"
    >
      {/* Soft gold glows and a fine dot pattern, drawn with CSS only (no images to download). */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-accent/20 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-28 size-80 rounded-full bg-white/10 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.07]"
      />
      <Container className="relative py-12 md:py-16">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
          <p className="text-sm font-bold tracking-widest text-accent uppercase">
            {t('statsEyebrow')}
          </p>
          <h2 id="stats-heading" className="font-heading text-2xl font-bold text-white md:text-3xl">
            {t('statsTitle')}
          </h2>
        </div>
        <ul
          className={cn(
            'mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 md:mt-10 md:gap-5',
            items.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4',
            items.length === 3 && 'max-md:[&>*:last-child]:col-span-2',
          )}
        >
          {items.map((item) => (
            <li
              key={item.label}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-6 text-center shadow-[0_8px_30px_rgb(0_0_0/0.12)] md:py-8"
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary shadow-card">
                <item.icon className="size-6" aria-hidden />
              </span>
              <p className="font-heading text-4xl leading-none font-bold text-white md:text-5xl">
                {item.value.toLocaleString('en-US')}
              </p>
              <p className="text-sm font-semibold tracking-wide text-white/80 md:text-base">
                {item.label}
              </p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** A teacher who chose to appear on the website. */
export function TeacherCard({ teacher, columns = 4 }: { teacher: PublicTeacher; columns?: 3 | 4 }) {
  return (
    <li
      className={cn(
        'w-full sm:w-[calc(50%-0.625rem)]',
        columns === 4 ? 'lg:w-[calc(25%-0.95rem)]' : 'lg:w-[calc(33.333%-0.85rem)]',
        'flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-7 text-center shadow-card',
      )}
    >
      {teacher.photoUrl ? (
        <span className="relative size-24 overflow-hidden rounded-full bg-primary-soft">
          <Image
            src={teacher.photoUrl}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
            unoptimized
          />
        </span>
      ) : (
        <Avatar name={teacher.name} size="lg" decorative />
      )}
      <h3 className="font-sans text-lg font-semibold">{teacher.name}</h3>
      {teacher.languages.length > 0 ? (
        <p className="text-sm font-semibold text-accent-strong">{teacher.languages.join(' · ')}</p>
      ) : null}
      {teacher.bio ? <p className="text-muted">{teacher.bio}</p> : null}
    </li>
  );
}

export async function TeachersSection({ teachers }: { teachers: PublicTeacher[] }) {
  const t = await getTranslations('home');
  if (teachers.length === 0) return null;
  return (
    <PublicSection
      tone="white"
      eyebrow={t('teachersEyebrow')}
      title={t('teachersTitle')}
      link={{ href: '/teachers', label: t('allTeachers') }}
    >
      <ul className="flex flex-wrap justify-center gap-5">
        {teachers.slice(0, 4).map((teacher) => (
          <TeacherCard key={teacher.id} teacher={teacher} />
        ))}
      </ul>
    </PublicSection>
  );
}

/** Join the Telegram channel or message on WhatsApp. Shows only what Natik has set up. */
export async function CommunityBand() {
  const t = await getTranslations('home');
  const site = await getLiveSiteConfig();
  const channel = site.socials.find((s) => s.name === 'Telegram channel')?.href;
  const whatsapp = whatsappUrl(site);
  if (!channel && !whatsapp) return null;
  return (
    <PublicSection
      tone="soft"
      eyebrow={t('communityEyebrow')}
      title={t('communityTitle')}
      intro={t('communityText')}
    >
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
        {channel ? (
          <ExternalLinkButton
            href={channel}
            size="lg"
            className="h-auto min-h-13 w-full bg-[#1b7fa8] py-3 text-center whitespace-normal hover:bg-[#166a8c] sm:w-auto"
          >
            <SocialIcon name="Telegram" className="size-5" /> {t('joinTelegram')}
          </ExternalLinkButton>
        ) : null}
        {whatsapp ? (
          <ExternalLinkButton
            href={whatsapp}
            size="lg"
            variant="secondary"
            className="h-auto min-h-13 w-full py-3 text-center whitespace-normal sm:w-auto"
          >
            <SocialIcon name="WhatsApp" className="size-5" /> {t('askWhatsapp')}
          </ExternalLinkButton>
        ) : null}
      </div>
    </PublicSection>
  );
}

/**
 * "Find your place on Natik": four cards for the four kinds of visitor (someone new, a student, a
 * teacher, someone with questions), each with a real number, three promises and one next step. On
 * large screens the cards sit at a slight angle that straightens when you point at them.
 */
export async function AudienceSection({
  stats,
  teacherCount,
}: {
  stats: PublicStats | null;
  teacherCount: number;
}) {
  const t = await getTranslations('home');
  const cards = t.raw('audience.cards') as {
    label: string;
    title: string;
    points: string[];
    cta: string;
    stat: string;
  }[];
  const numbers = [stats?.languages ?? 0, stats?.courses ?? 0, teacherCount, stats?.lessons ?? 0];
  const icons = [Compass, GraduationCap, Presentation, MessageCircleQuestion];
  const tilt = [
    'lg:[transform:perspective(1400px)_rotateY(4deg)_rotateX(1deg)]',
    'lg:[transform:perspective(1400px)_rotateY(-4deg)_rotateX(1deg)]',
    'lg:[transform:perspective(1400px)_rotateY(4deg)_rotateX(-1deg)]',
    'lg:[transform:perspective(1400px)_rotateY(-4deg)_rotateX(-1deg)]',
  ];
  const cta = (index: number, label: string) => {
    const className = 'inline-flex min-h-11 items-center gap-1.5 font-bold hover:underline';
    const arrow = <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />;
    if (index === 0)
      return (
        <ToolButton tool="level" plain className={className}>
          {label} {arrow}
        </ToolButton>
      );
    if (index === 1)
      return (
        <AuthLink mode="register" className={className}>
          {label} {arrow}
        </AuthLink>
      );
    if (index === 2)
      return (
        <ToolButton tool="contact" plain className={className}>
          {label} {arrow}
        </ToolButton>
      );
    return (
      <Link href="/faq" className={className}>
        {label} {arrow}
      </Link>
    );
  };

  return (
    <PublicSection eyebrow={t('audience.eyebrow')} title={t('audience.title')}>
      <ul className="grid gap-5 md:grid-cols-2 lg:gap-7 [&>li]:[perspective:1400px]">
        {cards.map((card, index) => {
          const Icon = icons[index] ?? Compass;
          const gold = index % 3 === 2;
          return (
            <li key={card.label}>
              <div
                className={cn(
                  'relative flex h-full flex-col gap-4 overflow-hidden rounded-3xl border p-6 shadow-card transition duration-500 ease-out hover:shadow-overlay md:p-7',
                  'lg:hover:[transform:none]',
                  tilt[index],
                  gold
                    ? 'border-accent/40 bg-linear-to-br from-accent-soft via-surface to-surface'
                    : 'border-primary/20 bg-linear-to-br from-primary-soft via-surface to-surface',
                )}
              >
                <span
                  className={cn('absolute inset-x-0 top-0 h-1', gold ? 'bg-accent' : 'bg-primary')}
                  aria-hidden
                />
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'flex items-center gap-2 text-sm font-bold tracking-wider uppercase',
                      gold ? 'text-accent-strong' : 'text-primary',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {card.label}
                  </span>
                  {numbers[index]! > 0 ? (
                    <span className="text-end leading-tight">
                      <span
                        className={cn(
                          'block font-heading text-2xl font-bold',
                          gold ? 'text-accent-strong' : 'text-primary',
                        )}
                      >
                        {numbers[index]!.toLocaleString('en-US')}
                      </span>
                      <span className="text-xs text-muted">{card.stat}</span>
                    </span>
                  ) : null}
                </div>
                <h3 className="font-sans text-xl font-bold md:text-2xl">{card.title}</h3>
                <ul className="flex flex-col gap-2">
                  {card.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-ink/90">
                      <Check
                        className={cn(
                          'mt-0.5 size-4.5 shrink-0',
                          gold ? 'text-accent-strong' : 'text-primary',
                        )}
                        strokeWidth={3}
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className={cn('mt-auto pt-2', gold ? 'text-accent-strong' : 'text-primary')}>
                  {cta(index, card.cta)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </PublicSection>
  );
}
