import type { QuestionTypeValue } from '@natik/shared';
import type { ContentStatusValue } from './types';

/** Quizzes, marking and certificates (M6). Shapes match the API responses exactly. */

export type QuestionType = QuestionTypeValue;

export interface BuilderQuestion {
  id: string;
  position: number;
  type: QuestionType;
  text: string;
  marks: number;
  explanation: string;
  mediaUrl: string | null;
  mediaFileId: string | null;
  options?: { id: string; text: string }[];
  correctIndex?: number;
  correctValue?: boolean;
  acceptedAnswers?: string[];
  modelAnswer?: string;
}

export interface BuilderQuiz {
  id: string;
  title: string;
  instructions: string;
  isFinal: boolean;
  passMarkPct: number;
  maxAttempts: number | null;
  timeLimitMinutes: number | null;
  showAnswers: boolean;
  status: ContentStatusValue;
  attemptCount: number;
  totalMarks: number;
  lesson: { id: string; title: string; status: ContentStatusValue };
  course: { id: string; title: string; slug: string; lang: string; dir: 'ltr' | 'rtl' };
  questions: BuilderQuestion[];
}

export interface StudentQuestion {
  id: string;
  type: QuestionType;
  text: string;
  marks: number;
  mediaUrl: string | null;
  options: { id: string; text: string }[] | null;
}

export interface QuizPreview {
  quiz: {
    id: string;
    title: string;
    instructions: string | null;
    isFinal: boolean;
    passMarkPct: number;
    maxAttempts: number | null;
    timeLimitMinutes: number | null;
    questionCount: number;
    totalMarks: number;
  };
  course: { slug: string; title: string; dir: 'ltr' | 'rtl'; lang: string };
  lesson: { id: string; title: string };
  questions: StudentQuestion[];
}

export interface QuizIntro {
  quiz: {
    id: string;
    title: string;
    instructions: string | null;
    isFinal: boolean;
    passMarkPct: number;
    timeLimitMinutes: number | null;
    questionCount: number;
    totalMarks: number;
    maxAttempts: number | null;
  };
  course: { slug: string; title: string; dir: 'ltr' | 'rtl' };
  lesson: { id: string; title: string };
  attemptsUsed: number;
  attemptsLeft: number | null;
  inProgressId: string | null;
  passed: boolean;
  bestScorePct: number | null;
  latestAttemptId: string | null;
  canStart: boolean;
}

export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'WAITING_FOR_MARKING' | 'GRADED';

export interface AttemptView {
  attempt: {
    id: string;
    number: number;
    status: AttemptStatus;
    deadlineAt: string | null;
    serverNow: string;
  };
  quizId?: string;
  quiz?: { id: string; title: string; isFinal: boolean; lessonId: string };
  course?: { slug: string; title: string; lang: string; dir: 'ltr' | 'rtl' };
  questions?: StudentQuestion[];
  answers?: Record<string, string | boolean>;
}

export interface ReviewItem {
  questionId: string;
  type: QuestionType;
  text: string;
  options: { id: string; text: string }[] | null;
  maxMarks: number;
  response: string | boolean | null;
  marks: number | null;
  teacherComment: string | null;
  /** Present only when the teacher allows answers to be shown. */
  isCorrect?: boolean | null;
  correct?: unknown;
  explanation?: string | null;
}

export interface AttemptResult {
  attempt: { id: string; number: number; status: AttemptStatus; submittedAt: string | null };
  quiz: {
    id: string;
    title: string;
    isFinal: boolean;
    passMarkPct: number;
    showAnswers: boolean;
  };
  course: { slug: string; title: string };
  lesson: { id: string; title: string };
  result: { score: number; maxScore: number; scorePct: number; passed: boolean } | null;
  attemptsLeft: number | null;
  nextLessonId: string | null;
  courseCompleted: boolean;
  review: ReviewItem[] | null;
}

export interface AttemptHistory {
  quiz: { id: string; title: string; passMarkPct: number };
  course: { slug: string; title: string };
  items: {
    id: string;
    number: number;
    status: AttemptStatus;
    scorePct: number | null;
    passed: boolean | null;
    startedAt: string;
    submittedAt: string | null;
  }[];
}

export interface MarkingItem {
  answerId: string;
  studentName: string;
  submittedAt: string | null;
  quiz: { id: string; title: string };
  course: { id: string; title: string; lang: string; dir: 'ltr' | 'rtl' };
  question: { text: string; maxMarks: number; modelAnswer: string | null };
  response: string;
}

export interface MarkingQueue {
  total: number;
  items: MarkingItem[];
  courses: { id: string; title: string }[];
  quizzes: { id: string; title: string; courseId: string }[];
}

export interface TeachStudent {
  id: string;
  fullName: string;
  phone: string | null;
  status: string;
  progressPct: number;
}

export interface StudentAttempts {
  student: { id: string; fullName: string };
  quizzes: {
    id: string;
    title: string;
    isFinal: boolean;
    passMarkPct: number;
    attemptsLeft: number | null;
    attempts: {
      id: string;
      number: number;
      status: AttemptStatus;
      scorePct: number | null;
      passed: boolean | null;
      submittedAt: string | null;
    }[];
  }[];
}

export interface MyCertificate {
  id: string;
  number: string;
  status: 'VALID' | 'CANCELLED';
  issuedAt: string;
  nameOnCertificate: string;
  courseTitle: string;
  courseSlug: string;
  pdfUrl: string | null;
}

export type CertificateRequestStatus =
  'AWAITING_NAME' | 'AWAITING_APPROVAL' | 'RETURNED' | 'ISSUED';

/** A finished course's certificate on its way to the student. */
export interface MyCertificateRequest {
  id: string;
  status: Exclude<CertificateRequestStatus, 'ISSUED'>;
  courseTitle: string;
  courseSlug: string;
  completedAt: string | null;
  nameOnCertificate: string | null;
  /** What to put in the box: the name already sent, or the profile name. */
  suggestedName: string;
  adminNote: string | null;
  submittedAt: string | null;
}

export interface AdminCertificateRequest {
  id: string;
  status: CertificateRequestStatus;
  nameOnCertificate: string | null;
  profileName: string;
  studentPhone: string | null;
  courseTitle: string;
  completedAt: string | null;
  submittedAt: string | null;
  adminNote: string | null;
  reviewedAt: string | null;
  certificate: { id: string; number: string } | null;
}

export interface CertificateRequestPage {
  total: number;
  page: number;
  pageSize: number;
  counts: Record<Exclude<CertificateRequestStatus, never>, number>;
  items: AdminCertificateRequest[];
}

export interface AdminCertificate {
  id: string;
  number: string;
  status: 'VALID' | 'CANCELLED';
  issuedAt: string;
  studentName: string;
  studentPhone: string | null;
  courseTitle: string;
  cancelReason: string | null;
  cancelledAt: string | null;
}

export interface CertificateSettings {
  signatoryName: string;
  signatoryTitle: string;
  signatureFileId: string | null;
  signatureUrl: string | null;
}
