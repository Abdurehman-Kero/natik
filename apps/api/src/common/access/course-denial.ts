import { HttpStatus } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import type { LessonDenial } from './access-policy';

/**
 * The error for "this student can't open this yet". It carries the reason and the course, so the
 * screen can say why and offer the one next step (enrol, pay, renew…). Used by lessons and quizzes.
 */
export function courseDenial(
  reason: LessonDenial,
  course: { slug: string; access: string },
  courseId: string,
  enrolment: { id: string; endAt: Date | null } | null,
): AppException {
  const params: Record<string, string | number> = {
    reason,
    courseId,
    courseSlug: course.slug,
    courseAccess: course.access,
  };
  if (enrolment) params.enrolmentId = enrolment.id;
  if (enrolment?.endAt) params.endAt = enrolment.endAt.toISOString();
  return new AppException(
    reason === 'EXPIRED' ? 'ACCESS_EXPIRED' : 'COURSE_ACCESS_DENIED',
    HttpStatus.FORBIDDEN,
    { params },
  );
}
