import { Award, ClipboardCheck, PlayCircle, Presentation } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { PublicSection } from '@/components/public/section';
import { Avatar } from '@/components/ui/avatar';
import { ExternalLinkButton, LinkButton } from '@/components/ui/button';
import { Container } from '@/components/ui/layout';
import { SocialIcon } from '@/components/ui/social-icon';
import type { PublicStats, PublicTeacher } from '@/lib/api/public';
import { cn } from '@/lib/cn';
import { whatsappUrl } from '@/lib/site-config';
import { getLiveSiteConfig } from '@/lib/site-config-live';

const FLOW_ICONS = [PlayCircle, Presentation, ClipboardCheck, Award];

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

/** Real totals, shown only when they are big enough to be worth showing. */
export async function StatsStrip({ stats }: { stats: PublicStats | null }) {
  const t = await getTranslations('home');
  if (!stats) return null;
  const items = [
    { value: stats.learners, label: t('statLearners'), min: 20 },
    { value: stats.courses, label: t('statCourses'), min: 3 },
    { value: stats.lessons, label: t('statLessons'), min: 10 },
    { value: stats.languages, label: t('statLanguages'), min: 2 },
  ].filter((item) => item.value >= item.min);
  if (items.length < 2) return null;
  return (
    <section className="on-dark bg-linear-to-br from-primary via-primary to-[#0b2a42] text-white">
      <Container className="py-8 md:py-10">
        <dl className="flex flex-wrap justify-center gap-x-12 gap-y-6 text-center md:gap-x-24">
          {items.map((item) => (
            <div key={item.label} className="flex min-w-[7.5rem] flex-col items-center gap-1">
              <dd className="order-1 font-heading text-3xl font-bold text-white md:text-4xl">
                {item.value.toLocaleString('en-US')}
              </dd>
              <dt className="order-2 text-sm text-white/80 md:text-base">{item.label}</dt>
            </div>
          ))}
        </dl>
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
