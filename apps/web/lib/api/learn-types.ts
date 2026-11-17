import type { EnrolmentStatus, PaymentStatus } from '@natik/shared';
import type { LessonViewModel } from './types';

/** Enrolment, payment and learning data (M5). Shapes match the API responses exactly. */

export interface EnrolmentSummary {
  id: string;
  courseId: string;
  status: EnrolmentStatus;
  startAt: string | null;
  endAt: string | null;
  completedAt: string | null;
  progressPct: number;
}

/** What decides the button on a course page (FR-CAT-004). */
export interface CourseState {
  courseId: string;
  canEdit: boolean;
  enrolment:
    | (EnrolmentSummary & {
        paymentUnderReview: boolean;
        continueLessonId: string | null;
      })
    | null;
}

export interface RenewResult extends EnrolmentSummary {
  needsPayment: boolean;
}

export type BlockedReason =
  'NOT_ENROLLED' | 'AWAITING_PAYMENT' | 'PAYMENT_UNDER_REVIEW' | 'EXPIRED' | 'CANCELLED';

/** Why a course or lesson did not open, with what the screen needs to offer the next step. */
export interface BlockedInfo {
  reason: BlockedReason;
  courseId: string;
  courseSlug: string;
  isFree: boolean;
  enrolmentId: string | null;
  endAt: string | null;
}

export interface MyCourseItem {
  enrolmentId: string;
  status: EnrolmentStatus;
  progressPct: number;
  endAt: string | null;
  lastOpenedAt: string | null;
  paymentUnderReview: boolean;
  continueLesson: { id: string; title: string } | null;
  course: {
    slug: string;
    title: string;
    access: 'FREE' | 'PAID';
    language: { name: string; code: string };
    imageUrl: string | null;
  };
}

export interface NewsItem {
  id: string;
  title: string;
  text: string;
  audience: 'PUBLIC' | 'ALL_STUDENTS' | 'COURSE';
  courseTitle: string | null;
  publishAt: string;
  read: boolean;
}

export interface StudentDashboard {
  firstName: string;
  continue: {
    courseSlug: string;
    courseTitle: string;
    lessonId: string;
    lessonTitle: string;
    progressPct: number;
  } | null;
  courses: MyCourseItem[];
  totalCourses: number;
  news: { unread: number; latest: NewsItem[] };
  results: {
    id: string;
    status: 'GRADED' | 'WAITING_FOR_MARKING';
    scorePct: number | null;
    passed: boolean | null;
    quizTitle: string;
    courseTitle: string;
  }[];
  certificates: { id: string; number: string; courseTitle: string }[];
  /** Finished courses whose certificate needs the student to confirm the name. */
  certificatesToConfirm: { id: string; courseTitle: string }[];
}

export type LessonState = 'done' | 'current' | 'todo' | 'locked';

export interface OutlineUnit {
  id: string;
  title: string;
  done: number;
  total: number;
  lessons: { id: string; title: string; state: LessonState; minutes: number | null }[];
}

export type CourseOutline =
  | {
      course: {
        id: string;
        slug: string;
        title: string;
        dir: 'ltr' | 'rtl';
        access: 'FREE' | 'PAID';
      };
      access: {
        allowed: false;
        reason: BlockedReason;
        enrolmentId: string | null;
        endAt: string | null;
      };
    }
  | {
      course: {
        id: string;
        slug: string;
        title: string;
        dir: 'ltr' | 'rtl';
        access: 'FREE' | 'PAID';
      };
      access: { allowed: true; readOnly: boolean };
      enrolment: { id: string; status: EnrolmentStatus; progressPct: number; endAt: string | null };
      units: OutlineUnit[];
      totals: { done: number; total: number };
      continueLesson: { id: string; title: string } | null;
    };

export interface LessonPage {
  lesson: LessonViewModel;
  course: { slug: string; title: string };
  nav: { prevId: string | null; nextId: string | null; position: number; total: number };
  state: {
    completed: boolean;
    readOnly: boolean;
    hasQuiz: boolean;
    quiz: { id: string; title: string } | null;
    progressPct: number;
    /** Where the student stopped: the step of the guided lesson and each video's position (seconds). */
    resume: { stage: number; videos: Record<string, number> };
  };
  units: OutlineUnit[];
}

export interface CompleteResult {
  progressPct: number;
  courseCompleted: boolean;
  nextId: string | null;
}

export interface PaymentAccountView {
  id: string;
  type: 'BANK' | 'MOBILE_WALLET';
  provider: string;
  accountName: string;
  accountNumber: string;
  note: string | null;
  position: number;
  active: boolean;
}

export interface PaymentInfo {
  enrolment: { id: string; status: EnrolmentStatus };
  course: { id: string; title: string; slug: string; priceSantim: number | null };
  kind: 'NEW' | 'RENEWAL';
  canSubmit: boolean;
  underReview: {
    id: string;
    createdAt: string;
    reference: string | null;
    amountSantim: number;
  } | null;
  lastRejection: { rejectionReason: string | null; checkedAt: string | null } | null;
  accounts: PaymentAccountView[];
}

export interface MyPayment {
  id: string;
  kind: 'NEW' | 'RENEWAL';
  method: 'BANK' | 'MOBILE_WALLET' | 'CASH';
  reference: string | null;
  amountSantim: number;
  paidOn: string;
  status: PaymentStatus;
  rejectionReason: string | null;
  submittedAt: string;
  course: { id: string; title: string; slug: string };
  enrolmentId: string;
}

export interface AdminPayment {
  id: string;
  kind: 'NEW' | 'RENEWAL';
  method: 'BANK' | 'MOBILE_WALLET' | 'CASH';
  reference: string | null;
  amountSantim: number;
  expectedSantim: number;
  matches: boolean;
  paidOn: string;
  status: PaymentStatus;
  rejectionReason: string | null;
  submittedAt: string;
  checkedAt: string | null;
  checkedBy: string | null;
  receiptUrl: string | null;
  student: { id: string; fullName: string; phone: string | null };
  course: { id: string; title: string; slug: string };
  enrolmentId: string;
}

export interface AdminEnrolment extends EnrolmentSummary {
  createdAt: string;
  student: { id: string; fullName: string; phone: string | null };
  course: { id: string; title: string; slug: string; access: 'FREE' | 'PAID' };
}

export interface StudentChoice {
  id: string;
  fullName: string;
  phone: string | null;
}
