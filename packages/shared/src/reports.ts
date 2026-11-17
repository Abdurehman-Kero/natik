import { z } from 'zod';

/** Reports, activity log, teacher progress and data-keeping (M7). */

export const REPORT_TYPES = ['registrations', 'enrolments', 'payments', 'progress'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format 2026-11-04.')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const reportQuerySchema = z.object({
  from: day,
  to: day,
  courseId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

/** Groups of recorded actions shown as one filter in the activity log (FR-REP-003). */
export const ACTIVITY_GROUPS = [
  'SIGN_IN',
  'ACCOUNTS',
  'ENROLMENTS',
  'PAYMENTS',
  'MARKS',
  'CERTIFICATES',
  'COURSES',
  'OTHER',
] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

export const activityQuerySchema = z.object({
  group: z
    .enum(ACTIVITY_GROUPS)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  actorId: z
    .string()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  from: day,
  to: day,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const teacherStudentsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const eraseUserSchema = z.object({
  reason: z.string().trim().min(3, 'Write the reason.').max(200),
});

export const smsListQuerySchema = z.object({
  status: z.enum(['FAILED', 'QUEUED', 'SENT']).default('FAILED'),
  page: z.coerce.number().int().min(1).default(1),
});
