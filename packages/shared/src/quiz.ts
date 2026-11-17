import { z } from 'zod';

/** Quizzes, marking and certificates (M6). One source of truth for the forms and the API. */

export const QUESTION_TYPES = [
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
] as const;
export type QuestionTypeValue = (typeof QUESTION_TYPES)[number];

const questionText = z
  .string()
  .trim()
  .min(3, 'Write the question.')
  .max(1000, 'Keep the question under 1,000 characters.');

const marks = z.coerce
  .number({ error: 'Enter the marks, for example 1.' })
  .min(0.5, 'Give at least half a mark.')
  .max(100, 'The most is 100 marks.')
  .refine((v) => Math.round(v * 2) === v * 2, 'Use whole or half marks, like 1 or 1.5.');

const common = {
  text: questionText,
  marks: marks.default(1),
  explanation: z
    .string()
    .trim()
    .max(1000, 'Keep the explanation under 1,000 characters.')
    .optional()
    .or(z.literal('')),
  mediaFileId: z.string().min(1).nullable().optional(),
};

/** A question as the teacher enters it. The server turns options into ids and keeps the answer private. */
export const questionInputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MULTIPLE_CHOICE'),
    ...common,
    options: z
      .array(
        z.object({
          text: z.string().trim().min(1, 'Write this option.').max(200, 'Keep options short.'),
        }),
      )
      .min(2, 'Add at least 2 options.')
      .max(6, 'The most is 6 options.'),
    correctIndex: z.coerce.number().int().min(0, 'Choose the correct option.'),
  }),
  z.object({
    type: z.literal('TRUE_FALSE'),
    ...common,
    correctValue: z.boolean({ error: 'Choose true or false.' }),
  }),
  z.object({
    type: z.literal('FILL_BLANK'),
    ...common,
    acceptedAnswers: z
      .array(z.string().trim().min(1, 'Write the answer.').max(200))
      .min(1, 'Add at least one accepted answer.')
      .max(10, 'The most is 10 accepted answers.'),
  }),
  z.object({
    type: z.literal('SHORT_ANSWER'),
    ...common,
    /** Only the teacher ever sees this. */
    modelAnswer: z.string().trim().max(2000).optional().or(z.literal('')),
  }),
]);
export type QuestionInput = z.infer<typeof questionInputSchema>;

export const quizCreateSchema = z.object({
  title: z.string().trim().min(3, 'Give the quiz a name.').max(120),
  isFinal: z.boolean().optional(),
});

export const quizSettingsSchema = z.object({
  title: z.string().trim().min(3, 'Give the quiz a name.').max(120),
  instructions: z.string().trim().max(1000).optional().or(z.literal('')),
  isFinal: z.boolean(),
  passMarkPct: z.coerce
    .number({ error: 'Enter the pass mark, for example 60.' })
    .int('Use a whole number.')
    .min(1, 'The pass mark must be at least 1%.')
    .max(100, 'The pass mark can be at most 100%.'),
  /** Empty = unlimited. */
  maxAttempts: z.coerce.number().int().min(1).max(20).nullable(),
  /** Minutes. Empty = no time limit. */
  timeLimitMinutes: z.coerce.number().int().min(1).max(300).nullable(),
  showAnswers: z.boolean(),
});
export type QuizSettingsInput = z.infer<typeof quizSettingsSchema>;

/** What a student saves for one question: an option id, true/false, or written text. */
export const answerSaveSchema = z.object({
  response: z.union([z.string().max(5000), z.boolean()]),
});

export const markAnswerSchema = z.object({
  marks: z.coerce
    .number({ error: 'Enter a score.' })
    .min(0, 'The score can’t be below 0.')
    .refine((v) => Math.round(v * 2) === v * 2, 'Use whole or half marks.'),
  comment: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const attemptGrantSchema = z.object({
  studentId: z.string().min(1, 'Choose the student.'),
});

export const certificateSettingsSchema = z.object({
  signatoryName: z.string().trim().min(2, 'Enter the name.').max(100),
  signatoryTitle: z.string().trim().min(2, 'Enter the title, for example Director.').max(100),
  signatureFileId: z.string().min(1).nullable().optional(),
});
export type CertificateSettingsInput = z.infer<typeof certificateSettingsSchema>;

/** The name a student wants printed on a certificate, exactly as written (FR-CERT, name check). */
export const certificateNameSchema = z.object({
  nameOnCertificate: z
    .string()
    .trim()
    .min(3, 'Write your full name as it should appear on the certificate.')
    .max(80, 'That name is too long for the certificate.')
    .refine((v) => /\p{L}/u.test(v) && !/[<>{}\[\]\/@#$%^*=+|~`_]/.test(v), {
      message: 'Use letters only (spaces, dots, hyphens and apostrophes are fine).',
    })
    .transform((v) => v.replace(/\s+/g, ' ')),
});
export type CertificateNameInput = z.infer<typeof certificateNameSchema>;

/** An admin approves a certificate, optionally correcting the name first. */
export const approveCertificateSchema = z.object({
  nameOnCertificate: certificateNameSchema.shape.nameOnCertificate.optional(),
});

/** An admin sends a certificate back to the student with a short note. */
export const returnCertificateSchema = z.object({
  note: z.string().trim().min(3, 'Write what the student should change.').max(200),
});

export const listCertificateRequestsQuerySchema = z.object({
  status: z.enum(['AWAITING_NAME', 'AWAITING_APPROVAL', 'RETURNED', 'ISSUED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const cancelCertificateSchema = z.object({
  reason: z.string().trim().min(3, 'Write the reason.').max(200),
});

export const listCertificatesQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['VALID', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const markingQueueQuerySchema = z.object({
  courseId: z.string().min(1).optional(),
  quizId: z.string().min(1).optional(),
});
