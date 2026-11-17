import { formatDate } from '@natik/shared';
import { BookOpen } from 'lucide-react';
import Image from 'next/image';
import Link from '@/components/ui/link';
import { useTranslations } from 'next-intl';
import { ProgressBar } from '@/components/ui/progress';
import { StatusPill } from '@/components/ui/status-pill';
import type { MyCourseItem } from '@/lib/api/learn-types';

/** A course the student has started or is waiting on: picture, title, progress or status. One link. */
export function MyCourseCard({ item }: { item: MyCourseItem }) {
  const t = useTranslations('myCourses');
  const open = item.status === 'ACTIVE' || item.status === 'COMPLETED';
  // Courses that aren't open yet lead to where the next step is: payment, or the course page.
  const href = open
    ? `/learn/${item.course.slug}`
    : item.status === 'AWAITING_PAYMENT'
      ? `/pay/${item.enrolmentId}`
      : `/courses/${item.course.slug}`;
  const ended = item.endAt && new Date(item.endAt) < new Date();

  return (
    <Link
      href={href}
      className="group flex card-hover gap-3 rounded-xl border border-border bg-surface p-3 shadow-card sm:flex-col sm:p-0"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-primary sm:aspect-video sm:size-auto sm:rounded-none sm:rounded-t-xl">
        {item.course.imageUrl ? (
          <Image
            src={item.course.imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 380px, 80px"
            className="card-hover-image object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center" aria-hidden>
            <BookOpen className="size-8 text-white/60" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 sm:p-4">
        <h3 className="line-clamp-2 leading-snug font-semibold group-hover:underline">
          {item.course.title}
        </h3>
        {item.status === 'ACTIVE' || item.status === 'COMPLETED' ? (
          <>
            <ProgressBar value={item.progressPct} size="sm" showValue />
            {item.status === 'COMPLETED' ? (
              <StatusPill status="enrolment.COMPLETED" size="sm" />
            ) : null}
            {item.endAt ? (
              <p className="text-xs text-muted">
                {ended
                  ? t('endedOn', { date: formatDate(item.endAt) })
                  : t('endsOn', { date: formatDate(item.endAt) })}
              </p>
            ) : null}
          </>
        ) : (
          <StatusPill
            status={
              item.paymentUnderReview ? 'enrolment.PAYMENT_SUBMITTED' : `enrolment.${item.status}`
            }
            size="sm"
            className="self-start"
          />
        )}
      </div>
    </Link>
  );
}
