import { HttpStatus, Injectable } from '@nestjs/common';
import type { QuestionInput, QuizSettingsInput } from '@natik/shared';
import { AccessPolicy } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { createId } from '../../common/security/ids';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';
import { ProgressService } from '../enrolments/progress.service';
import {
  normalizeAnswer,
  type QuestionKind,
  type SnapshotQuestion,
  toStudentQuestion,
} from './quiz-grading';

/** Final quizzes are stricter by default: a higher pass mark and two tries (FR-QUIZ-003). */
export const QUIZ_DEFAULTS = {
  final: { passMarkPct: 70, maxAttempts: 2 as number | null },
  lesson: { passMarkPct: 60, maxAttempts: null as number | null },
};

export const num = (value: Prisma.Decimal | number | string): number => Number(value);

const questionRow = {
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
type QuestionRow = Prisma.QuestionGetPayload<{ select: typeof questionRow }>;

type Option = { id: string; text: string };
const asOptions = (value: unknown): Option[] | null =>
  Array.isArray(value) ? (value as Option[]) : null;

/** A stored question in the shape the marking code uses. */
export function toSnapshot(q: QuestionRow): SnapshotQuestion {
  return {
    id: q.id,
    position: q.position,
    type: q.type as QuestionKind,
    text: q.text,
    mediaFileId: q.mediaFileId,
    options: asOptions(q.options),
    correct: q.correct,
    marks: num(q.marks),
    explanation: q.explanation,
  };
}

/** A question as the teacher edits it: everything, including the answer. */
function teacherQuestion(q: QuestionRow) {
  const options = asOptions(q.options);
  return {
    id: q.id,
    position: q.position,
    type: q.type,
    text: q.text,
    marks: num(q.marks),
    explanation: q.explanation ?? '',
    mediaUrl: q.mediaFileId ? `/api/v1/files/${q.mediaFileId}` : null,
    mediaFileId: q.mediaFileId,
    ...(q.type === 'MULTIPLE_CHOICE' && options
      ? {
          options: options.map((o) => ({ id: o.id, text: o.text })),
          correctIndex: Math.max(
            0,
            options.findIndex((o) => o.id === q.correct),
          ),
        }
      : {}),
    ...(q.type === 'TRUE_FALSE' ? { correctValue: q.correct === true } : {}),
    ...(q.type === 'FILL_BLANK'
      ? { acceptedAnswers: Array.isArray(q.correct) ? (q.correct as string[]) : [] }
      : {}),
    ...(q.type === 'SHORT_ANSWER'
      ? { modelAnswer: typeof q.correct === 'string' ? q.correct : '' }
      : {}),
  };
}

/** Turns what the teacher typed into what is stored (options get ids, the answer is kept private). */
function toStored(input: QuestionInput) {
  const base = {
    type: input.type,
    text: input.text,
    marks: input.marks,
    explanation: input.explanation || null,
    mediaFileId: input.mediaFileId ?? null,
  };
  switch (input.type) {
    case 'MULTIPLE_CHOICE': {
      if (input.correctIndex >= input.options.length) {
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
          fields: { correctIndex: ['Choose the correct option.'] },
        });
      }
      const options = input.options.map((o) => ({ id: createId(), text: o.text }));
      return { ...base, options, correct: options[input.correctIndex]!.id };
    }
    case 'TRUE_FALSE':
      return { ...base, options: Prisma.JsonNull, correct: input.correctValue };
    case 'FILL_BLANK': {
      // Two accepted answers that normalise the same are one answer.
      const seen = new Set<string>();
      const answers = input.acceptedAnswers.filter((a) => {
        const key = normalizeAnswer(a);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { ...base, options: Prisma.JsonNull, correct: answers };
    }
    case 'SHORT_ANSWER':
      return { ...base, options: Prisma.JsonNull, correct: input.modelAnswer ?? '' };
  }
}

/**
 * The teacher's side of quizzes (FR-QUIZ-001…004, FR-TEACH-005): create, set up, add questions,
 * preview and publish. Admins can do everything teachers can (FR-ADMIN-005).
 */
@Injectable()
export class QuizBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    private readonly audit: AuditService,
    private readonly progress: ProgressService,
  ) {}

  private async mustFind(id: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { position: 'asc' }, select: questionRow },
        lesson: { select: { id: true, title: true, status: true } },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            language: { select: { code: true, direction: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });
    if (!quiz) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return quiz;
  }

  /** Loads a quiz for someone who may edit its course; everyone else gets 403 or 404 (BR-ROLE). */
  private async editable(actor: SessionUser, id: string) {
    const quiz = await this.mustFind(id);
    await this.access.assertCanEditCourseContent(actor, quiz.courseId);
    return quiz;
  }

  private async assertOneFinal(courseId: string, exceptQuizId?: string) {
    const other = await this.prisma.quiz.findFirst({
      where: { courseId, isFinal: true, ...(exceptQuizId ? { id: { not: exceptQuizId } } : {}) },
      select: { title: true },
    });
    if (other) {
      throw new AppException('CONFLICT', HttpStatus.CONFLICT, {
        message: `This course already has a final quiz ("${other.title}"). A course can have only one.`,
      });
    }
  }

  async createForLesson(actor: SessionUser, lessonId: string, title: string, isFinal = false) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, quiz: { select: { id: true } } },
    });
    if (!lesson) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
    if (lesson.quiz) {
      throw new AppException('CONFLICT', HttpStatus.CONFLICT, {
        message: 'This lesson already has a quiz.',
      });
    }
    if (isFinal) await this.assertOneFinal(lesson.courseId);
    const defaults = isFinal ? QUIZ_DEFAULTS.final : QUIZ_DEFAULTS.lesson;
    try {
      const quiz = await this.prisma.quiz.create({
        data: {
          lessonId,
          courseId: lesson.courseId,
          title,
          isFinal,
          passMarkPct: defaults.passMarkPct,
          maxAttempts: defaults.maxAttempts,
        },
        select: { id: true },
      });
      await this.audit.record({
        actorId: actor.id,
        action: 'QUIZ_CREATED',
        entityType: 'Quiz',
        entityId: quiz.id,
        details: { lessonId, isFinal },
      });
      return { id: quiz.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException('CONFLICT', HttpStatus.CONFLICT, {
          message: 'This lesson or course already has that quiz.',
        });
      }
      throw error;
    }
  }

  async get(actor: SessionUser, id: string) {
    const quiz = await this.editable(actor, id);
    return {
      id: quiz.id,
      title: quiz.title,
      instructions: quiz.instructions ?? '',
      isFinal: quiz.isFinal,
      passMarkPct: quiz.passMarkPct,
      maxAttempts: quiz.maxAttempts,
      timeLimitMinutes: quiz.timeLimitSec ? Math.round(quiz.timeLimitSec / 60) : null,
      showAnswers: quiz.showAnswers,
      status: quiz.status,
      attemptCount: quiz._count.attempts,
      totalMarks: quiz.questions.reduce((sum, q) => sum + num(q.marks), 0),
      lesson: quiz.lesson,
      course: {
        id: quiz.course.id,
        title: quiz.course.title,
        slug: quiz.course.slug,
        lang: quiz.course.language.code,
        dir: quiz.course.language.direction === 'RTL' ? 'rtl' : 'ltr',
      },
      questions: quiz.questions.map(teacherQuestion),
    };
  }

  async updateSettings(actor: SessionUser, id: string, input: QuizSettingsInput) {
    const quiz = await this.editable(actor, id);
    if (input.isFinal && !quiz.isFinal) await this.assertOneFinal(quiz.courseId, id);
    await this.prisma.quiz.update({
      where: { id },
      data: {
        title: input.title,
        instructions: input.instructions || null,
        isFinal: input.isFinal,
        passMarkPct: input.passMarkPct,
        maxAttempts: input.maxAttempts,
        timeLimitSec: input.timeLimitMinutes ? input.timeLimitMinutes * 60 : null,
        showAnswers: input.showAnswers,
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'QUIZ_UPDATED',
      entityType: 'Quiz',
      entityId: id,
    });
    // Making or un-making the final quiz changes who has finished the course.
    if (input.isFinal !== quiz.isFinal) await this.progress.completeReady(quiz.courseId);
    return this.get(actor, id);
  }

  async publish(actor: SessionUser, id: string) {
    const quiz = await this.editable(actor, id);
    if (quiz.questions.length === 0) {
      throw new AppException('QUIZ_NOT_READY', HttpStatus.UNPROCESSABLE_ENTITY, {
        message: 'Add at least one question before publishing.',
      });
    }
    await this.prisma.quiz.update({ where: { id }, data: { status: 'PUBLISHED' } });
    await this.audit.record({
      actorId: actor.id,
      action: 'QUIZ_PUBLISHED',
      entityType: 'Quiz',
      entityId: id,
    });
    return this.get(actor, id);
  }

  async hide(actor: SessionUser, id: string) {
    const quiz = await this.editable(actor, id);
    await this.prisma.quiz.update({ where: { id }, data: { status: 'HIDDEN' } });
    await this.audit.record({
      actorId: actor.id,
      action: 'QUIZ_HIDDEN',
      entityType: 'Quiz',
      entityId: id,
    });
    // A hidden final quiz no longer blocks completion; a hidden lesson quiz no longer blocks "complete".
    await this.progress.completeReady(quiz.courseId);
    return this.get(actor, id);
  }

  /** A quiz students have taken can only be hidden, so their results are kept (FR-ENR-009). */
  async remove(actor: SessionUser, id: string): Promise<void> {
    const quiz = await this.editable(actor, id);
    if (quiz._count.attempts > 0) {
      throw new AppException('CANNOT_DELETE_PUBLISHED', HttpStatus.CONFLICT);
    }
    await this.prisma.$transaction([
      this.prisma.question.deleteMany({ where: { quizId: id } }),
      this.prisma.attemptGrant.deleteMany({ where: { quizId: id } }),
      this.prisma.quiz.delete({ where: { id } }),
    ]);
    await this.audit.record({
      actorId: actor.id,
      action: 'QUIZ_DELETED',
      entityType: 'Quiz',
      entityId: id,
    });
    await this.progress.completeReady(quiz.courseId);
  }

  // ── Questions ─────────────────────────────────────────────────────────

  async addQuestion(actor: SessionUser, quizId: string, input: QuestionInput) {
    const quiz = await this.editable(actor, quizId);
    const last = quiz.questions.at(-1)?.position ?? 0;
    const stored = toStored(input);
    const created = await this.prisma.question.create({
      data: { quizId, position: last + 1, ...stored },
      select: questionRow,
    });
    return teacherQuestion(created);
  }

  async updateQuestion(
    actor: SessionUser,
    quizId: string,
    questionId: string,
    input: QuestionInput,
  ) {
    await this.editable(actor, quizId);
    const existing = await this.prisma.question.findFirst({
      where: { id: questionId, quizId },
      select: { id: true },
    });
    if (!existing) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data: toStored(input),
      select: questionRow,
    });
    return teacherQuestion(updated);
  }

  async removeQuestion(actor: SessionUser, quizId: string, questionId: string): Promise<void> {
    await this.editable(actor, quizId);
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, quizId },
      select: { id: true, _count: { select: { answers: true } } },
    });
    if (!question) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    // Students' answers point at the question, so one that has been answered can't be removed.
    if (question._count.answers > 0) throw new AppException('IN_USE', HttpStatus.CONFLICT);
    await this.prisma.question.delete({ where: { id: questionId } });
    await this.reposition(quizId);
  }

  async reorderQuestions(actor: SessionUser, quizId: string, ids: string[]) {
    const quiz = await this.editable(actor, quizId);
    const known = new Set(quiz.questions.map((q) => q.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => known.has(id))
    ) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'The list changed while you were editing. Refresh and try again.',
      });
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.question.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return this.get(actor, quizId);
  }

  private async reposition(quizId: string) {
    const rest = await this.prisma.question.findMany({
      where: { quizId },
      orderBy: { position: 'asc' },
      select: { id: true },
    });
    await this.prisma.$transaction(
      rest.map((q, index) =>
        this.prisma.question.update({ where: { id: q.id }, data: { position: index + 1 } }),
      ),
    );
  }

  /** The quiz exactly as a student would get it. Nothing is saved (FR-QUIZ-004). */
  async preview(actor: SessionUser, id: string) {
    const quiz = await this.editable(actor, id);
    const questions = quiz.questions.map((q) => toStudentQuestion(toSnapshot(q)));
    return {
      quiz: {
        id: quiz.id,
        title: quiz.title,
        instructions: quiz.instructions,
        isFinal: quiz.isFinal,
        passMarkPct: quiz.passMarkPct,
        maxAttempts: quiz.maxAttempts,
        timeLimitMinutes: quiz.timeLimitSec ? Math.round(quiz.timeLimitSec / 60) : null,
        questionCount: questions.length,
        totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
      },
      course: {
        slug: quiz.course.slug,
        title: quiz.course.title,
        dir: quiz.course.language.direction === 'RTL' ? 'rtl' : 'ltr',
        lang: quiz.course.language.code,
      },
      lesson: { id: quiz.lesson.id, title: quiz.lesson.title },
      questions,
    };
  }
}
