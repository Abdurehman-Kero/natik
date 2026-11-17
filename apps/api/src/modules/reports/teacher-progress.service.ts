import { Injectable } from '@nestjs/common';
import { AccessPolicy } from '../../common/access/access-policy';
import { toCsv } from '../../common/csv';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';
import { ReportsService } from './reports.service';

const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: 'Payment needed',
  PAYMENT_SUBMITTED: 'Payment under review',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
};

/**
 * How a teacher's students are doing (FR-TEACH-006). A teacher sees only students of their own
 * courses, and never phone numbers or payments (BR-ROLE-002): the data is simply not selected here.
 */
@Injectable()
export class TeacherProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    private readonly reports: ReportsService,
  ) {}

  private where(courseId: string, q?: string): Prisma.EnrolmentWhereInput {
    return {
      courseId,
      status: { notIn: ['CANCELLED'] },
      ...(q ? { student: { fullName: { contains: q, mode: 'insensitive' } } } : {}),
    };
  }

  private async rows(courseId: string, q: string | undefined, skip: number, take: number) {
    const where = this.where(courseId, q);
    const [total, enrolments] = await Promise.all([
      this.prisma.enrolment.count({ where }),
      this.prisma.enrolment.findMany({
        where,
        orderBy: { student: { fullName: 'asc' } },
        skip,
        take,
        // Deliberately no phone, email or payment fields.
        select: {
          status: true,
          progressPct: true,
          studentId: true,
          courseId: true,
          student: { select: { id: true, fullName: true, lastActiveAt: true } },
        },
      }),
    ]);
    const extras = await this.reports.progressExtras(enrolments);
    return {
      total,
      items: enrolments.map((e) => {
        const x = extras.get(`${e.studentId}:${e.courseId}`);
        return {
          id: e.student.id,
          fullName: e.student.fullName,
          status: e.status,
          progressPct: e.progressPct,
          lessonsDone: x?.lessonsDone ?? 0,
          lessonsTotal: x?.lessonsTotal ?? 0,
          quizAvgPct: x?.quizAvgPct ?? null,
          finalPct: x?.finalPct ?? null,
          lastActiveAt: e.student.lastActiveAt,
        };
      }),
    };
  }

  async students(
    actor: SessionUser,
    courseId: string,
    query: { q?: string; page: number; pageSize: number },
  ) {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const result = await this.rows(
      courseId,
      query.q,
      (query.page - 1) * query.pageSize,
      query.pageSize,
    );
    return { ...result, page: query.page, pageSize: query.pageSize };
  }

  async csv(actor: SessionUser, courseId: string, q?: string): Promise<Buffer> {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const { items } = await this.rows(courseId, q, 0, 20_000);
    return toCsv(
      [
        'Student',
        'Status',
        'Progress %',
        'Lessons done',
        'Average quiz %',
        'Final quiz %',
        'Last active',
      ],
      items.map((s) => [
        s.fullName,
        STATUS_LABEL[s.status] ?? s.status,
        s.progressPct,
        `${s.lessonsDone}/${s.lessonsTotal}`,
        s.quizAvgPct,
        s.finalPct,
        s.lastActiveAt,
      ]),
    );
  }
}
