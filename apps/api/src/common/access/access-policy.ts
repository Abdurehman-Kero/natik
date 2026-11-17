import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';

/** The person asking. `undefined` = a visitor who is not signed in. */
export interface Actor {
  id: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
}

/** Why a lesson did not open, so the screen can say what to do next (ARCHITECTURE §9). */
export type LessonDenial =
  | 'NOT_FOUND'
  | 'SIGN_IN'
  | 'NOT_ENROLLED'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_UNDER_REVIEW'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'NOT_AVAILABLE'
  | 'LESSON_LOCKED';

export type LessonAccess =
  | { allowed: true; as: 'STAFF' | 'FREE_PREVIEW' | 'STUDENT'; lesson: AccessedLesson }
  | { allowed: false; reason: LessonDenial };

/** Result of checking a student's enrolment for a course. */
export type CourseGrant =
  | { allowed: true; enrolment: EnrolmentInfo }
  | { allowed: false; reason: LessonDenial; enrolment: EnrolmentInfo | null };

export interface EnrolmentInfo {
  id: string;
  status:
    'AWAITING_PAYMENT' | 'PAYMENT_SUBMITTED' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  endAt: Date | null;
}

export interface AccessedLesson {
  id: string;
  courseId: string;
  unitId: string;
  downloadsAllowed: boolean;
}

/**
 * Record-level permission checks. Every service calls these; controllers never decide access on
 * their own (ARCHITECTURE §9). Role checks (`@Roles`) only say who may reach a route.
 */
@Injectable()
export class AccessPolicy {
  constructor(private readonly prisma: PrismaService) {}

  /** Admin, or a teacher assigned to the course (FR-TEACH-002, FR-ADMIN-005). */
  async canEditCourseContent(actor: Actor | undefined, courseId: string): Promise<boolean> {
    if (!actor) return false;
    if (actor.role === 'ADMIN') return true;
    if (actor.role !== 'TEACHER') return false;
    const link = await this.prisma.courseTeacher.findUnique({
      where: { courseId_teacherId: { courseId, teacherId: actor.id } },
      select: { courseId: true },
    });
    return link !== null;
  }

  /** Price, access, Free/Paid, teachers and featured are admin-only (FR-TEACH-007). */
  canEditCourseSettings(actor: Actor | undefined): boolean {
    return actor?.role === 'ADMIN';
  }

  /**
   * Throws 403 when the person may not edit this course's content. A course that does not exist
   * answers the same way, so teachers can't probe for other courses.
   */
  async assertCanEditCourseContent(actor: Actor, courseId: string): Promise<void> {
    if (!(await this.canEditCourseContent(actor, courseId))) {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
  }

  /**
   * Who may open a lesson (and the files and videos inside it).
   * - Staff who can edit the course: always, drafts included (preview).
   * - Anyone: a free-preview lesson that is published with all its parents (FR-LEARN-010, FR-CAT-005).
   * - Students: need an enrolment that is ACTIVE, or COMPLETED and before its end date (ARCHITECTURE §6).
   */
  async canOpenLesson(actor: Actor | undefined, lessonId: string): Promise<LessonAccess> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        courseId: true,
        unitId: true,
        status: true,
        isFreePreview: true,
        downloadsAllowed: true,
        unit: { select: { status: true } },
        course: { select: { status: true } },
      },
    });
    if (!lesson) return { allowed: false, reason: 'NOT_FOUND' };
    const accessed: AccessedLesson = {
      id: lesson.id,
      courseId: lesson.courseId,
      unitId: lesson.unitId,
      downloadsAllowed: lesson.downloadsAllowed,
    };

    if (await this.canEditCourseContent(actor, lesson.courseId)) {
      return { allowed: true, as: 'STAFF', lesson: accessed };
    }

    // Students only ever see an item when it and all its parents are published.
    const live =
      lesson.status === 'PUBLISHED' &&
      lesson.unit.status === 'PUBLISHED' &&
      lesson.course.status === 'PUBLISHED';
    if (!live) return { allowed: false, reason: 'NOT_AVAILABLE' };
    if (lesson.isFreePreview) return { allowed: true, as: 'FREE_PREVIEW', lesson: accessed };
    if (!actor) return { allowed: false, reason: 'SIGN_IN' };
    if (actor.role !== 'STUDENT') return { allowed: false, reason: 'NOT_ENROLLED' };

    const grant = await this.studentCourseAccess(actor.id, lesson.courseId);
    if (!grant.allowed) return { allowed: false, reason: grant.reason };
    if (await this.lessonLockedBy(actor.id, lesson.courseId, lesson.id)) {
      return { allowed: false, reason: 'LESSON_LOCKED' };
    }
    return { allowed: true, as: 'STUDENT', lesson: accessed };
  }

  /**
   * In a course that opens lessons in order, a lesson stays closed until every earlier lesson (apart
   * from ones marked "always open") is done. Returns the first lesson still to finish, or null when
   * the lesson is open.
   */
  async lessonLockedBy(
    studentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<{ id: string; title: string } | null> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { lessonOrder: true },
    });
    if (course?.lessonOrder !== 'IN_ORDER') return null;
    const lessons = await this.prisma.lesson.findMany({
      where: {
        courseId,
        status: 'PUBLISHED',
        unit: { status: 'PUBLISHED' },
      },
      select: {
        id: true,
        title: true,
        alwaysOpen: true,
        position: true,
        unit: { select: { position: true } },
      },
    });
    lessons.sort((a, b) => a.unit.position - b.unit.position || a.position - b.position);
    const index = lessons.findIndex((l) => l.id === lessonId);
    if (index <= 0 || lessons[index]!.alwaysOpen) return null;
    const before = lessons.slice(0, index).filter((l) => !l.alwaysOpen);
    if (before.length === 0) return null;
    const done = await this.prisma.lessonProgress.findMany({
      where: {
        studentId,
        lessonId: { in: before.map((l) => l.id) },
        completedAt: { not: null },
      },
      select: { lessonId: true },
    });
    const doneIds = new Set(done.map((d) => d.lessonId));
    const next = before.find((l) => !doneIds.has(l.id));
    return next ? { id: next.id, title: next.title } : null;
  }

  /**
   * Whether a student's enrolment currently opens a course: ACTIVE, or COMPLETED, and before the end
   * date (ARCHITECTURE §6). When not, says why, so the screen can offer the right next step.
   */
  async studentCourseAccess(
    studentId: string,
    courseId: string,
    now = new Date(),
  ): Promise<CourseGrant> {
    const enrolment = await this.prisma.enrolment.findFirst({
      where: { studentId, courseId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, endAt: true },
    });
    if (!enrolment) return { allowed: false, reason: 'NOT_ENROLLED', enrolment: null };
    const info = { id: enrolment.id, status: enrolment.status, endAt: enrolment.endAt };
    const deny = (reason: LessonDenial): CourseGrant => ({
      allowed: false,
      reason,
      enrolment: info,
    });
    switch (enrolment.status) {
      case 'ACTIVE':
      case 'COMPLETED':
        return enrolment.endAt && enrolment.endAt < now
          ? deny('EXPIRED')
          : { allowed: true, enrolment: info };
      case 'AWAITING_PAYMENT':
        return deny('AWAITING_PAYMENT');
      case 'PAYMENT_SUBMITTED':
        return deny('PAYMENT_UNDER_REVIEW');
      case 'EXPIRED':
        return deny('EXPIRED');
      default:
        return deny('CANCELLED');
    }
  }

  /** Same check, but throws the right error. Visitors who need to sign in get 401, everyone else 403/404. */
  async assertCanOpenLesson(actor: Actor | undefined, lessonId: string): Promise<AccessedLesson> {
    const result = await this.canOpenLesson(actor, lessonId);
    if (result.allowed) return result.lesson;
    switch (result.reason) {
      case 'NOT_FOUND':
      case 'NOT_AVAILABLE':
        throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      case 'SIGN_IN':
        throw new AppException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
      case 'EXPIRED':
        throw new AppException('ACCESS_EXPIRED', HttpStatus.FORBIDDEN);
      default:
        throw new AppException('COURSE_ACCESS_DENIED', HttpStatus.FORBIDDEN, {
          params: { reason: result.reason },
        });
    }
  }
}
