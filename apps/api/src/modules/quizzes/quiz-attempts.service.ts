import { HttpStatus, Injectable } from '@nestjs/common';
import { AccessPolicy } from '../../common/access/access-policy';
import { courseDenial } from '../../common/access/course-denial';
import { AppException } from '../../common/errors/app.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';
import { ProgressService } from '../enrolments/progress.service';
import { AttemptGrader } from './attempt-grader.service';
import { num, toSnapshot } from './quiz-builder.service';
import { isValidResponse, type SnapshotQuestion, toStudentQuestion } from './quiz-grading';

const questionSelect = {
  id: true,
  position: true,
  type: true,
  text: true,
  mediaFileId: true,
  options: true,
  correct: true,
  marks: true,
  explanation: true,
} satisfies Prisma.QuestionSelect;

const isUnique = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/**
 * A student taking quizzes (FR-QUIZ-005…011). Every call checks the enrolment first, the questions
 * a student gets never contain the answers, and the clock is the server's.
 */
@Injectable()
export class QuizAttemptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    private readonly progress: ProgressService,
    private readonly grader: AttemptGrader,
  ) {}

  /** The quiz must be live and the student's enrolment must open its course. */
  private async gate(student: SessionUser, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { position: 'asc' }, select: questionSelect },
        lesson: {
          select: { id: true, title: true, status: true, unit: { select: { status: true } } },
        },
        course: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            access: true,
            language: { select: { code: true, direction: true } },
          },
        },
      },
    });
    const live =
      quiz &&
      quiz.status === 'PUBLISHED' &&
      quiz.lesson.status === 'PUBLISHED' &&
      quiz.lesson.unit.status === 'PUBLISHED' &&
      quiz.course.status === 'PUBLISHED';
    if (!quiz || !live) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);

    const grant = await this.access.studentCourseAccess(student.id, quiz.courseId);
    if (!grant.allowed)
      throw courseDenial(grant.reason, quiz.course, quiz.courseId, grant.enrolment);
    if (await this.access.lessonLockedBy(student.id, quiz.courseId, quiz.lessonId)) {
      throw new AppException('COURSE_ACCESS_DENIED', HttpStatus.FORBIDDEN, {
        params: { reason: 'LESSON_LOCKED', courseSlug: quiz.course.slug },
      });
    }
    return { quiz, enrolment: grant.enrolment };
  }

  /** The student's own attempt. Anyone else's looks like it doesn't exist (BR-ROLE-003). */
  private async ownAttempt(student: SessionUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, studentId: student.id },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            lessonId: true,
            courseId: true,
            isFinal: true,
            passMarkPct: true,
            showAnswers: true,
            maxAttempts: true,
            course: {
              select: {
                slug: true,
                title: true,
                access: true,
                language: { select: { code: true, direction: true } },
              },
            },
            lesson: { select: { id: true, title: true } },
          },
        },
      },
    });
    if (!attempt) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return attempt;
  }

  /** Marks attempts that ran out of time, so every read sees the true state (FR-QUIZ-007). */
  private closeExpired(studentId: string, quizId?: string) {
    return this.grader.submitDue(new Date(), { studentId, ...(quizId ? { quizId } : {}) });
  }

  private async attemptsLeft(quiz: { id: string; maxAttempts: number | null }, studentId: string) {
    const [used, extra] = await Promise.all([
      this.prisma.quizAttempt.count({ where: { quizId: quiz.id, studentId } }),
      this.prisma.attemptGrant.aggregate({
        where: { quizId: quiz.id, studentId },
        _sum: { extraAttempts: true },
      }),
    ]);
    const allowed =
      quiz.maxAttempts === null ? null : quiz.maxAttempts + (extra._sum.extraAttempts ?? 0);
    return { used, allowed, left: allowed === null ? null : Math.max(0, allowed - used) };
  }

  private meta(quiz: {
    id: string;
    title: string;
    instructions: string | null;
    isFinal: boolean;
    passMarkPct: number;
    timeLimitSec: number | null;
    questions: { marks: Prisma.Decimal }[];
  }) {
    return {
      id: quiz.id,
      title: quiz.title,
      instructions: quiz.instructions,
      isFinal: quiz.isFinal,
      passMarkPct: quiz.passMarkPct,
      timeLimitMinutes: quiz.timeLimitSec ? Math.round(quiz.timeLimitSec / 60) : null,
      questionCount: quiz.questions.length,
      totalMarks: quiz.questions.reduce((sum, q) => sum + num(q.marks), 0),
    };
  }

  // ── Intro and history ─────────────────────────────────────────────────

  async intro(student: SessionUser, quizId: string) {
    const { quiz, enrolment } = await this.gate(student, quizId);
    await this.closeExpired(student.id, quizId);
    const [attempts, counts] = await Promise.all([
      this.prisma.quizAttempt.findMany({
        where: { quizId, studentId: student.id },
        orderBy: { number: 'desc' },
        select: { id: true, number: true, status: true, scorePct: true, passed: true },
      }),
      this.attemptsLeft(quiz, student.id),
    ]);
    const inProgress = attempts.find((a) => a.status === 'IN_PROGRESS') ?? null;
    const graded = attempts.filter((a) => a.scorePct !== null);
    return {
      quiz: { ...this.meta(quiz), maxAttempts: quiz.maxAttempts },
      course: {
        slug: quiz.course.slug,
        title: quiz.course.title,
        dir: quiz.course.language.direction === 'RTL' ? ('rtl' as const) : ('ltr' as const),
      },
      lesson: { id: quiz.lesson.id, title: quiz.lesson.title },
      attemptsUsed: counts.used,
      attemptsLeft: counts.left,
      inProgressId: inProgress?.id ?? null,
      passed: attempts.some((a) => a.passed === true),
      bestScorePct: graded.length ? Math.max(...graded.map((a) => a.scorePct!)) : null,
      latestAttemptId: attempts[0]?.id ?? null,
      // A finished course is read-only (FR-LEARN-005); an unfinished one needs a try left or one to resume.
      canStart:
        enrolment.status === 'ACTIVE' &&
        (inProgress !== null || counts.left === null || counts.left > 0),
    };
  }

  async history(student: SessionUser, quizId: string) {
    const { quiz } = await this.gate(student, quizId);
    await this.closeExpired(student.id, quizId);
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { quizId, studentId: student.id },
      orderBy: { number: 'desc' },
      select: {
        id: true,
        number: true,
        status: true,
        scorePct: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
      },
    });
    return {
      quiz: { id: quiz.id, title: quiz.title, passMarkPct: quiz.passMarkPct },
      course: { slug: quiz.course.slug, title: quiz.course.title },
      items: attempts,
    };
  }

  // ── Taking ────────────────────────────────────────────────────────────

  /** Starts an attempt, or returns the one already in progress. Answers and questions are frozen (FR-TEACH-008). */
  async start(student: SessionUser, quizId: string) {
    const { quiz, enrolment } = await this.gate(student, quizId);
    if (enrolment.status !== 'ACTIVE') {
      throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT);
    }
    await this.closeExpired(student.id, quizId);

    const existing = await this.prisma.quizAttempt.findFirst({
      where: { quizId, studentId: student.id, status: 'IN_PROGRESS' },
      select: { id: true },
    });
    if (existing) return { attemptId: existing.id, resumed: true };

    if (quiz.questions.length === 0) throw new AppException('QUIZ_NOT_READY', HttpStatus.CONFLICT);
    const { left } = await this.attemptsLeft(quiz, student.id);
    if (left !== null && left <= 0)
      throw new AppException('NO_ATTEMPTS_LEFT', HttpStatus.FORBIDDEN);

    const snapshot = quiz.questions.map(toSnapshot);
    const now = new Date();
    try {
      const last = await this.prisma.quizAttempt.aggregate({
        where: { quizId, studentId: student.id },
        _max: { number: true },
      });
      const attempt = await this.prisma.quizAttempt.create({
        data: {
          quizId,
          studentId: student.id,
          enrolmentId: enrolment.id,
          number: (last._max.number ?? 0) + 1,
          startedAt: now,
          deadlineAt: quiz.timeLimitSec ? new Date(now.getTime() + quiz.timeLimitSec * 1000) : null,
          maxScore: new Prisma.Decimal(snapshot.reduce((sum, q) => sum + q.marks, 0)),
          questionsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      return { attemptId: attempt.id, resumed: false };
    } catch (error) {
      // Two taps at once: the second finds the first one's attempt.
      if (isUnique(error)) {
        const again = await this.prisma.quizAttempt.findFirst({
          where: { quizId, studentId: student.id, status: 'IN_PROGRESS' },
          select: { id: true },
        });
        if (again) return { attemptId: again.id, resumed: true };
      }
      throw error;
    }
  }

  /** The questions (without answers) and what the student has saved so far. */
  async get(student: SessionUser, attemptId: string) {
    await this.closeExpired(student.id);
    const attempt = await this.ownAttempt(student, attemptId);
    const base = {
      id: attempt.id,
      number: attempt.number,
      status: attempt.status,
      deadlineAt: attempt.deadlineAt,
      serverNow: new Date(),
    };
    if (attempt.status !== 'IN_PROGRESS') return { attempt: base, quizId: attempt.quizId };

    const questions = attempt.questionsSnapshot as unknown as SnapshotQuestion[];
    const saved = await this.prisma.answer.findMany({
      where: { attemptId },
      select: { questionId: true, response: true },
    });
    return {
      attempt: base,
      quiz: {
        id: attempt.quiz.id,
        title: attempt.quiz.title,
        isFinal: attempt.quiz.isFinal,
        lessonId: attempt.quiz.lessonId,
      },
      course: {
        slug: attempt.quiz.course.slug,
        title: attempt.quiz.course.title,
        lang: attempt.quiz.course.language.code,
        dir: attempt.quiz.course.language.direction === 'RTL' ? ('rtl' as const) : ('ltr' as const),
      },
      questions: questions.map(toStudentQuestion),
      answers: Object.fromEntries(
        saved.filter((a) => a.response !== null).map((a) => [a.questionId, a.response]),
      ),
    };
  }

  /** Saves one answer. Safe to repeat, so a retry after a dropped connection does no harm (FR-QUIZ-006). */
  async saveAnswer(
    student: SessionUser,
    attemptId: string,
    questionId: string,
    response: string | boolean,
  ): Promise<{ savedAt: Date }> {
    const attempt = await this.ownAttempt(student, attemptId);
    if (attempt.status !== 'IN_PROGRESS')
      throw new AppException('ATTEMPT_CLOSED', HttpStatus.CONFLICT);
    const now = new Date();
    if (attempt.deadlineAt && now > attempt.deadlineAt) {
      // Time is up: what was saved is submitted, and nothing more is accepted (FR-QUIZ-007).
      await this.grader.submit(attemptId);
      throw new AppException('QUIZ_TIME_UP', HttpStatus.CONFLICT);
    }
    const question = (attempt.questionsSnapshot as unknown as SnapshotQuestion[]).find(
      (q) => q.id === questionId,
    );
    if (!question) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (!isValidResponse(question, response)) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: { attemptId, questionId, response },
      update: { response },
    });
    return { savedAt: now };
  }

  /** Submits the attempt. Submitting again just returns the result (idempotent). */
  async submit(student: SessionUser, attemptId: string) {
    const attempt = await this.ownAttempt(student, attemptId);
    if (attempt.status === 'IN_PROGRESS') await this.grader.submit(attemptId);
    return this.result(student, attemptId);
  }

  // ── Results ───────────────────────────────────────────────────────────

  async result(student: SessionUser, attemptId: string) {
    await this.closeExpired(student.id);
    const attempt = await this.ownAttempt(student, attemptId);
    if (attempt.status === 'IN_PROGRESS') {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'This attempt has not been submitted yet.',
      });
    }
    const quiz = attempt.quiz;
    const graded = attempt.status === 'GRADED';
    const counts = await this.attemptsLeft(quiz, student.id);
    const questions = attempt.questionsSnapshot as unknown as SnapshotQuestion[];

    let review: unknown[] | null = null;
    if (graded) {
      const answers = await this.prisma.answer.findMany({ where: { attemptId } });
      const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
      review = questions.map((q) => {
        const answer = byQuestion.get(q.id);
        return {
          questionId: q.id,
          type: q.type,
          text: q.text,
          options: q.options,
          maxMarks: q.marks,
          response: answer?.response ?? null,
          marks:
            answer?.marksAwarded === null || answer?.marksAwarded === undefined
              ? null
              : num(answer.marksAwarded),
          teacherComment: answer?.teacherComment ?? null,
          // The right answers and explanations only when the teacher allowed it (FR-QUIZ-010).
          ...(quiz.showAnswers
            ? {
                isCorrect: answer?.isCorrect ?? null,
                correct: q.correct,
                explanation: q.explanation,
              }
            : {}),
        };
      });
    }

    const live = await this.progress.liveLessons(quiz.courseId);
    const index = live.findIndex((l) => l.id === quiz.lessonId);
    const enrolment = await this.prisma.enrolment.findUnique({
      where: { id: attempt.enrolmentId },
      select: { status: true },
    });
    return {
      attempt: {
        id: attempt.id,
        number: attempt.number,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
      },
      quiz: {
        id: quiz.id,
        title: quiz.title,
        isFinal: quiz.isFinal,
        passMarkPct: quiz.passMarkPct,
        showAnswers: quiz.showAnswers,
      },
      course: { slug: quiz.course.slug, title: quiz.course.title },
      lesson: { id: quiz.lesson.id, title: quiz.lesson.title },
      result: graded
        ? {
            score: num(attempt.score!),
            maxScore: num(attempt.maxScore),
            scorePct: attempt.scorePct!,
            passed: attempt.passed === true,
          }
        : null,
      attemptsLeft: counts.left,
      nextLessonId: index >= 0 && index < live.length - 1 ? live[index + 1]!.id : null,
      courseCompleted: enrolment?.status === 'COMPLETED',
      review,
    };
  }
}
