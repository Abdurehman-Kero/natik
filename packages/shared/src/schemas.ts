import { z } from 'zod';
import { normalizePhone } from './phone.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordProblems } from './password.js';

/**
 * Input rules shared by the browser forms and the API (one source of truth).
 * Messages are plain language and say what to do (SRS NFR-USE-004).
 */
export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name.')
  .max(100, 'That name is too long.');

export const phoneSchema = z
  .string()
  .trim()
  .refine((value) => normalizePhone(value) !== null, 'Enter a 9-digit Ethiopian mobile number.');

export const passwordSchema = z.string().superRefine((value, ctx) => {
  const problems = passwordProblems(value);
  if (problems.includes('TOO_SHORT'))
    ctx.addIssue({ code: 'custom', message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` });
  if (problems.includes('TOO_LONG'))
    ctx.addIssue({ code: 'custom', message: `Use at most ${PASSWORD_MAX_LENGTH} characters.` });
  if (problems.includes('NO_LETTER') && !problems.includes('TOO_SHORT'))
    ctx.addIssue({ code: 'custom', message: 'Add at least one letter.' });
  if (problems.includes('NO_NUMBER') && !problems.includes('TOO_SHORT'))
    ctx.addIssue({ code: 'custom', message: 'Add at least one number.' });
});

export const emailSchema = z
  .string()
  .trim()
  .max(200)
  .pipe(z.union([z.literal(''), z.email('Enter a valid email address.')]))
  .optional();

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code.');

export const registerSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  password: passwordSchema,
  /** Id of the language the student wants to learn (editable list). */
  interestLanguageId: z.string().min(1).optional(),
  email: emailSchema,
  acceptTerms: z.literal(true, { error: 'Please accept the Terms and Privacy notice.' }),
  confirmAge: z.literal(true, { error: 'Please confirm you are 16 or older.' }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const signInSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, 'Enter your password.').max(PASSWORD_MAX_LENGTH),
  keepSignedIn: z.boolean().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ phone: phoneSchema });

export const verifyResetCodeSchema = z.object({ phone: phoneSchema, code: otpCodeSchema });

export const setPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: passwordSchema,
});

export const adminCreateUserSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  email: emailSchema,
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']),
});

export const adminUpdateUserSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
  bio: z.string().trim().max(300).optional(),
  showOnWebsite: z.boolean().optional(),
});

export const listUsersQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** The public contact form (FR-WEB-004). `website` is a hidden trap field: real people leave it empty. */
export const contactSchema = z.object({
  name: fullNameSchema,
  phone: phoneSchema,
  message: z
    .string()
    .trim()
    .min(10, 'Please write a little more so we can help.')
    .max(1000, 'Please keep your message under 1,000 characters.'),
  website: z.string().max(200).optional(),
  /** When the form was opened (ms since 1970); forms sent instantly are bots. */
  openedAt: z.number().int().optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

/** Certificate numbers look like NLC-2026-00042. */
export const CERTIFICATE_NUMBER = /^NLC-\d{4}-\d{5}$/;

export const publicCoursesQuerySchema = z.object({
  language: z.string().trim().max(10).optional(),
  level: z.string().trim().max(40).optional(),
});

// ─── Courses, units, lessons (M3) ──────────────────────────────────────────

/** Tiptap/ProseMirror document. The shape is checked again on the server before it is stored or shown. */
export const richTextSchema = z.object({ type: z.literal('doc') }).loose();
export type RichText = z.infer<typeof richTextSchema>;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Use at least 3 characters.')
  .max(80, 'Use at most 80 characters.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use only lowercase letters, numbers and dashes.');

/** Turns a title into a web-address-friendly slug ("Arabic for Beginners" → "arabic-for-beginners"). */
export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const titleSchema = (what: string) =>
  z.string().trim().min(2, `Enter a ${what}.`).max(120, `That ${what} is too long.`);

/** Fields an admin can change on a course (FR-ADMIN-003). Price and access are admin-only (FR-TEACH-007). */
export const courseInputSchema = z
  .object({
    title: titleSchema('title'),
    slug: slugSchema.optional(),
    languageId: z.string().min(1, 'Choose a language.'),
    levelId: z.string().min(1, 'Choose a level.'),
    summary: z
      .string()
      .trim()
      .min(10, 'Write a short summary (at least 10 characters).')
      .max(300, 'Keep the summary under 300 characters.'),
    description: richTextSchema.nullable().optional(),
    outcomes: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
    durationText: z.string().trim().max(60).nullable().optional(),
    access: z.enum(['FREE', 'PAID']),
    /** Integer santim (ETB × 100). Required when the course is paid. */
    priceSantim: z
      .number()
      .int()
      .min(100, 'Enter a price of at least ETB 1.')
      .max(100_000_000)
      .nullable()
      .optional(),
    /** Days of access after enrolling; null = unlimited. */
    accessDays: z.number().int().min(1, 'Use at least 1 day.').max(3650).nullable().optional(),
    featured: z.boolean().optional(),
    imageFileId: z.string().min(1).nullable().optional(),
    /** OPEN: all lessons can be opened. IN_ORDER: a lesson opens once the ones before it are done. */
    lessonOrder: z.enum(['OPEN', 'IN_ORDER']).optional(),
    /** Paid courses: show the price on the public site (off = people ask Natik support). */
    showPrice: z.boolean().optional(),
    /** A YouTube or Vimeo link for a short trailer on the course page. */
    trailerUrl: z
      .string()
      .trim()
      .url('Enter a full link, starting with https://')
      .max(300)
      .nullable()
      .optional(),
  })
  .refine((v) => v.access === 'FREE' || (v.priceSantim ?? 0) >= 100, {
    path: ['priceSantim'],
    message: 'Enter the price for this paid course.',
  });
export type CourseInput = z.infer<typeof courseInputSchema>;

export const teachersAssignSchema = z.object({
  teacherIds: z.array(z.string().min(1)).max(20),
});

export const listAdminCoursesQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const languageInputSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(40),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/, 'Use a language code like "ar", "en" or "om".'),
  direction: z.enum(['LTR', 'RTL']).default('LTR'),
  active: z.boolean().optional(),
});

export const levelInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(40),
  active: z.boolean().optional(),
});

/** New order of a list: the ids from top to bottom. */
export const reorderSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

export const unitInputSchema = z.object({ title: titleSchema('title') });

export const LESSON_STAGES = ['PREPARE', 'WATCH', 'REVISE', 'EXAMPLES'] as const;
export const lessonStageSchema = z.enum(LESSON_STAGES);
export type LessonStage = z.infer<typeof lessonStageSchema>;

export const lessonInputSchema = z.object({
  title: titleSchema('title'),
  isFreePreview: z.boolean().optional(),
  downloadsAllowed: z.boolean().optional(),
  description: z
    .string()
    .trim()
    .max(400, 'Keep the description under 400 characters.')
    .nullable()
    .optional(),
  /** What the student will be able to do after the lesson: up to 6 short lines. */
  objectives: z.array(z.string().trim().min(1).max(160)).max(6).optional(),
  estimatedMinutes: z.number().int().min(1).max(600).nullable().optional(),
  /** Stays open even when the course opens lessons in order. */
  alwaysOpen: z.boolean().optional(),
});

/** Moves lessons between and within units; each unit lists its lessons in order. */
export const lessonsReorderSchema = z.object({
  units: z
    .array(z.object({ unitId: z.string().min(1), lessonIds: z.array(z.string().min(1)).max(500) }))
    .min(1)
    .max(200),
});

export const blockCreateSchema = z.object({
  type: z.enum(['TEXT', 'VIDEO', 'PDF', 'AUDIO', 'IMAGE', 'SLIDES']),
  stage: lessonStageSchema.nullable().optional(),
  textJson: richTextSchema.optional(),
  fileId: z.string().min(1).optional(),
  videoId: z.string().min(1).optional(),
  caption: z.string().trim().max(200).optional(),
});

export const blockUpdateSchema = z.object({
  textJson: richTextSchema.optional(),
  stage: lessonStageSchema.nullable().optional(),
  caption: z.string().trim().max(200).nullable().optional(),
});

/** Up to 10 slides in a deck: a title, a little text, a picture and a few key words. */
export const slideInputSchema = z.object({
  title: z.string().trim().min(1, 'Add a slide title.').max(120),
  body: z
    .string()
    .trim()
    .max(1200, 'Keep the slide text under 1,200 characters.')
    .nullable()
    .optional(),
  imageFileId: z.string().min(1).nullable().optional(),
  keywords: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
});
export const MAX_SLIDES_PER_BLOCK = 30;

/** Where a student stopped in a lesson: the step reached and/or a video position in seconds. */
export const resumeSchema = z.object({
  stage: z.number().int().min(0).max(20).optional(),
  video: z.object({ id: z.string().min(1).max(60), sec: z.number().min(0).max(86400) }).optional(),
});

/** The answers to a "Find your level" check: question id → chosen option id. */
export const placementAnswersSchema = z.object({
  answers: z
    .record(z.string().min(1).max(60), z.string().min(1).max(60))
    .refine((value) => Object.keys(value).length <= 60, 'Too many answers.'),
});

/** A video that lives on YouTube or Vimeo instead of being uploaded. */
export const externalVideoSchema = z.object({
  title: z.string().trim().min(1).max(120),
  url: z.string().trim().url('Enter a full link, starting with https://').max(300),
});

export const videoCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().min(1).optional(),
});

export const publishCheckMessages = {
  title: 'Add a title.',
  blocks: 'Add at least one block (text, video, PDF, audio, image or slides).',
} as const;

// ─── Public website content, inbox, announcements (M4) ─────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((v) => v || undefined);

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => v || undefined)
  .refine(
    (v) => v === undefined || /^https?:\/\/\S+$/i.test(v),
    'Enter a full web address, starting with https://',
  );

/** Editable keys of the website editor (SiteContent rows). */
export const SITE_CONTENT_KEYS = ['home', 'about', 'contact'] as const;
export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export const homeContentSchema = z.object({
  heroEyebrow: optionalText(60),
  heroTitle: z
    .string()
    .trim()
    .min(3, 'Enter a headline.')
    .max(90, 'Keep the headline under 90 characters.'),
  heroSubtitle: z
    .string()
    .trim()
    .min(3, 'Enter a short line under the headline.')
    .max(200, 'Keep this under 200 characters.'),
});

export const aboutContentSchema = z.object({
  mission: z
    .string()
    .trim()
    .min(10, 'Write a few words about the centre.')
    .max(800, 'Keep this under 800 characters.'),
});

export const contactContentSchema = z.object({
  phone: optionalText(40),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined)
    .refine(
      (v) => v === undefined || z.email().safeParse(v).success,
      'Enter a valid email address.',
    ),
  address: optionalText(200),
  hours: optionalText(120),
  mapUrl: optionalUrl,
  telegram: optionalUrl,
  /** A person or account to chat with: "@Natikfluency" or a t.me link; saved as a t.me link. */
  telegramContact: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined)
    .transform((v) => (v ? v.replace(/^https?:\/\/(www\.)?t\.me\//i, '').replace(/^@/, '') : v))
    .refine(
      (v) => v === undefined || /^[A-Za-z0-9_]{4,32}$/.test(v),
      'Enter a Telegram name like @Natikfluency.',
    )
    .transform((v) => (v ? `https://t.me/${v}` : v)),
  facebook: optionalUrl,
  instagram: optionalUrl,
  tiktok: optionalUrl,
  youtube: optionalUrl,
});

export const siteContentSchemas = {
  home: homeContentSchema,
  about: aboutContentSchema,
  contact: contactContentSchema,
} as const;

export const faqInputSchema = z.object({
  question: z.string().trim().min(3, 'Enter the question.').max(200),
  answer: z
    .string()
    .trim()
    .min(3, 'Enter the answer.')
    .max(1500, 'Keep the answer under 1,500 characters.'),
  published: z.boolean().default(true),
});

export const testimonialInputSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name.').max(80),
  quote: z
    .string()
    .trim()
    .min(10, 'Enter what they said.')
    .max(400, 'Keep the quote under 400 characters.'),
  courseLabel: optionalText(80),
  published: z.boolean().default(true),
});

export const policyInputSchema = z.object({
  title: z.string().trim().min(2, 'Enter a title.').max(80),
  body: richTextSchema,
});

export const featuredCoursesSchema = z.object({ ids: z.array(z.string().min(1)).max(12) });

export const announcementInputSchema = z.object({
  title: z.string().trim().min(3, 'Enter a title.').max(120),
  text: z
    .string()
    .trim()
    .min(3, 'Write the announcement.')
    .max(2000, 'Keep this under 2,000 characters.'),
  audience: z.enum(['PUBLIC', 'ALL_STUDENTS', 'COURSE']),
  courseId: z.string().min(1).optional(),
  /** ISO date-time; empty = now. */
  publishAt: z.string().datetime().optional(),
});
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export const listMessagesQuerySchema = z.object({
  status: z.enum(['NEW', 'CLOSED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// ─── Enrolment, payments, learning (M5) ────────────────────────────────────

/** "1500", "1,500" or "1500.50" typed by a person → whole santim. */
const birrAmount = z
  .string()
  .trim()
  .transform((v) => v.replace(/[,\s]/g, ''))
  .pipe(
    z
      .string()
      .regex(/^\d{1,7}(\.\d{1,2})?$/, 'Enter the amount in birr, for example 1500.')
      .transform((v) => Math.round(Number(v) * 100))
      .refine((v) => v > 0, 'Enter the amount in birr, for example 1500.'),
  );

/** A calendar date typed as 2026-11-04. It can't be in the future, or older than a year. */
const paidOnDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date you paid.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Choose the date you paid.')
  .refine((v) => Date.parse(`${v}T00:00:00Z`) <= Date.now() + 36 * 3_600_000, {
    message: 'The payment date can’t be in the future.',
  })
  .refine((v) => Date.parse(`${v}T00:00:00Z`) >= Date.now() - 366 * 86_400_000, {
    message: 'That date is too long ago. Contact us if this is correct.',
  });

/** What the student sends after paying by bank or mobile wallet (FR-PAY-002). */
export const paymentSubmitSchema = z.object({
  method: z.enum(['BANK', 'MOBILE_WALLET'], { message: 'Choose how you paid.' }),
  reference: z
    .string()
    .trim()
    .min(4, 'Enter the reference from your receipt.')
    .max(60, 'That reference is too long.'),
  amount: birrAmount,
  paidOn: paidOnDate,
});
export type PaymentSubmitInput = z.infer<typeof paymentSubmitSchema>;

/** Admin records money received at the centre (FR-PAY-007). */
export const cashPaymentSchema = z.object({
  studentId: z.string().min(1, 'Choose the student.'),
  courseId: z.string().min(1, 'Choose the course.'),
  amount: birrAmount,
  paidOn: paidOnDate,
  /** Optional receipt number from the centre's own book. */
  reference: z.string().trim().max(60).optional().or(z.literal('')),
});
export type CashPaymentInput = z.infer<typeof cashPaymentSchema>;

export const rejectPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Write the reason so the student knows what to fix.')
    .max(80, 'Keep the reason under 80 characters (it is sent by SMS).'),
});

export const adminEnrolSchema = z.object({
  studentId: z.string().min(1, 'Choose the student.'),
  courseId: z.string().min(1, 'Choose the course.'),
});

export const extendEnrolmentSchema = z.object({
  days: z.coerce.number().int().min(1, 'Enter at least 1 day.').max(730, 'The most is 730 days.'),
});

export const cancelEnrolmentSchema = z.object({
  reason: z.string().trim().min(3, 'Write the reason.').max(200),
});

export const listAdminPaymentsQuerySchema = z.object({
  status: z.enum(['SUBMITTED', 'CONFIRMED', 'REJECTED']).default('SUBMITTED'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const listAdminEnrolmentsQuerySchema = z.object({
  courseId: z.string().min(1).optional(),
  studentId: z.string().min(1).optional(),
  status: z
    .enum(['AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const paymentAccountInputSchema = z.object({
  type: z.enum(['BANK', 'MOBILE_WALLET']),
  provider: z.string().trim().min(2, 'Enter the bank or wallet name.').max(60),
  accountName: z.string().trim().min(2, 'Enter the account name.').max(100),
  accountNumber: z
    .string()
    .trim()
    .min(4, 'Enter the account number.')
    .max(40, 'That number is too long.'),
  note: z.string().trim().max(120).optional().or(z.literal('')),
  active: z.boolean().default(true),
});
export type PaymentAccountInput = z.infer<typeof paymentAccountInputSchema>;

export const reportProblemSchema = z.object({
  message: z
    .string()
    .trim()
    .min(5, 'Tell us briefly what went wrong.')
    .max(1000, 'Please keep this under 1,000 characters.'),
});

/** Admin searches for a student to enrol or record a payment for. */
export const studentSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(60),
});
