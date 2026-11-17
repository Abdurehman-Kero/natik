import { describe, expect, it } from 'vitest';
import {
  gradeQuestion,
  isValidResponse,
  normalizeAnswer,
  scoreAttempt,
  type SnapshotQuestion,
  toStudentQuestion,
} from './quiz-grading';

const base = {
  id: 'q',
  position: 1,
  text: 'Question?',
  mediaFileId: null,
  explanation: 'Because.',
  marks: 2,
};
const mc: SnapshotQuestion = {
  ...base,
  type: 'MULTIPLE_CHOICE',
  options: [
    { id: 'a', text: 'ب' },
    { id: 'b', text: 'ت' },
  ],
  correct: 'b',
};
const tf: SnapshotQuestion = { ...base, type: 'TRUE_FALSE', options: null, correct: true };
const fill: SnapshotQuestion = {
  ...base,
  type: 'FILL_BLANK',
  options: null,
  correct: ['Kitaab', 'كتاب'],
};
const short: SnapshotQuestion = { ...base, type: 'SHORT_ANSWER', options: null, correct: 'model' };

describe('marking the four question types', () => {
  it('multiple choice is right only for the correct option id', () => {
    expect(gradeQuestion(mc, 'b')).toEqual({ isCorrect: true, marks: 2 });
    expect(gradeQuestion(mc, 'a')).toEqual({ isCorrect: false, marks: 0 });
    expect(gradeQuestion(mc, undefined)).toEqual({ isCorrect: false, marks: 0 });
  });

  it('true / false compares the value, not text', () => {
    expect(gradeQuestion(tf, true).marks).toBe(2);
    expect(gradeQuestion(tf, false).marks).toBe(0);
    expect(gradeQuestion(tf, 'true').marks).toBe(0);
  });

  it('fill in the blank ignores case, extra spaces and Unicode form', () => {
    expect(gradeQuestion(fill, '  kitaab ').marks).toBe(2);
    expect(gradeQuestion(fill, 'KITAAB').marks).toBe(2);
    expect(gradeQuestion(fill, 'كتاب').marks).toBe(2);
    expect(gradeQuestion(fill, 'kitab').marks).toBe(0);
    expect(gradeQuestion(fill, '').marks).toBe(0);
    // "é" typed as one character or as e + accent is the same answer.
    const cafe: SnapshotQuestion = { ...fill, correct: ['café'] };
    expect(gradeQuestion(cafe, 'café').marks).toBe(2);
  });

  it('a short answer waits for a teacher, unless it is blank', () => {
    expect(gradeQuestion(short, 'My sentence')).toEqual({ isCorrect: null, marks: null });
    expect(gradeQuestion(short, '   ')).toEqual({ isCorrect: false, marks: 0 });
    expect(gradeQuestion(short, undefined)).toEqual({ isCorrect: false, marks: 0 });
  });
});

describe('scoring', () => {
  it('adds up marks and applies the pass mark to the exact value', () => {
    expect(
      scoreAttempt(
        [
          { max: 5, marks: 4 },
          { max: 5, marks: 3 },
        ],
        70,
      ),
    ).toMatchObject({
      score: 7,
      maxScore: 10,
      scorePct: 70,
      passed: true,
    });
    // 69.6% rounds to 70 on screen but does not pass a 70% mark.
    const close = scoreAttempt([{ max: 250, marks: 174 }], 70);
    expect(close.scorePct).toBe(70);
    expect(close.passed).toBe(false);
  });

  it('counts unmarked answers as zero and never passes an empty quiz', () => {
    expect(scoreAttempt([{ max: 2, marks: null }], 50).score).toBe(0);
    expect(scoreAttempt([], 50).passed).toBe(false);
  });
});

describe('what a student may see', () => {
  it('never includes the answer or the explanation', () => {
    for (const q of [mc, tf, fill, short]) {
      const sent = JSON.stringify(toStudentQuestion(q));
      expect(sent).not.toContain('correct');
      expect(sent).not.toContain('Because.');
      expect(sent).not.toContain('model');
      expect(sent).not.toContain('Kitaab');
    }
    expect(toStudentQuestion(mc).options).toEqual([
      { id: 'a', text: 'ب' },
      { id: 'b', text: 'ت' },
    ]);
  });

  it('only accepts the right kind of response', () => {
    expect(isValidResponse(mc, 'a')).toBe(true);
    expect(isValidResponse(mc, 'zzz')).toBe(false);
    expect(isValidResponse(tf, 'true')).toBe(false);
    expect(isValidResponse(fill, 'text')).toBe(true);
    expect(isValidResponse(fill, false)).toBe(false);
  });
});

describe('normalizeAnswer', () => {
  it('collapses spaces and lowercases', () => {
    expect(normalizeAnswer('  A   B ')).toBe('a b');
  });
});
