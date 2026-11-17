import { Injectable } from '@nestjs/common';
import { maskPhone, type ReportQuery, type ReportType } from '@natik/shared';
import { type CsvCell, csvMoney, toCsv } from '../../common/csv';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ColumnType = 'text' | 'date' | 'money' | 'number' | 'percent';
export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}
export interface ReportResult {
  type: ReportType;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  summary: { label: string; value: string | number; type: ColumnType }[];
}

const COLUMNS: Record<ReportType, ReportColumn[]> = {
  registrations: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'language', label: 'Interested in', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
  ],
  enrolments: [
    { key: 'student', label: 'Student', type: 'text' },
    { key: 'course', label: 'Course', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'startAt', label: 'Start', type: 'date' },
    { key: 'endAt', label: 'End', type: 'date' },
    { key: 'progress', label: 'Progress %', type: 'percent' },
  ],
  payments: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'student', label: 'Student', type: 'text' },
    { key: 'course', label: 'Course', type: 'text' },
    { key: 'method', label: 'Method', type: 'text' },
    { key: 'reference', label: 'Reference', type: 'text' },
    { key: 'amount', label: 'Amount (ETB)', type: 'money' },
    { key: 'checkedBy', label: 'Checked by', type: 'text' },
  ],
  progress: [
    { key: 'student', label: 'Student', type: 'text' },
    { key: 'course', label: 'Course', type: 'text' },
    { key: 'progress', label: 'Progress %', type: 'percent' },
    { key: 'lessons', label: 'Lessons done', type: 'text' },
    { key: 'quizAvg', label: 'Average quiz %', type: 'percent' },
    { key: 'finalPct', label: 'Final quiz %', type: 'percent' },
    { key: 'completedAt', label: 'Completed', type: 'date' },
  ],
};

const METHOD_LABEL = { BANK: 'Bank', MOBILE_WALLET: 'Mobile wallet', CASH: 'Cash' } as const;
const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: 'Payment needed',
  PAYMENT_SUBMITTED: 'Payment under review',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

/** Most rows a CSV may hold. Far more than a language centre needs; stops a runaway export. */
const EXPORT_LIMIT = 20_000;

/** Days run from midnight to midnight in East Africa Time (SRS §2.4). */
function dayRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00+03:00`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999+03:00`) } : {}),
  };
}

export interface ProgressExtras {
  lessonsDone: number;
  lessonsTotal: number;
  quizAvgPct: number | null;
  finalPct: number | null;
}

/**
 * The four reports (FR-REP-001) and the progress numbers teachers see (FR-TEACH-006). Every figure
 * is counted in the database from the same rows the screens use, so a hand count matches (AT-14).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async report(type: ReportType, query: ReportQuery, all = false): Promise<ReportResult> {
    const page = all ? 1 : query.page;
    const pageSize = all ? EXPORT_LIMIT : query.pageSize;
    const skip = (page - 1) * pageSize;
    const created = dayRange(query.from, query.to);
    const part =
      type === 'registrations'
        ? await this.registrations(created, skip, pageSize)
        : type === 'enrolments'
          ? await this.enrolments(created, query.courseId, skip, pageSize)
          : type === 'payments'
            ? await this.payments(created, query.courseId, skip, pageSize)
            : await this.progress(created, query.courseId, skip, pageSize);
    return { type, columns: COLUMNS[type], page, pageSize, ...part };
  }

  /** The same report as a CSV file (UTF-8 with BOM, safe for Excel). */
  async csv(type: ReportType, query: ReportQuery): Promise<Buffer> {
    const result = await this.report(type, query, true);
    const rows = result.rows.map((row) =>
      result.columns.map((c): CsvCell => {
        const v = row[c.key] as CsvCell;
        if (c.type === 'money' && typeof v === 'number') return csvMoney(v);
        if (c.type === 'date' && typeof v === 'string') return new Date(v);
        return v;
      }),
    );
    return toCsv(
      result.columns.map((c) => c.label),
      rows,
    );
  }

  private async registrations(
    created: Prisma.DateTimeFilter | undefined,
    skip: number,
    take: number,
  ) {
    const where: Prisma.UserWhereInput = {
      role: 'STUDENT',
      ...(created ? { createdAt: created } : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          createdAt: true,
          fullName: true,
          phone: true,
          status: true,
          anonymisedAt: true,
          interestLanguage: { select: { name: true } },
        },
      }),
    ]);
    return {
      total,
      summary: [{ label: 'Registrations', value: total, type: 'number' as const }],
      rows: users.map((u) => ({
        date: u.createdAt.toISOString(),
        name: u.fullName,
        // Full phone numbers are never put in a report (BR-ROLE-002).
        phone: u.phone ? maskPhone(u.phone) : null,
        language: u.interestLanguage?.name ?? null,
        status: u.anonymisedAt ? 'Erased' : u.status === 'ACTIVE' ? 'Active' : 'Disabled',
      })),
    };
  }

  private async enrolments(
    created: Prisma.DateTimeFilter | undefined,
    courseId: string | undefined,
    skip: number,
    take: number,
  ) {
    const where: Prisma.EnrolmentWhereInput = {
      ...(created ? { createdAt: created } : {}),
      ...(courseId ? { courseId } : {}),
    };
    const [total, byStatus, rows] = await Promise.all([
      this.prisma.enrolment.count({ where }),
      this.prisma.enrolment.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.enrolment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          status: true,
          startAt: true,
          endAt: true,
          progressPct: true,
          student: { select: { fullName: true } },
          course: { select: { title: true } },
        },
      }),
    ]);
    return {
      total,
      summary: [
        { label: 'Enrolments', value: total, type: 'number' as const },
        ...byStatus.map((s) => ({
          label: STATUS_LABEL[s.status] ?? s.status,
          value: s._count._all,
          type: 'number' as const,
        })),
      ],
      rows: rows.map((r) => ({
        student: r.student.fullName,
        course: r.course.title,
        status: STATUS_LABEL[r.status] ?? r.status,
        startAt: r.startAt?.toISOString() ?? null,
        endAt: r.endAt?.toISOString() ?? null,
        progress: r.progressPct,
      })),
    };
  }

  private async payments(
    created: Prisma.DateTimeFilter | undefined,
    courseId: string | undefined,
    skip: number,
    take: number,
  ) {
    const where: Prisma.PaymentWhereInput = {
      status: 'CONFIRMED',
      ...(created ? { checkedAt: created } : {}),
      ...(courseId ? { enrolment: { courseId } } : {}),
    };
    const [total, sums, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where,
        _sum: { amountSantim: true },
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where,
        orderBy: { checkedAt: 'desc' },
        skip,
        take,
        select: {
          checkedAt: true,
          method: true,
          reference: true,
          amountSantim: true,
          checkedBy: { select: { fullName: true } },
          enrolment: {
            select: {
              student: { select: { fullName: true } },
              course: { select: { title: true } },
            },
          },
        },
      }),
    ]);
    const totalSantim = sums.reduce((sum, s) => sum + (s._sum.amountSantim ?? 0), 0);
    return {
      total,
      summary: [
        { label: 'Confirmed total (ETB)', value: totalSantim, type: 'money' as const },
        { label: 'Payments', value: total, type: 'number' as const },
        ...sums.map((s) => ({
          label: `${METHOD_LABEL[s.method]} (ETB)`,
          value: s._sum.amountSantim ?? 0,
          type: 'money' as const,
        })),
      ],
      rows: rows.map((r) => ({
        date: r.checkedAt?.toISOString() ?? null,
        student: r.enrolment.student.fullName,
        course: r.enrolment.course.title,
        method: METHOD_LABEL[r.method],
        reference: r.reference,
        amount: r.amountSantim,
        checkedBy: r.checkedBy?.fullName ?? null,
      })),
    };
  }

  private async progress(
    created: Prisma.DateTimeFilter | undefined,
    courseId: string | undefined,
    skip: number,
    take: number,
  ) {
    const where: Prisma.EnrolmentWhereInput = {
      status: { in: ['ACTIVE', 'COMPLETED', 'EXPIRED'] },
      ...(created ? { createdAt: created } : {}),
      ...(courseId ? { courseId } : {}),
    };
    const [total, completed, rows] = await Promise.all([
      this.prisma.enrolment.count({ where }),
      this.prisma.enrolment.count({ where: { ...where, status: 'COMPLETED' } }),
      this.prisma.enrolment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          studentId: true,
          courseId: true,
          progressPct: true,
          completedAt: true,
          student: { select: { fullName: true } },
          course: { select: { title: true } },
        },
      }),
    ]);
    const extras = await this.progressExtras(rows);
    return {
      total,
      summary: [
        { label: 'Students in this report', value: total, type: 'number' as const },
        { label: 'Completed', value: completed, type: 'number' as const },
      ],
      rows: rows.map((r) => {
        const x = extras.get(`${r.studentId}:${r.courseId}`);
        return {
          student: r.student.fullName,
          course: r.course.title,
          progress: r.progressPct,
          lessons: x ? `${x.lessonsDone}/${x.lessonsTotal}` : null,
          quizAvg: x?.quizAvgPct ?? null,
          finalPct: x?.finalPct ?? null,
          completedAt: r.completedAt?.toISOString() ?? null,
        };
      }),
    };
  }

  /**
   * Lessons done, average quiz score and final quiz score for students in courses, in a few queries
   * per course rather than per student. "—" (null) means no quiz result yet, not zero (FR-REP-002).
   */
  async progressExtras(
    pairs: { studentId: string; courseId: string }[],
  ): Promise<Map<string, ProgressExtras>> {
    const out = new Map<string, ProgressExtras>();
    const byCourse = new Map<string, string[]>();
    for (const p of pairs)
      byCourse.set(p.courseId, [...(byCourse.get(p.courseId) ?? []), p.studentId]);

    for (const [courseId, studentIds] of byCourse) {
      const lessons = await this.prisma.lesson.findMany({
        where: { courseId, status: 'PUBLISHED', unit: { status: 'PUBLISHED' } },
        select: { id: true },
      });
      const lessonIds = lessons.map((l) => l.id);
      const [done, lessonQuiz, finalQuiz] = await Promise.all([
        lessonIds.length
          ? this.prisma.lessonProgress.groupBy({
              by: ['studentId'],
              where: {
                studentId: { in: studentIds },
                lessonId: { in: lessonIds },
                completedAt: { not: null },
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        this.prisma.quizAttempt.groupBy({
          by: ['studentId'],
          where: {
            studentId: { in: studentIds },
            status: 'GRADED',
            quiz: { courseId, isFinal: false },
          },
          _avg: { scorePct: true },
        }),
        this.prisma.quizAttempt.groupBy({
          by: ['studentId'],
          where: {
            studentId: { in: studentIds },
            status: 'GRADED',
            quiz: { courseId, isFinal: true },
          },
          _max: { scorePct: true },
        }),
      ]);
      const doneBy = new Map(done.map((d) => [d.studentId, d._count._all]));
      const avgBy = new Map(lessonQuiz.map((q) => [q.studentId, q._avg.scorePct]));
      const finalBy = new Map(finalQuiz.map((q) => [q.studentId, q._max.scorePct]));
      for (const studentId of studentIds) {
        const avg = avgBy.get(studentId);
        const fin = finalBy.get(studentId);
        out.set(`${studentId}:${courseId}`, {
          lessonsDone: doneBy.get(studentId) ?? 0,
          lessonsTotal: lessonIds.length,
          quizAvgPct: avg === null || avg === undefined ? null : Math.round(avg),
          finalPct: fin ?? null,
        });
      }
    }
    return out;
  }
}
