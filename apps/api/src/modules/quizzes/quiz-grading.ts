/**
 * Pure marking rules for quizzes (FR-QUIZ-008, FR-QUIZ-010). No database here, so every rule can be
 * tested on its own.
 */

export type QuestionKind = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER';

/** A question exactly as it was when the attempt started. Edits later never change it (FR-TEACH-008). */
export interface SnapshotQuestion {
  id: string;
  position: number;
  type: QuestionKind;
  text: string;
  mediaFileId: string | null;
  /** MULTIPLE_CHOICE only. */
  options: { id: string; text: string }[] | null;
  /** The right answer. MC: option id · TF: boolean · FILL: accepted answers · SHORT: model answer. */
  correct: unknown;
  marks: number;
  explanation: string | null;
}

/**
 * Makes two spellings of the same answer equal: Unicode form (NFC), spaces trimmed and collapsed,
 * and capital letters ignored. Arabic and Ethiopic letters are left as they are.
 */
export function normalizeAnswer(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');
}

export interface Graded {
  /** null = a teacher has to mark it. */
  isCorrect: boolean | null;
  /** null = not marked yet. */
  marks: number | null;
}

/** Whether a written answer has anything in it. A blank short answer needs no teacher. */
export function isBlank(response: unknown): boolean {
  return (
    response === null ||
    response === undefined ||
    (typeof response === 'string' && response.trim() === '')
  );
}

export function gradeQuestion(question: SnapshotQuestion, response: unknown): Graded {
  if (question.type === 'SHORT_ANSWER') {
    // Nothing written: zero, no need to bother the teacher.
    return isBlank(response) ? { isCorrect: false, marks: 0 } : { isCorrect: null, marks: null };
  }
  let correct = false;
  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      correct = typeof response === 'string' && response === question.correct;
      break;
    case 'TRUE_FALSE':
      correct = typeof response === 'boolean' && response === question.correct;
      break;
    case 'FILL_BLANK': {
      if (typeof response === 'string' && Array.isArray(question.correct)) {
        const given = normalizeAnswer(response);
        correct =
          given !== '' &&
          question.correct.some((a) => typeof a === 'string' && normalizeAnswer(a) === given);
      }
      break;
    }
  }
  return { isCorrect: correct, marks: correct ? question.marks : 0 };
}

/** Marks added up, the percentage, and whether the pass mark was reached. */
export function scoreAttempt(
  items: { max: number; marks: number | null }[],
  passMarkPct: number,
): { score: number; maxScore: number; scorePct: number; passed: boolean } {
  const maxScore = items.reduce((sum, i) => sum + i.max, 0);
  const score = items.reduce((sum, i) => sum + (i.marks ?? 0), 0);
  const exact = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return {
    score,
    maxScore,
    scorePct: Math.round(exact),
    // Compare the exact value, so 69.6% is not rounded up to pass a 70% mark.
    passed: maxScore > 0 && exact + 1e-9 >= passMarkPct,
  };
}

/** What a student may see of a question before submitting: no answer, no explanation (FR-QUIZ-010). */
export interface StudentQuestion {
  id: string;
  type: QuestionKind;
  text: string;
  marks: number;
  mediaUrl: string | null;
  options: { id: string; text: string }[] | null;
}

export function toStudentQuestion(question: SnapshotQuestion): StudentQuestion {
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    marks: question.marks,
    mediaUrl: question.mediaFileId ? `/api/v1/files/${question.mediaFileId}` : null,
    options: question.options ? question.options.map((o) => ({ id: o.id, text: o.text })) : null,
  };
}

/** Is this response the right kind of value for the question? Stops junk from being saved. */
export function isValidResponse(question: SnapshotQuestion, response: unknown): boolean {
  switch (question.type) {
    case 'MULTIPLE_CHOICE':
      return typeof response === 'string' && !!question.options?.some((o) => o.id === response);
    case 'TRUE_FALSE':
      return typeof response === 'boolean';
    default:
      return typeof response === 'string' && response.length <= 5000;
  }
}
