/** Dashboard, reports, activity log and SMS failures (M7). Shapes match the API responses. */

export interface AdminDashboard {
  students: number;
  newThisWeek: number;
  paymentsToCheck: number;
  newMessages: number;
  activeByCourse: { courseId: string; title: string; count: number }[];
}

export type ReportType = 'registrations' | 'enrolments' | 'payments' | 'progress';
export type ColumnType = 'text' | 'date' | 'money' | 'number' | 'percent';

export interface ReportData {
  type: ReportType;
  columns: { key: string; label: string; type: ColumnType }[];
  rows: Record<string, string | number | null>[];
  total: number;
  page: number;
  pageSize: number;
  summary: { label: string; value: string | number; type: ColumnType }[];
}

export interface ActivityItem {
  id: string;
  createdAt: string;
  action: string;
  actor: { id: string; name: string | null } | null;
  subject: string | null;
  entityType: string;
}

export interface ActivityList {
  total: number;
  page: number;
  pageSize: number;
  actors: { id: string; fullName: string }[];
  items: ActivityItem[];
}

export interface ActivityDetail extends ActivityItem {
  entityId: string;
  details: Record<string, unknown> | null;
  ip: string | null;
}

export interface SmsFailure {
  id: string;
  to: string;
  template: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

export interface SmsList {
  total: number;
  failedCount: number;
  page: number;
  pageSize: number;
  items: SmsFailure[];
}

export interface TeacherHome {
  courseCount: number;
  studentCount: number;
  toMark: number;
}

export interface ProgressStudent {
  id: string;
  fullName: string;
  status: string;
  progressPct: number;
  lessonsDone: number;
  lessonsTotal: number;
  quizAvgPct: number | null;
  finalPct: number | null;
  lastActiveAt: string | null;
}
