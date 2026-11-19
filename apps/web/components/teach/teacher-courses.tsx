import { BookOpen, Users } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusPill } from '@/components/ui/status-pill';
import type { TeacherCourse } from '@/lib/api/types';
import { contentLang } from '@/lib/script';

/** The courses a teacher works on (admins see every course). Used by the dashboard and the course list. */
export async function TeacherCourses({ courses }: { courses: TeacherCourse[] }) {
  const t = await getTranslations('teach');
  if (courses.length === 0) {
    return (
      <Card>
        <EmptyState icon={BookOpen} title={t('noCourses')} description={t('noCoursesText')} />
      </Card>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => (
        <li key={course.id}>
          <Link
            href={`/teach/courses/${course.id}`}
            className="group flex h-full card-hover flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
          >
            <div className="relative aspect-[3/2] bg-primary-soft">
              {course.imageUrl ? (
                <Image
                  src={course.imageUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                  quality={60}
                  className="card-hover-image object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center text-primary/40">
                  <BookOpen className="size-10" aria-hidden />
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <h2
                  className="text-lg leading-snug font-semibold text-ink group-hover:text-primary"
                  {...contentLang(course.title)}
                >
                  {course.title}
                </h2>
                <StatusPill status={`content.${course.status}`} size="sm" />
              </div>
              <p className="text-sm text-muted">
                {course.language} · {course.level}
              </p>
              <p className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm text-muted">
                <span>
                  {t('lessonsLive', {
                    live: course.publishedLessonCount,
                    total: course.lessonCount,
                  })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  {t('students', { count: course.studentCount })}
                </span>
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
