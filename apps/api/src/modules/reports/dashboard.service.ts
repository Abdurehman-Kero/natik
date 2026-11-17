import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';
import { MarkingService } from '../quizzes/marking.service';

const CACHE_MS = 60_000;

/** The admin's "what needs me today?" figures (FR-ADMIN-001) and the teacher's home (FR-TEACH-001). */
@Injectable()
export class DashboardService {
  private cached: { at: number; data: unknown } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly marking: MarkingService,
  ) {}

  /** Counted fresh every minute, not on every page view, so a busy dashboard stays cheap. */
  async admin(now = Date.now()) {
    if (this.cached && now - this.cached.at < CACHE_MS) return this.cached.data;
    const weekAgo = new Date(now - 7 * 86_400_000);
    const [students, newThisWeek, paymentsToCheck, newMessages, active] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT', anonymisedAt: null } }),
      this.prisma.user.count({ where: { role: 'STUDENT', createdAt: { gte: weekAgo } } }),
      this.prisma.payment.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.inboxMessage.count({ where: { status: 'NEW' } }),
      this.prisma.enrolment.groupBy({
        by: ['courseId'],
        where: { status: 'ACTIVE' },
        _count: { _all: true },
        orderBy: { _count: { courseId: 'desc' } },
        take: 8,
      }),
    ]);
    const courses = await this.prisma.course.findMany({
      where: { id: { in: active.map((a) => a.courseId) } },
      select: { id: true, title: true },
    });
    const title = new Map(courses.map((c) => [c.id, c.title]));
    const data = {
      students,
      newThisWeek,
      paymentsToCheck,
      newMessages,
      activeByCourse: active.map((a) => ({
        courseId: a.courseId,
        title: title.get(a.courseId) ?? '',
        count: a._count._all,
      })),
    };
    this.cached = { at: now, data };
    return data;
  }

  /** The teacher's courses with student counts, and how many answers wait for a mark. */
  async teacher(actor: SessionUser) {
    const where =
      actor.role === 'ADMIN'
        ? { status: { not: 'DRAFT' as const } }
        : { teachers: { some: { teacherId: actor.id } } };
    const [courses, toMark] = await Promise.all([
      this.prisma.course.findMany({
        where,
        select: { id: true },
      }),
      this.marking.count(actor),
    ]);
    const ids = courses.map((c) => c.id);
    const students = ids.length
      ? await this.prisma.enrolment.findMany({
          where: { courseId: { in: ids }, status: { not: 'CANCELLED' } },
          distinct: ['studentId'],
          select: { studentId: true },
        })
      : [];
    return { courseCount: ids.length, studentCount: students.length, toMark: toMark.count };
  }
}
