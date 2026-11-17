import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgressService } from '../enrolments/progress.service';
import { num } from './quiz-builder.service';
import { gradeQuestion, scoreAttempt, type SnapshotQuestion } from './quiz-grading';

/**
 * Closes attempts and marks them. One place, so a submit by the student, a time-out by the job and a
 * teacher's last mark all end the same way (FR-QUIZ-007…009).
 */
@Injectable()
export class AttemptGrader {
  private readonly logger = new Logger('Quizzes');

  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  /**
   * Submits an attempt that is still in progress: marks what can be marked by machine and leaves
   * short answers for the teacher. Safe to call twice; only the first call does anything.
   */
  async submit(attemptId: string): Promise<void> {
    const claimed = await this.prisma.quizAttempt.updateMany({
      where: { id: attemptId, status: 'IN_PROGRESS' },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    if (claimed.count !== 1) return;

    const attempt = await this.prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        questionsSnapshot: true,
        answers: { select: { questionId: true, response: true } },
      },
    });
    const questions = attempt.questionsSnapshot as unknown as SnapshotQuestion[];
    const saved = new Map(attempt.answers.map((a) => [a.questionId, a.response]));

    await this.prisma.$transaction(
      questions.map((q) => {
        const graded = gradeQuestion(q, saved.get(q.id));
        return this.prisma.answer.upsert({
          where: { attemptId_questionId: { attemptId, questionId: q.id } },
          create: {
            attemptId,
            questionId: q.id,
            isCorrect: graded.isCorrect,
            marksAwarded: graded.marks,
          },
          update: { isCorrect: graded.isCorrect, marksAwarded: graded.marks },
        });
      }),
    );
    await this.settle(attemptId);
  }

  /**
   * Works out where an attempt stands: waiting for a teacher while any short answer is unmarked,
   * otherwise graded with a score. A pass moves the lesson and the course forward (FR-LEARN-003).
   * Also used after a teacher changes a mark.
   */
  async settle(attemptId: string): Promise<void> {
    const attempt = await this.prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        id: true,
        studentId: true,
        enrolmentId: true,
        status: true,
        passed: true,
        questionsSnapshot: true,
        quiz: { select: { lessonId: true, passMarkPct: true } },
        answers: { select: { questionId: true, marksAwarded: true } },
      },
    });
    if (attempt.status === 'IN_PROGRESS') return;

    const questions = attempt.questionsSnapshot as unknown as SnapshotQuestion[];
    const marks = new Map(
      attempt.answers.map((a) => [
        a.questionId,
        a.marksAwarded === null ? null : num(a.marksAwarded),
      ]),
    );
    const pending = questions.some((q) => (marks.get(q.id) ?? null) === null);
    if (pending) {
      await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: { status: 'WAITING_FOR_MARKING' },
      });
      return;
    }

    const result = scoreAttempt(
      questions.map((q) => ({ max: q.marks, marks: marks.get(q.id) ?? 0 })),
      attempt.quiz.passMarkPct,
    );
    await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'GRADED',
        gradedAt: new Date(),
        score: new Prisma.Decimal(result.score),
        maxScore: new Prisma.Decimal(result.maxScore),
        scorePct: result.scorePct,
        passed: result.passed,
      },
    });
    if (result.passed) await this.onPassed(attempt);
  }

  /** Passing a quiz completes its lesson; that may complete the course (and print the certificate). */
  private async onPassed(attempt: {
    studentId: string;
    enrolmentId: string;
    quiz: { lessonId: string };
  }): Promise<void> {
    const now = new Date();
    const key = { studentId: attempt.studentId, lessonId: attempt.quiz.lessonId };
    await this.prisma.lessonProgress.upsert({
      where: { studentId_lessonId: key },
      create: { ...key, completedAt: now, lastOpenedAt: now },
      update: {},
    });
    // A lesson that was already complete keeps its first completion time.
    await this.prisma.lessonProgress.updateMany({
      where: { ...key, completedAt: null },
      data: { completedAt: now },
    });
    await this.progress.recalcEnrolment(attempt.enrolmentId);
  }

  /** Attempts whose time ran out are submitted with whatever was saved (FR-QUIZ-007). */
  async submitDue(
    now = new Date(),
    filter: { studentId?: string; quizId?: string } = {},
  ): Promise<number> {
    const due = await this.prisma.quizAttempt.findMany({
      where: { status: 'IN_PROGRESS', deadlineAt: { lt: now }, ...filter },
      select: { id: true },
      take: 500,
    });
    let count = 0;
    for (const { id } of due) {
      try {
        await this.submit(id);
        count++;
      } catch (error) {
        this.logger.error({ err: error, attemptId: id }, 'Could not submit a timed-out attempt');
      }
    }
    return count;
  }
}
