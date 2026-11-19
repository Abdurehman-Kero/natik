import { formatDate, formatPrice } from '@natik/shared';
import {
  Award,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock,
  Hourglass,
  Languages,
  ListOrdered,
  Lock,
  MessageCircleQuestion,
  MessagesSquare,
  Signal,
  Smartphone,
} from 'lucide-react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ClampedHtml } from '@/components/public/clamped-html';
import { CourseAction } from '@/components/public/course-action';
import { ShareButton } from '@/components/public/share-button';
import { ToolButton } from '@/components/public/site-tool-links';
import { StickyJoinBar } from '@/components/public/sticky-join-bar';
import { PaymentSupport } from '@/components/public/support-contact';
import { TrailerPlayer } from '@/components/public/trailer-player';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import type { PublicCourseDetail } from '@/lib/api/public';

/** A white block with a heading, the building block of the overview. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-2xl p-5 md:p-6">
      <h2 className="mb-4 text-lg font-bold md:text-xl">{title}</h2>
      {children}
    </Card>
  );
}

/** Overview: what the course is, what you learn, and how it works here. */
export async function CourseOverview({ course }: { course: PublicCourseDetail }) {
  const t = await getTranslations('courses');
  const steps = t.raw('howSteps') as string[];
  return (
    <>
      <Block title={t('aboutTitle')}>
        <p className="mb-3 text-ink/90">{course.summary}</p>
        {course.descriptionHtml ? (
          <ClampedHtml
            html={course.descriptionHtml}
            lang={course.language.code}
            dir={course.language.direction === 'RTL' ? 'rtl' : 'ltr'}
          />
        ) : null}
      </Block>

      {course.outcomes.length > 0 ? (
        <Block title={t('learnTitle')}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {course.outcomes.map((outcome) => (
              <li key={outcome} className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      <Block title={t('howTitle')}>
        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={step} className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </Block>
    </>
  );
}

/** Content: the weeks and their session titles, locked until the visitor joins. */
export async function CourseContent({ course }: { course: PublicCourseDetail }) {
  const t = await getTranslations('courses');
  const lessonTotal = course.outline.reduce((sum, unit) => sum + unit.lessons.length, 0);
  return (
    <Block title={t('outlineTitle')}>
      {lessonTotal > 0 ? (
        <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
          <span>
            {t('weeksAndSessions', { weeks: course.outline.length, sessions: lessonTotal })}
          </span>
          {course.lessonOrder === 'IN_ORDER' ? (
            <span className="inline-flex items-center gap-1.5">
              <ListOrdered className="size-4" aria-hidden /> {t('inOrderNote')}
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="mb-4 flex items-start gap-2 rounded-xl bg-primary-soft px-4 py-3 text-sm text-primary">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {course.ongoing ? `${t('weeklyNote')} ` : ''}
          {t('membersOnly')}
        </span>
      </p>
      {course.outline.length > 0 ? (
        <div className="flex flex-col gap-3">
          {course.outline.map((unit, index) => (
            <details
              key={unit.id}
              open={index === 0 || undefined}
              className="group rounded-xl border border-border bg-surface"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 font-semibold">
                  <span className="text-muted">{t('weekN', { n: index + 1 })} · </span>
                  {unit.title}
                </span>
                <span className="hidden shrink-0 text-sm text-muted sm:block">
                  {t('sessionsCount', { count: unit.lessons.length })}
                </span>
                <ChevronDown
                  className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <ul className="flex flex-col border-t border-border">
                {unit.lessons.map((lesson, lessonIndex) => (
                  <li key={lesson.id} className="flex min-h-12 items-center gap-3 px-4 text-ink/90">
                    <Lock className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="w-20 shrink-0 text-sm text-muted">
                      {t('sessionN', { n: lessonIndex + 1 })}
                    </span>
                    <span className="min-w-0 flex-1 py-2">{lesson.title}</span>
                    {lesson.sessionDate ? (
                      <span className="shrink-0 text-sm text-muted">
                        {formatDate(lesson.sessionDate)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-muted">{t('outlineEmpty')}</p>
      )}
    </Block>
  );
}

/** Instructor: each teacher with a short introduction. */
export async function CourseInstructor({ course }: { course: PublicCourseDetail }) {
  const t = await getTranslations('courses');
  if (course.teachers.length === 0) {
    return (
      <Block title={t('instructorTitle')}>
        <p className="text-muted">{t('outlineEmpty')}</p>
      </Block>
    );
  }
  return (
    <>
      {course.teachers.map((teacher) => (
        <Card key={teacher.name} className="flex items-start gap-4 rounded-2xl p-5 md:p-6">
          <Avatar name={teacher.name} size="lg" decorative />
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-lg font-bold md:text-xl">{teacher.name}</h2>
            <p className="text-sm font-semibold text-primary">{t('instructorTitle')}</p>
            {teacher.bio ? <p className="mt-1 text-muted">{teacher.bio}</p> : null}
          </div>
        </Card>
      ))}
    </>
  );
}

/** The side card: picture or trailer, price, the one button that fits the visitor, and the facts. */
export async function CourseSidebar({ course }: { course: PublicCourseDetail }) {
  const t = await getTranslations('courses');
  const ts = await getTranslations('site.course');
  const price = formatPrice(course.access, course.priceSantim, t('free'));
  const priceText =
    course.access === 'PAID' && course.priceSantim === null ? t('premiumCourse') : price;
  const access = course.accessDays
    ? t('accessDays', { days: course.accessDays })
    : t('accessUnlimited');
  const sessions = course.outline.reduce((sum, unit) => sum + unit.lessons.length, 0);

  const facts = [
    { icon: Clock, label: t('includeDuration'), value: course.durationText },
    {
      icon: CalendarDays,
      label: t('includeSessions'),
      value:
        sessions > 0 ? t('weeksAndSessions', { weeks: course.outline.length, sessions }) : null,
    },
    { icon: Hourglass, label: t('includeAccess'), value: access },
    { icon: Languages, label: t('includeLanguage'), value: course.language.name },
    { icon: Signal, label: t('includeLevel'), value: course.level.name },
    { icon: Award, label: t('includeCertificate'), value: null },
    { icon: MessagesSquare, label: t('includeGroup'), value: null },
    { icon: Smartphone, label: t('includeDevices'), value: null },
  ];

  return (
    <aside className="order-first min-w-0 lg:sticky lg:top-24 lg:order-none">
      <Card id="course-action" className="overflow-hidden rounded-2xl p-0">
        {course.trailerEmbedUrl ? (
          <TrailerPlayer embedUrl={course.trailerEmbedUrl} title={course.title} />
        ) : course.imageUrl ? (
          <div className="relative aspect-video">
            <Image
              src={course.imageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 352px, 100vw"
              quality={60}
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-5 p-5">
          <p className="text-center font-heading text-3xl font-bold text-primary">{priceText}</p>
          <CourseAction slug={course.slug} courseId={course.id} isFree={course.access === 'FREE'} />
          {course.access === 'PAID' && course.priceSantim === null ? (
            <PaymentSupport title={t('payQuestionTitle')} text={t('payQuestionText')} />
          ) : null}

          <div className="border-t border-border pt-5">
            <h2 className="mb-3 font-sans text-base font-bold">{t('includesTitle')}</h2>
            <ul className="flex flex-col gap-2.5 text-[0.9375rem]">
              {facts
                .filter((f) => f.value !== undefined)
                .map((f) => (
                  <li key={f.label} className="flex items-start gap-3">
                    <f.icon className="mt-0.5 size-4.5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      {f.value ? (
                        <>
                          <span className="text-muted">{f.label}: </span>
                          <span className="font-medium">{f.value}</span>
                        </>
                      ) : (
                        <span className="font-medium">{f.label}</span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <p className="text-sm font-bold">{t('shareTitle')}</p>
            <ShareButton title={course.title} />
          </div>
          <ToolButton
            tool="contact"
            plain
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary-soft"
          >
            <MessageCircleQuestion className="size-4.5" aria-hidden />
            {ts('askQuestion')}
          </ToolButton>
        </div>
      </Card>
      <StickyJoinBar targetId="course-action" price={priceText} />
    </aside>
  );
}
