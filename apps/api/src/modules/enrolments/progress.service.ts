import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../../jobs/queues';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrolmentMachine } from './enrolment-machine';
import { progressPercent } from './enrolment-rules';

/** A lesson counts only when it and its unit are published (students never see anything else). */
const LIVE_LESSON = { status: 'PUBLISHED', unit: { status: 'PUBLISHED' } } as const;

/** Progress = completed published lessons ÷ published lessons, rounded down (FR-LEARN-004). */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machine: EnrolmentMachine,
    @InjectQueue(QUEUES.CERTIFICATE) private readonly certificateQueue: Queue,
  ) {}

  /** Published lessons in reading order: unit position, then lesson position. */
  async liveLessons(courseId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId, ...LIVE_LESSON },
      select: {
        id: true,
        title: true,
        unitId: true,
        position: true,
        unit: { select: { position: true } },
      },
    });
    return lessons.sort((a, b) => a.unit.position - b.unit.position || a.position - b.position);
  }

  /**
   * A published final quiz must be passed before the course is complete, whatever order the student
   * does things in (FR-QUIZ, D6). Courses without one complete when every lesson is done.
   */
  private async finalQuizStillToPass(courseId: string, studentId: string): Promise<boolean> {
    const quiz = await this.prisma.quiz.findFirst({
      where: { courseId, isFinal: true, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (!quiz) return false;
    const passed = await this.prisma.quizAttempt.findFirst({
      where: { quizId: quiz.id, studentId, passed: true },
      select: { id: true },
    });
    return passed === null;
  }

  /** Recalculates one enrolment and completes it when everything is done. */
  async recalcEnrolment(enrolmentId: string): Promise<{ progressPct: number; completed: boolean }> {
    const enrolment = await this.prisma.enrolment.findUnique({
      where: { id: enrolmentId },
      select: { id: true, studentId: true, courseId: true, status: true, endAt: true },
    });
    if (!enrolment) return { progressPct: 0, completed: false };

    const live = await this.liveLessons(enrolment.courseId);
    const done =
      live.length === 0
        ? 0
        : await this.prisma.lessonProgress.count({
            where: {
              studentId: enrolment.studentId,
              lessonId: { in: live.map((l) => l.id) },
              completedAt: { not: null },
            },
          });
    const progressPct = progressPercent(done, live.length);
    await this.prisma.enrolment.update({ where: { id: enrolment.id }, data: { progressPct } });

    let completed = enrolment.status === 'COMPLETED';
    const stillOpen = !enrolment.endAt || enrolment.endAt >= new Date();
    if (
      progressPct === 100 &&
      enrolment.status === 'ACTIVE' &&
      stillOpen &&
      !(await this.finalQuizStillToPass(enrolment.courseId, enrolment.studentId))
    ) {
      try {
        const entry = await this.prisma.$transaction((tx) =>
          this.machine.move(tx, {
            enrolmentId: enrolment.id,
            from: 'ACTIVE',
            to: 'COMPLETED',
            data: { completedAt: new Date() },
          }),
        );
        await this.machine.record([entry]);
        completed = true;
        // The certificate request opens; the student confirms the name, an admin approves (FR-CERT-001).
        await this.certificateQueue
          .add('request', { enrolmentId: enrolment.id }, { jobId: `cert-request-${enrolment.id}` })
          .catch(() => undefined);
      } catch {
        // Changed at the same moment by someone else; the next recalculation sorts it out.
      }
    }
    return { progressPct, completed };
  }

  /**
   * After a quiz is made final, hidden or removed: students who already did every lesson may now be
   * done (or no longer done). Re-checks each of them.
   */
  async completeReady(courseId: string): Promise<void> {
    const ready = await this.prisma.enrolment.findMany({
      where: { courseId, status: 'ACTIVE', progressPct: 100 },
      select: { id: true },
    });
    for (const { id } of ready) await this.recalcEnrolment(id);
  }

  /** After a lesson is published, hidden or deleted: every student of the course gets the new number. */
  async recalcCourse(courseId: string): Promise<number> {
    const live = await this.liveLessons(courseId);
    const liveIds = live.map((l) => l.id);
    const enrolments = await this.prisma.enrolment.findMany({
      where: { courseId, status: { in: ['ACTIVE', 'COMPLETED', 'EXPIRED'] } },
      select: { id: true, studentId: true, progressPct: true },
    });
    if (enrolments.length === 0) return 0;

    const counts = liveIds.length
      ? await this.prisma.lessonProgress.groupBy({
          by: ['studentId'],
          where: { lessonId: { in: liveIds }, completedAt: { not: null } },
          _count: { _all: true },
        })
      : [];
    const doneBy = new Map(counts.map((c) => [c.studentId, c._count._all]));
    let changed = 0;
    for (const enrolment of enrolments) {
      const pct = progressPercent(doneBy.get(enrolment.studentId) ?? 0, live.length);
      if (pct !== enrolment.progressPct) {
        await this.prisma.enrolment.update({
          where: { id: enrolment.id },
          data: { progressPct: pct },
        });
        changed++;
      }
    }
    return changed;
  }

  /**
   * Where "Continue learning" goes: the last lesson opened if it is still live, otherwise the first
   * lesson not yet completed, otherwise the first lesson (FR-LEARN-005).
   */
  async continueLessonId(enrolment: {
    studentId: string;
    courseId: string;
    lastLessonId: string | null;
  }): Promise<string | null> {
    const live = await this.liveLessons(enrolment.courseId);
    if (live.length === 0) return null;
    if (enrolment.lastLessonId && live.some((l) => l.id === enrolment.lastLessonId)) {
      return enrolment.lastLessonId;
    }
    const done = await this.prisma.lessonProgress.findMany({
      where: {
        studentId: enrolment.studentId,
        lessonId: { in: live.map((l) => l.id) },
        completedAt: { not: null },
      },
      select: { lessonId: true },
    });
    const doneIds = new Set(done.map((d) => d.lessonId));
    return (live.find((l) => !doneIds.has(l.id)) ?? live[0]!).id;
  }
}
