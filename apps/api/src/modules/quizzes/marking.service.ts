import { HttpStatus, Injectable } from '@nestjs/common';
import { AccessPolicy } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';
import { AttemptGrader } from './attempt-grader.service';
import { num } from './quiz-builder.service';
import type { SnapshotQuestion } from './quiz-grading';

/**
 * Teachers mark short written answers (FR-QUIZ-009) and can give a student one more try
 * (FR-QUIZ-012). A teacher only reaches answers from courses they are assigned to; admins reach all
 * (FR-ADMIN-005).
 */
@Injectable()
export class MarkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    private readonly audit: AuditService,
    private readonly grader: AttemptGrader,
  ) {}

  /** Answers still waiting for a mark, limited to this person's courses. */
  private waiting(actor: SessionUser, filter: { courseId?: string; quizId?: string } = {}) {
    const quizWhere: Prisma.QuizWhereInput = {
      ...(filter.courseId ? { courseId: filter.courseId } : {}),
      ...(actor.role === 'ADMIN'
        ? {}
        : { course: { teachers: { some: { teacherId: actor.id } } } }),
    };
    return {
      marksAwarded: null,
      question: { type: 'SHORT_ANSWER' },
      attempt: {
        status: 'WAITING_FOR_MARKING',
        ...(filter.quizId ? { quizId: filter.quizId } : {}),
        quiz: quizWhere,
      },
    } satisfies Prisma.AnswerWhereInput;
  }

  async count(actor: SessionUser): Promise<{ count: number }> {
    return { count: await this.prisma.answer.count({ where: this.waiting(actor) }) };
  }

  /** The answers to mark, oldest first, with what is needed to filter by course and quiz. */
  async queue(actor: SessionUser, filter: { courseId?: string; quizId?: string }) {
    const rows = await this.prisma.answer.findMany({
      where: this.waiting(actor),
      orderBy: { attempt: { submittedAt: 'asc' } },
      take: 300,
      select: {
        id: true,
        questionId: true,
        response: true,
        attempt: {
          select: {
            submittedAt: true,
            questionsSnapshot: true,
            student: { select: { fullName: true } },
            quiz: {
              select: {
                id: true,
                title: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                    language: { select: { code: true, direction: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    const all = rows.map((r) => {
      const question = (r.attempt.questionsSnapshot as unknown as SnapshotQuestion[]).find(
        (q) => q.id === r.questionId,
      );
      const quiz = r.attempt.quiz;
      return {
        answerId: r.id,
        studentName: r.attempt.student.fullName,
        submittedAt: r.attempt.submittedAt,
        quiz: { id: quiz.id, title: quiz.title },
        course: {
          id: quiz.course.id,
          title: quiz.course.title,
          lang: quiz.course.language.code,
          dir: quiz.course.language.direction === 'RTL' ? ('rtl' as const) : ('ltr' as const),
        },
        question: {
          text: question?.text ?? '',
          maxMarks: question?.marks ?? 1,
          modelAnswer:
            typeof question?.correct === 'string' && question.correct ? question.correct : null,
        },
        response: typeof r.response === 'string' ? r.response : '',
      };
    });

    const courses = new Map<string, string>();
    const quizzes = new Map<string, { title: string; courseId: string }>();
    for (const item of all) {
      courses.set(item.course.id, item.course.title);
      quizzes.set(item.quiz.id, { title: item.quiz.title, courseId: item.course.id });
    }
    const items = all.filter(
      (i) =>
        (!filter.courseId || i.course.id === filter.courseId) &&
        (!filter.quizId || i.quiz.id === filter.quizId),
    );
    return {
      total: all.length,
      items,
      courses: [...courses].map(([id, title]) => ({ id, title })),
      quizzes: [...quizzes].map(([id, q]) => ({ id, ...q })),
    };
  }

  /** Saves a mark. Marking again changes it and is logged with the old and new score (FR-REP-003). */
  async mark(actor: SessionUser, answerId: string, input: { marks: number; comment?: string }) {
    const answer = await this.prisma.answer.findUnique({
      where: { id: answerId },
      select: {
        id: true,
        attemptId: true,
        questionId: true,
        marksAwarded: true,
        attempt: {
          select: { status: true, questionsSnapshot: true, quiz: { select: { courseId: true } } },
        },
      },
    });
    if (!answer) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.access.assertCanEditCourseContent(actor, answer.attempt.quiz.courseId);

    const question = (answer.attempt.questionsSnapshot as unknown as SnapshotQuestion[]).find(
      (q) => q.id === answer.questionId,
    );
    if (!question || question.type !== 'SHORT_ANSWER') {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'Only written answers are marked by hand.',
      });
    }
    if (answer.attempt.status === 'IN_PROGRESS' || answer.attempt.status === 'SUBMITTED') {
      throw new AppException('ATTEMPT_CLOSED', HttpStatus.CONFLICT, {
        message: 'This attempt is not ready for marking yet.',
      });
    }
    if (input.marks > question.marks) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        fields: { marks: [`The score can't be more than ${question.marks}.`] },
      });
    }

    const previous = answer.marksAwarded === null ? null : num(answer.marksAwarded);
    await this.prisma.answer.update({
      where: { id: answerId },
      data: {
        marksAwarded: new Prisma.Decimal(input.marks),
        isCorrect: input.marks >= question.marks,
        teacherComment: input.comment || null,
        markedById: actor.id,
        markedAt: new Date(),
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: previous === null ? 'ANSWER_MARKED' : 'MARK_CHANGED',
      entityType: 'Answer',
      entityId: answerId,
      details: { from: previous, to: input.marks, attemptId: answer.attemptId },
    });
    // The last short answer marked completes the attempt; a changed mark recalculates the score.
    await this.grader.settle(answer.attemptId);
    return { ok: true as const };
  }

  /** One more try for a student on a quiz (FR-QUIZ-012). */
  async grant(actor: SessionUser, quizId: string, studentId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, courseId: true },
    });
    if (!quiz) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.access.assertCanEditCourseContent(actor, quiz.courseId);
    const enrolled = await this.prisma.enrolment.findFirst({
      where: { studentId, courseId: quiz.courseId, status: { not: 'CANCELLED' } },
      select: { id: true },
    });
    if (!enrolled) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const grant = await this.prisma.attemptGrant.create({
      data: { quizId, studentId, grantedById: actor.id, extraAttempts: 1 },
      select: { id: true },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'ATTEMPT_GRANTED',
      entityType: 'Quiz',
      entityId: quizId,
      details: { studentId },
    });
    return { id: grant.id };
  }

  /** The students of a course, for the teacher's "Students" list. */
  async courseStudents(actor: SessionUser, courseId: string) {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const rows = await this.prisma.enrolment.findMany({
      where: { courseId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: {
        status: true,
        progressPct: true,
        student: { select: { id: true, fullName: true, phone: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.student.id,
        fullName: r.student.fullName,
        phone: r.student.phone,
        status: r.status,
        progressPct: r.progressPct,
      })),
    };
  }

  /** A student's quiz attempts in one course, and the tries they have left. */
  async studentAttempts(actor: SessionUser, courseId: string, studentId: string) {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, enrolments: { some: { courseId } } },
      select: { id: true, fullName: true },
    });
    if (!student) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const quizzes = await this.prisma.quiz.findMany({
      where: { courseId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        isFinal: true,
        maxAttempts: true,
        passMarkPct: true,
        attempts: {
          where: { studentId },
          orderBy: { number: 'desc' },
          select: {
            id: true,
            number: true,
            status: true,
            scorePct: true,
            passed: true,
            submittedAt: true,
          },
        },
        grants: { where: { studentId }, select: { extraAttempts: true } },
      },
    });
    return {
      student,
      quizzes: quizzes.map((q) => {
        const extra = q.grants.reduce((sum, g) => sum + g.extraAttempts, 0);
        const allowed = q.maxAttempts === null ? null : q.maxAttempts + extra;
        return {
          id: q.id,
          title: q.title,
          isFinal: q.isFinal,
          passMarkPct: q.passMarkPct,
          attemptsLeft: allowed === null ? null : Math.max(0, allowed - q.attempts.length),
          attempts: q.attempts,
        };
      }),
    };
  }
}
