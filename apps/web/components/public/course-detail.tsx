import { formatPrice } from '@natik/shared';
import { ChevronDown, CircleCheck, ListOrdered, PlayCircle } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { CourseAction } from '@/components/public/course-action';
import { PaymentSupport } from '@/components/public/support-contact';
import { TrailerPlayer } from '@/components/public/trailer-player';
import { VideoEmbed } from '@/components/lesson/video-embed';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { KeyValue } from '@/components/ui/key-value';
import type { PublicCourseDetail } from '@/lib/api/public';

/** The main column of a course page: trailer, about, what you learn, outline and teachers. */
export async function CourseBody({ course }: { course: PublicCourseDetail }) {
  const t = await getTranslations('courses');
  const lessonTotal = course.outline.reduce((sum, unit) => sum + unit.lessons.length, 0);
  return (
    <div className="flex flex-col gap-10">
      {course.trailerEmbedUrl ? (
        <TrailerPlayer embedUrl={course.trailerEmbedUrl} title={course.title} />
      ) : course.previewVideo ? (
        <VideoEmbed
          videoId={course.previewVideo.videoId}
          title={course.previewVideo.title}
          status={course.previewVideo.status}
          durationSec={course.previewVideo.durationSec}
          posterUrl={course.previewVideo.posterUrl}
          lang={course.language.code}
        />
      ) : null}

      {course.descriptionHtml ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold md:text-2xl">{t('aboutTitle')}</h2>
          <div
            className="lesson-prose"
            lang={course.language.code}
            dir={course.language.direction === 'RTL' ? 'rtl' : 'ltr'}
            // Safe: the API builds this HTML from an allow-list of tags (rich-text.ts).
            dangerouslySetInnerHTML={{ __html: course.descriptionHtml }}
          />
        </section>
      ) : null}

      {course.outcomes.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold md:text-2xl">{t('learnTitle')}</h2>
          <ul className="flex flex-col gap-3">
            {course.outcomes.map((outcome) => (
              <li key={outcome} className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                <span>{outcome}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-1 text-xl font-semibold md:text-2xl">{t('outlineTitle')}</h2>
        {lessonTotal > 0 ? (
          <p className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted">
            <span>{t('lessonsCount', { count: lessonTotal })}</span>
            {course.lessonOrder === 'IN_ORDER' ? (
              <span className="inline-flex items-center gap-1.5">
                <ListOrdered className="size-4" aria-hidden /> {t('inOrderNote')}
              </span>
            ) : null}
          </p>
        ) : null}
        {course.outline.length > 0 ? (
          <div className="flex flex-col gap-3">
            {course.outline.map((unit, index) => (
              <details
                key={unit.id}
                open={index === 0 || undefined}
                className="group rounded-xl border border-border bg-surface shadow-card"
              >
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
                  <ChevronDown
                    className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 font-semibold">{unit.title}</span>
                  <span className="shrink-0 text-sm text-muted">
                    {t('lessonsCount', { count: unit.lessons.length })}
                  </span>
                </summary>
                <ul className="flex flex-col border-t border-border">
                  {unit.lessons.map((lesson) => (
                    <li key={lesson.id} className="flex items-center gap-2 px-4 text-ink/90">
                      <PlayCircle className="size-4 shrink-0 text-muted" aria-hidden />
                      {lesson.isFreePreview ? (
                        <Link
                          href={`/courses/${course.slug}/lessons/${lesson.id}`}
                          className="flex min-h-11 min-w-0 flex-1 items-center font-medium text-primary hover:underline"
                        >
                          {lesson.title}
                        </Link>
                      ) : (
                        <span className="flex min-h-11 min-w-0 flex-1 items-center">
                          {lesson.title}
                        </span>
                      )}
                      {lesson.isFreePreview ? (
                        <Badge tone="accent">{t('freePreview')}</Badge>
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
      </section>

      {course.teachers.length > 0 ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold md:text-2xl">
            {course.teachers.length > 1 ? t('teachersTitle') : t('teacherTitle')}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {course.teachers.map((teacher) => (
              <li key={teacher.name}>
                <Card className="flex h-full items-start gap-4 p-4">
                  <Avatar name={teacher.name} size="lg" decorative />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="font-semibold">{teacher.name}</p>
                    {teacher.bio ? <p className="text-muted">{teacher.bio}</p> : null}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** The side card: picture, price, facts and the one button that fits the visitor or student. */
export async function CourseSidebar({ course }: { course: PublicCourseDetail }) {
  const t = await getTranslations('courses');
  const price = formatPrice(course.access, course.priceSantim, t('free'));
  const access = course.accessDays
    ? t('accessDays', { days: course.accessDays })
    : t('accessUnlimited');
  return (
    <aside className="order-first lg:sticky lg:top-24 lg:order-none">
      <Card className="overflow-hidden p-0">
        {course.imageUrl ? (
          // With a video on the page, phones skip this picture: the video right below is the preview.
          <div
            className={
              course.trailerEmbedUrl || course.previewVideo
                ? 'relative hidden aspect-video lg:block'
                : 'relative aspect-video'
            }
          >
            <Image
              src={course.imageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 352px, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-5 p-5">
          <p className="font-heading text-2xl font-bold text-primary md:text-3xl">
            {course.access === 'PAID' && course.priceSantim === null ? t('premiumCourse') : price}
          </p>
          <KeyValue
            items={[
              { label: t('weeks'), value: course.durationText },
              { label: t('access'), value: access },
              {
                label: course.teachers.length > 1 ? t('teachersTitle') : t('teacherTitle'),
                value: course.teachers.map((teacher) => teacher.name).join(', ') || null,
              },
            ]}
          />
          <CourseAction slug={course.slug} courseId={course.id} isFree={course.access === 'FREE'} />
          {course.access === 'PAID' && course.priceSantim === null ? (
            <PaymentSupport title={t('payQuestionTitle')} text={t('payQuestionText')} />
          ) : null}
        </div>
      </Card>
    </aside>
  );
}
