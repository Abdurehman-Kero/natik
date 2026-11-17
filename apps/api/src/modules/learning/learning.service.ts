import { HttpStatus, Injectable } from '@nestjs/common';
import { AccessPolicy } from '../../common/access/access-policy';
import { courseDenial } from '../../common/access/course-denial';
import { AppException } from '../../common/errors/app.exception';
import { RateLimiter } from '../../common/security/rate-limiter';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';
import { LessonViewService } from '../content/lesson-view.service';
import { ProgressService } from '../enrolments/progress.service';
import { AnnouncementsService } from '../notifications/announcements.service';

type LessonState = 'done' | 'current' | 'todo' | 'locked';

/**
 * What a student sees while learning (FR-STU, FR-LEARN). Every call checks the student's enrolment
 * first, so a direct link or a changed ID never shows anything they have not paid for (BR-ROLE-003).
 */
@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    private readonly progress: ProgressService,
    private readonly views: LessonViewService,
    private readonly announcements: AnnouncementsService,
    private readonly limiter: RateLimiter,
  ) {}

  // ── Student home ──────────────────────────────────────────────────────

  async dashboard(student: SessionUser) {
    const [courses, news, results, certificates, toConfirm] = await Promise.all([
      this.myCourses(student),
      this.announcements.studentSummary(student.id),
      this.recentResults(student.id),
      this.prisma.certificate.findMany({
        where: { studentId: student.id, status: 'VALID' },
        orderBy: { issuedAt: 'desc' },
        take: 2,
        select: { id: true, number: true, courseTitleSnapshot: true },
      }),
      // Finished courses whose certificate waits for the student to confirm (or fix) the name.
      this.prisma.enrolment.findMany({
        where: {
          studentId: student.id,
          status: 'COMPLETED',
          certificates: { none: {} },
          OR: [
            { certificateRequest: { is: null } },
            { certificateRequest: { status: { in: ['AWAITING_NAME', 'RETURNED'] } } },
          ],
        },
        orderBy: { completedAt: 'desc' },
        take: 3,
        select: { id: true, course: { select: { title: true } } },
      }),
    ]);
    // "Continue learning" is the most recently opened course that is still open.
    const open = courses.items
      .filter((c) => c.status === 'ACTIVE' && c.continueLesson)
      .sort((a, b) => (b.lastOpenedAt?.getTime() ?? 0) - (a.lastOpenedAt?.getTime() ?? 0));
    const next = open[0];
    return {
      firstName: student.fullName.split(/\s+/)[0] ?? student.fullName,
      continue: next
        ? {
            courseSlug: next.course.slug,
            courseTitle: next.course.title,
            lessonId: next.continueLesson!.id,
            lessonTitle: next.continueLesson!.title,
            progressPct: next.progressPct,
          }
        : null,
      courses: courses.items.slice(0, 6),
      totalCourses: courses.items.length,
      news,
      results,
      certificates: certificates.map((c) => ({
        id: c.id,
        number: c.number,
        courseTitle: c.courseTitleSnapshot,
      })),
      certificatesToConfirm: toConfirm.map((e) => ({ id: e.id, courseTitle: e.course.title })),
    };
  }

  /** The latest quiz results for the dashboard: score and pass, or "waiting for marking" (FR-STU-003). */
  private async recentResults(studentId: string) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { studentId, status: { in: ['GRADED', 'WAITING_FOR_MARKING'] } },
      orderBy: { submittedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        status: true,
        scorePct: true,
        passed: true,
        quiz: { select: { title: true, course: { select: { title: true } } } },
      },
    });
    return attempts.map((a) => ({
      id: a.id,
      status: a.status,
      scorePct: a.scorePct,
      passed: a.passed,
      quizTitle: a.quiz.title,
      courseTitle: a.quiz.course.title,
    }));
  }

  async myCourses(student: SessionUser) {
    const enrolments = await this.prisma.enrolment.findMany({
      where: { studentId: student.id },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        progressPct: true,
        endAt: true,
        lastLessonId: true,
        lastOpenedAt: true,
        studentId: true,
        courseId: true,
        course: {
          select: {
            slug: true,
            title: true,
            imageFileId: true,
            access: true,
            language: { select: { name: true, code: true } },
          },
        },
        payments: { where: { status: 'SUBMITTED' }, select: { id: true }, take: 1 },
      },
    });
    // Only the newest enrolment per course counts (an old cancelled one is history).
    const seen = new Set<string>();
    const latest = enrolments.filter((e) =>
      seen.has(e.courseId) ? false : !!seen.add(e.courseId),
    );
    const items = await Promise.all(
      latest.map(async (e) => {
        const lessonId = ['ACTIVE', 'COMPLETED'].includes(e.status)
          ? await this.progress.continueLessonId(e)
          : null;
        const lesson = lessonId
          ? await this.prisma.lesson.findUnique({
              where: { id: lessonId },
              select: { id: true, title: true },
            })
          : null;
        return {
          enrolmentId: e.id,
          status: e.status,
          progressPct: e.progressPct,
          endAt: e.endAt,
          lastOpenedAt: e.lastOpenedAt,
          paymentUnderReview: e.payments.length > 0,
          continueLesson: lesson,
          course: {
            slug: e.course.slug,
            title: e.course.title,
            access: e.course.access,
            language: e.course.language,
            imageUrl: e.course.imageFileId ? `/api/v1/files/${e.course.imageFileId}` : null,
          },
        };
      }),
    );
    return { items };
  }

  // ── Course outline ────────────────────────────────────────────────────

  /** The course outline with a state for each lesson, or the reason it is not open (FR-ENR-006). */
  async outline(student: SessionUser, slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        id: true,
        slug: true,
        title: true,
        access: true,
        priceSantim: true,
        language: { select: { code: true, direction: true } },
      },
    });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const header = {
      id: course.id,
      slug: course.slug,
      title: course.title,
      access: course.access,
      priceSantim: course.priceSantim,
      dir: course.language.direction === 'RTL' ? ('rtl' as const) : ('ltr' as const),
    };

    const grant = await this.access.studentCourseAccess(student.id, course.id);
    if (!grant.allowed) {
      return {
        course: header,
        access: {
          allowed: false as const,
          reason: grant.reason,
          enrolmentId: grant.enrolment?.id ?? null,
          endAt: grant.enrolment?.endAt ?? null,
        },
      };
    }
    const enrolment = await this.prisma.enrolment.findUniqueOrThrow({
      where: { id: grant.enrolment.id },
      select: {
        id: true,
        studentId: true,
        courseId: true,
        status: true,
        progressPct: true,
        lastLessonId: true,
      },
    });
    const built = await this.buildOutline(student.id, course.id, enrolment);
    return {
      course: header,
      access: { allowed: true as const, readOnly: enrolment.status === 'COMPLETED' },
      enrolment: {
        id: enrolment.id,
        status: enrolment.status,
        progressPct: enrolment.progressPct,
        endAt: grant.enrolment.endAt,
      },
      ...built,
    };
  }

  private async buildOutline(
    studentId: string,
    courseId: string,
    enrolment: { studentId: string; courseId: string; lastLessonId: string | null },
  ) {
    const [units, courseRow] = await Promise.all([
      this.prisma.unit.findMany({
        where: { courseId, status: 'PUBLISHED' },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          title: true,
          lessons: {
            where: { status: 'PUBLISHED' },
            orderBy: { position: 'asc' },
            select: { id: true, title: true, alwaysOpen: true, estimatedMinutes: true },
          },
        },
      }),
      this.prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { lessonOrder: true },
      }),
    ]);
    const lessonIds = units.flatMap((u) => u.lessons.map((l) => l.id));
    const done = lessonIds.length
      ? await this.prisma.lessonProgress.findMany({
          where: { studentId, lessonId: { in: lessonIds }, completedAt: { not: null } },
          select: { lessonId: true },
        })
      : [];
    const doneIds = new Set(done.map((d) => d.lessonId));
    const continueLessonId = await this.progress.continueLessonId(enrolment);

    // In a course that opens lessons in order, a lesson is locked until every earlier one is done.
    const locked = new Set<string>();
    if (courseRow.lessonOrder === 'IN_ORDER') {
      let allEarlierDone = true;
      for (const lesson of units.flatMap((u) => u.lessons)) {
        if (!lesson.alwaysOpen && !allEarlierDone) locked.add(lesson.id);
        if (!lesson.alwaysOpen && !doneIds.has(lesson.id)) allEarlierDone = false;
      }
    }

    const state = (id: string): LessonState =>
      doneIds.has(id)
        ? 'done'
        : locked.has(id)
          ? 'locked'
          : id === continueLessonId
            ? 'current'
            : 'todo';
    const outlineUnits = units
      .filter((u) => u.lessons.length > 0)
      .map((u) => ({
        id: u.id,
        title: u.title,
        done: u.lessons.filter((l) => doneIds.has(l.id)).length,
        total: u.lessons.length,
        lessons: u.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          state: state(l.id),
          minutes: l.estimatedMinutes,
        })),
      }));
    const continueLesson =
      outlineUnits.flatMap((u) => u.lessons).find((l) => l.id === continueLessonId) ?? null;
    return {
      units: outlineUnits,
      totals: { done: doneIds.size, total: lessonIds.length },
      continueLesson: continueLesson
        ? { id: continueLesson.id, title: continueLesson.title }
        : null,
    };
  }

  // ── Lessons ───────────────────────────────────────────────────────────

  /** The lesson to show, with previous/next and the contents list. 403 with a reason when not open. */
  async lesson(student: SessionUser, lessonId: string) {
    const { courseId, enrolment, course } = await this.gate(student, lessonId);
    const view = await this.views.build(lessonId);
    const [live, progressRow, quiz] = await Promise.all([
      this.progress.liveLessons(courseId),
      this.prisma.lessonProgress.findUnique({
        where: { studentId_lessonId: { studentId: student.id, lessonId } },
        select: { completedAt: true, stage: true, videoPositions: true },
      }),
      this.prisma.quiz.findFirst({
        where: { lessonId, status: 'PUBLISHED' },
        select: { id: true, title: true },
      }),
    ]);
    const index = live.findIndex((l) => l.id === lessonId);
    const outline = await this.buildOutline(student.id, courseId, {
      studentId: student.id,
      courseId,
      lastLessonId: lessonId,
    });
    const current = await this.prisma.enrolment.findUniqueOrThrow({
      where: { id: enrolment.id },
      select: { progressPct: true, status: true },
    });
    return {
      lesson: view,
      course: { slug: course.slug, title: course.title },
      nav: {
        prevId: index > 0 ? live[index - 1]!.id : null,
        nextId: index >= 0 && index < live.length - 1 ? live[index + 1]!.id : null,
        position: index + 1,
        total: live.length,
      },
      state: {
        completed: !!progressRow?.completedAt,
        // A finished course stays open to read, but nothing more can be marked (FR-LEARN-005).
        readOnly: current.status === 'COMPLETED',
        hasQuiz: quiz !== null,
        quiz: quiz ? { id: quiz.id, title: quiz.title } : null,
        progressPct: current.progressPct,
        // Where the student stopped: the step of the guided lesson and each video's position.
        resume: {
          stage: progressRow?.stage ?? 0,
          videos: (progressRow?.videoPositions ?? {}) as Record<string, number>,
        },
      },
      units: outline.units,
    };
  }

  /** Saves where the student is in a lesson (step and video position), so they can pick up again. */
  async saveResume(
    student: SessionUser,
    lessonId: string,
    input: { stage?: number; video?: { id: string; sec: number } },
  ): Promise<{ ok: true }> {
    await this.gate(student, lessonId);
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: student.id, lessonId } },
      select: { videoPositions: true },
    });
    const positions = { ...((existing?.videoPositions ?? {}) as Record<string, number>) };
    if (input.video) positions[input.video.id] = Math.max(0, Math.round(input.video.sec));
    const now = new Date();
    await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: student.id, lessonId } },
      create: {
        studentId: student.id,
        lessonId,
        lastOpenedAt: now,
        stage: input.stage ?? 0,
        videoPositions: positions,
      },
      update: {
        ...(input.stage === undefined ? {} : { stage: input.stage }),
        ...(input.video ? { videoPositions: positions } : {}),
      },
    });
    return { ok: true };
  }

  /** Remembers where the student is, so "Continue learning" comes back here (FR-LEARN-005). */
  async open(student: SessionUser, lessonId: string): Promise<{ ok: true }> {
    const { enrolment } = await this.gate(student, lessonId);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.lessonProgress.upsert({
        where: { studentId_lessonId: { studentId: student.id, lessonId } },
        create: { studentId: student.id, lessonId, lastOpenedAt: now },
        update: { lastOpenedAt: now },
      }),
      this.prisma.enrolment.update({
        where: { id: enrolment.id },
        data: { lastLessonId: lessonId, lastOpenedAt: now },
      }),
    ]);
    return { ok: true };
  }

  async complete(student: SessionUser, lessonId: string) {
    const { enrolment, courseId } = await this.gate(student, lessonId);
    if (enrolment.status !== 'ACTIVE') {
      throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT);
    }
    const quiz = await this.prisma.quiz.findFirst({
      where: { lessonId, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (quiz) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'Pass the quiz to complete this lesson.',
      });
    }
    const now = new Date();
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: student.id, lessonId } },
      select: { completedAt: true },
    });
    // Tapping twice keeps the first completion time.
    await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: student.id, lessonId } },
      create: { studentId: student.id, lessonId, completedAt: now, lastOpenedAt: now },
      update: existing?.completedAt ? {} : { completedAt: now },
    });
    const result = await this.progress.recalcEnrolment(enrolment.id);
    const live = await this.progress.liveLessons(courseId);
    const index = live.findIndex((l) => l.id === lessonId);
    return {
      progressPct: result.progressPct,
      courseCompleted: result.completed,
      nextId: index >= 0 && index < live.length - 1 ? live[index + 1]!.id : null,
    };
  }

  /** "Report a problem" lands in Admin › Messages with a link to the lesson (FR-LEARN-012). */
  async report(student: SessionUser, lessonId: string, message: string): Promise<{ ok: true }> {
    await this.gate(student, lessonId);
    await this.limiter.assert(`report-problem:${student.id}`, 10, 3600);
    await this.prisma.inboxMessage.create({
      data: {
        type: 'PROBLEM_REPORT',
        name: student.fullName,
        phone: student.phone,
        message,
        userId: student.id,
        lessonId,
      },
    });
    return { ok: true };
  }

  // ── Access gate ───────────────────────────────────────────────────────

  /**
   * The one check every lesson action runs: the lesson must be live, and the student's enrolment must
   * open its course. A refusal carries the reason and the course, so the screen can say what to do.
   */
  private async gate(student: SessionUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        courseId: true,
        status: true,
        unit: { select: { status: true } },
        course: { select: { slug: true, title: true, status: true, access: true } },
      },
    });
    const live =
      lesson &&
      lesson.status === 'PUBLISHED' &&
      lesson.unit.status === 'PUBLISHED' &&
      lesson.course.status === 'PUBLISHED';
    if (!lesson || !live) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);

    const grant = await this.access.studentCourseAccess(student.id, lesson.courseId);
    if (!grant.allowed) {
      throw courseDenial(grant.reason, lesson.course, lesson.courseId, grant.enrolment);
    }
    const lockedBy = await this.access.lessonLockedBy(student.id, lesson.courseId, lessonId);
    if (lockedBy) {
      throw new AppException('COURSE_ACCESS_DENIED', HttpStatus.FORBIDDEN, {
        params: {
          reason: 'LESSON_LOCKED',
          courseSlug: lesson.course.slug,
          lockedById: lockedBy.id,
          lockedByTitle: lockedBy.title,
        },
      });
    }
    return { courseId: lesson.courseId, course: lesson.course, enrolment: grant.enrolment };
  }
}
