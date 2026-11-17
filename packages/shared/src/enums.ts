/**
 * Domain enums shared by the API and the web app.
 * They mirror the Prisma enums one-to-one (checked by a test in the API).
 * Pattern: a const object (runtime values) plus a type of the same name.
 */

const defineEnum = <const T extends readonly string[]>(...values: T) =>
  Object.freeze(Object.fromEntries(values.map((v) => [v, v]))) as { readonly [K in T[number]]: K };

export const Role = defineEnum('STUDENT', 'TEACHER', 'ADMIN');
export type Role = keyof typeof Role;

export const UserStatus = defineEnum('ACTIVE', 'DISABLED');
export type UserStatus = keyof typeof UserStatus;

export const SessionKind = defineEnum('PERSISTENT', 'BROWSER', 'STAFF');
export type SessionKind = keyof typeof SessionKind;

export const OtpPurpose = defineEnum('VERIFY_PHONE', 'RESET_PASSWORD');
export type OtpPurpose = keyof typeof OtpPurpose;

export const TextDirection = defineEnum('LTR', 'RTL');
export type TextDirection = keyof typeof TextDirection;

export const ContentStatus = defineEnum('DRAFT', 'PUBLISHED', 'HIDDEN');
export type ContentStatus = keyof typeof ContentStatus;

export const CourseAccess = defineEnum('FREE', 'PAID');
export type CourseAccess = keyof typeof CourseAccess;

export const BlockType = defineEnum('TEXT', 'VIDEO', 'PDF', 'AUDIO', 'IMAGE', 'SLIDES');
export type BlockType = keyof typeof BlockType;

export const FilePurpose = defineEnum(
  'LESSON_PDF',
  'LESSON_AUDIO',
  'LESSON_IMAGE',
  'COURSE_IMAGE',
  'QUESTION_MEDIA',
  'SITE_IMAGE',
  'AVATAR',
  'RECEIPT',
  'CERTIFICATE',
  'SIGNATURE',
  'CHAT_ATTACHMENT',
  'CAPTION',
  'VIDEO_POSTER',
);
export type FilePurpose = keyof typeof FilePurpose;

export const ConversationKind = defineEnum('STUDENT_ADMIN', 'STUDENT_TEACHER', 'TEACHER_ADMIN');
export type ConversationKind = keyof typeof ConversationKind;

export const ChatMessageKind = defineEnum('TEXT', 'IMAGE', 'FILE', 'VOICE');
export type ChatMessageKind = keyof typeof ChatMessageKind;

export const LessonOrder = defineEnum('OPEN', 'IN_ORDER');
export type LessonOrder = keyof typeof LessonOrder;

/** Steps of a guided lesson. (Its type, `LessonStage`, is exported with the lesson schemas.) */
export const LessonStageValues = defineEnum('PREPARE', 'WATCH', 'REVISE', 'EXAMPLES');

export const VideoStatus = defineEnum('UPLOADING', 'PROCESSING', 'READY', 'FAILED');
export type VideoStatus = keyof typeof VideoStatus;

export const EnrolmentStatus = defineEnum(
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'ACTIVE',
  'COMPLETED',
  'EXPIRED',
  'CANCELLED',
);
export type EnrolmentStatus = keyof typeof EnrolmentStatus;

export const PaymentKind = defineEnum('NEW', 'RENEWAL');
export type PaymentKind = keyof typeof PaymentKind;

export const PaymentMethod = defineEnum('BANK', 'MOBILE_WALLET', 'CASH');
export type PaymentMethod = keyof typeof PaymentMethod;

export const PaymentStatus = defineEnum('SUBMITTED', 'CONFIRMED', 'REJECTED');
export type PaymentStatus = keyof typeof PaymentStatus;

export const PaymentAccountType = defineEnum('BANK', 'MOBILE_WALLET');
export type PaymentAccountType = keyof typeof PaymentAccountType;

export const QuestionType = defineEnum(
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
);
export type QuestionType = keyof typeof QuestionType;

export const AttemptStatus = defineEnum(
  'IN_PROGRESS',
  'SUBMITTED',
  'WAITING_FOR_MARKING',
  'GRADED',
);
export type AttemptStatus = keyof typeof AttemptStatus;

export const CertificateStatus = defineEnum('VALID', 'CANCELLED');
export type CertificateStatus = keyof typeof CertificateStatus;

export const CertificateRequestStatus = defineEnum(
  'AWAITING_NAME',
  'AWAITING_APPROVAL',
  'RETURNED',
  'ISSUED',
);
export type CertificateRequestStatus = keyof typeof CertificateRequestStatus;

export const Audience = defineEnum('PUBLIC', 'ALL_STUDENTS', 'COURSE');
export type Audience = keyof typeof Audience;

export const InboxMessageType = defineEnum('CONTACT', 'PROBLEM_REPORT');
export type InboxMessageType = keyof typeof InboxMessageType;

export const InboxMessageStatus = defineEnum('NEW', 'CLOSED');
export type InboxMessageStatus = keyof typeof InboxMessageStatus;

export const SmsStatus = defineEnum('QUEUED', 'SENT', 'FAILED');
export type SmsStatus = keyof typeof SmsStatus;

/** Every shared enum, keyed by its Prisma enum name (used by the API sync test). */
export const ALL_ENUMS = {
  Role,
  UserStatus,
  SessionKind,
  OtpPurpose,
  TextDirection,
  ContentStatus,
  CourseAccess,
  BlockType,
  FilePurpose,
  VideoStatus,
  EnrolmentStatus,
  PaymentKind,
  PaymentMethod,
  PaymentStatus,
  PaymentAccountType,
  QuestionType,
  AttemptStatus,
  CertificateStatus,
  CertificateRequestStatus,
  Audience,
  InboxMessageType,
  InboxMessageStatus,
  SmsStatus,
  ConversationKind,
  ChatMessageKind,
  LessonOrder,
  LessonStage: LessonStageValues,
} as const;
