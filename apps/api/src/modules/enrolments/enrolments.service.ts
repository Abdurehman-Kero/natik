import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { formatDate } from '@natik/shared';
import type { AuditEntry } from '../audit/audit.service';
import { AccessPolicy } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';
import { SmsService } from '../notifications/sms/sms.service';
import { EnrolmentMachine, type Tx } from './enrolment-machine';
import { accessEnd, REMINDER_DAYS, UNPAID_DAYS } from './enrolment-rules';
import { ProgressService } from './progress.service';

const enrolmentSelect = {
  id: true,
  courseId: true,
  studentId: true,
  status: true,
  startAt: true,
  endAt: true,
  completedAt: true,
  progressPct: true,
  lastLessonId: true,
  statusChangedAt: true,
} satisfies Prisma.EnrolmentSelect;

export type EnrolmentRow = Prisma.EnrolmentGetPayload<{ select: typeof enrolmentSelect }>;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/** Short enough to keep an SMS to one message. */
export function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Enrolment commands (FR-ENR). Students enrol themselves; admins enrol, extend, renew and cancel.
 * Status changes always go through EnrolmentMachine.
 */
@Injectable()
export class EnrolmentsService {
  private readonly logger = new Logger('Enrolments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly machine: EnrolmentMachine,
    private readonly progress: ProgressService,
    private readonly sms: SmsService,
    private readonly access: AccessPolicy,
  ) {}

  // ── Students ──────────────────────────────────────────────────────────

  /**
   * "Enrol free" / "Pay and enrol". Tapping again returns the same enrolment instead of making
   * another (FR-ENR-002). Registration alone gives access to nothing (FR-ENR-004).
   */
  async enrol(student: SessionUser, courseId: string) {
    if (student.role !== 'STUDENT') throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, status: 'PUBLISHED' },
      select: { id: true, branchId: true, access: true, priceSantim: true, accessDays: true },
    });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);

    const existing = await this.latestFor(student.id, course.id);
    if (existing && existing.status !== 'CANCELLED') return this.view(existing);

    const free = course.access === 'FREE' || !course.priceSantim;
    try {
      const now = new Date();
      const { enrolment, entry } = await this.prisma.$transaction((tx) =>
        this.machine.create(tx, {
          branchId: course.branchId,
          studentId: student.id,
          courseId: course.id,
          to: free ? 'ACTIVE' : 'AWAITING_PAYMENT',
          actorId: student.id,
          startAt: free ? now : null,
          endAt: free ? accessEnd(now, course.accessDays) : null,
        }),
      );
      await this.machine.record([entry]);
      if (free) await this.progress.recalcEnrolment(enrolment.id);
      return this.view(await this.mustFind(enrolment.id));
    } catch (error) {
      // Two taps at once: the second one finds the first one's enrolment.
      if (isUniqueViolation(error)) {
        const again = await this.latestFor(student.id, course.id);
        if (again) return this.view(again);
      }
      throw error;
    }
  }

  /**
   * Renew after access ended. Free courses reopen straight away (Q4). Paid ones need a renewal
   * payment, so the student is told to pay; the enrolment stays EXPIRED until an admin confirms it.
   */
  async renew(actor: SessionUser, enrolmentId: string) {
    const enrolment = await this.findManaged(actor, enrolmentId);
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: enrolment.courseId },
      select: { access: true, priceSantim: true, accessDays: true, title: true },
    });
    const paid = course.access === 'PAID' && !!course.priceSantim;

    const lapsed =
      enrolment.status === 'EXPIRED' ||
      (enrolment.status === 'COMPLETED' && !!enrolment.endAt && enrolment.endAt < new Date());
    if (!lapsed) throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT);

    if (actor.role === 'STUDENT' && paid) {
      return { ...this.view(enrolment), needsPayment: true as const };
    }

    const now = new Date();
    const dates = {
      startAt: now,
      endAt: accessEnd(now, course.accessDays),
      expiryReminderSentAt: null,
    };
    let entry: AuditEntry;
    if (enrolment.status === 'EXPIRED') {
      entry = await this.prisma.$transaction((tx) =>
        this.machine.move(tx, {
          enrolmentId,
          from: 'EXPIRED',
          to: 'ACTIVE',
          actorId: actor.id,
          reason: 'Renewed',
          data: dates,
        }),
      );
    } else {
      // A finished course whose access ran out: new dates, still COMPLETED.
      await this.prisma.enrolment.update({ where: { id: enrolmentId }, data: dates });
      entry = {
        actorId: actor.id,
        action: 'ENROLMENT_RENEWED',
        entityType: 'Enrolment',
        entityId: enrolmentId,
      };
    }
    await this.machine.record([entry]);
    return { ...this.view(await this.mustFind(enrolmentId)), needsPayment: false as const };
  }

  /** What a signed-in person sees on a course page: their enrolment, or the editor link for staff. */
  async stateForCourse(user: SessionUser, slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const canEdit = await this.access.canEditCourseContent(user, course.id);
    if (course.status !== 'PUBLISHED' && !canEdit) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (user.role !== 'STUDENT') return { courseId: course.id, canEdit, enrolment: null };

    const enrolment = await this.latestFor(user.id, course.id);
    if (!enrolment || enrolment.status === 'CANCELLED') {
      return { courseId: course.id, canEdit, enrolment: null };
    }
    const reviewing = await this.prisma.payment.count({
      where: { enrolmentId: enrolment.id, status: 'SUBMITTED' },
    });
    return {
      courseId: course.id,
      canEdit,
      enrolment: {
        ...this.view(enrolment),
        paymentUnderReview: reviewing > 0,
        continueLessonId: ['ACTIVE', 'COMPLETED'].includes(enrolment.status)
          ? await this.progress.continueLessonId(enrolment)
          : null,
      },
    };
  }

  // ── Admins ────────────────────────────────────────────────────────────

  /** Admin enrols a student directly, without payment (FR-ADMIN-006). */
  async adminEnrol(actor: SessionUser, studentId: string, courseId: string) {
    const [student, course] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: studentId, role: 'STUDENT', status: 'ACTIVE' },
        select: { id: true },
      }),
      this.prisma.course.findFirst({
        where: { id: courseId, status: 'PUBLISHED' },
        select: { id: true, branchId: true, accessDays: true },
      }),
    ]);
    if (!student || !course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);

    const existing = await this.latestFor(student.id, course.id);
    if (existing && existing.status !== 'CANCELLED') {
      throw new AppException('ALREADY_ENROLLED', HttpStatus.CONFLICT);
    }
    const now = new Date();
    try {
      const { enrolment, entry } = await this.prisma.$transaction((tx) =>
        this.machine.create(tx, {
          branchId: course.branchId,
          studentId: student.id,
          courseId: course.id,
          to: 'ACTIVE',
          actorId: actor.id,
          reason: 'Enrolled by admin',
          startAt: now,
          endAt: accessEnd(now, course.accessDays),
        }),
      );
      await this.machine.record([entry]);
      await this.progress.recalcEnrolment(enrolment.id);
      return this.view(await this.mustFind(enrolment.id));
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppException('ALREADY_ENROLLED', HttpStatus.CONFLICT);
      throw error;
    }
  }

  /** Adds days to the end date (FR-ADMIN-008). Unlimited access has nothing to extend. */
  async extend(actor: SessionUser, enrolmentId: string, days: number) {
    const enrolment = await this.mustFind(enrolmentId);
    if (!['ACTIVE', 'COMPLETED'].includes(enrolment.status) || !enrolment.endAt) {
      throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT, {
        message: !enrolment.endAt
          ? 'This enrolment has no end date, so there is nothing to extend.'
          : undefined,
      });
    }
    const endAt = new Date(enrolment.endAt.getTime() + days * 86_400_000);
    await this.prisma.enrolment.update({
      where: { id: enrolmentId },
      // A new end date means the 3-day reminder is due again.
      data: { endAt, expiryReminderSentAt: null },
    });
    await this.machine.record([
      {
        actorId: actor.id,
        action: 'ENROLMENT_EXTENDED',
        entityType: 'Enrolment',
        entityId: enrolmentId,
        details: { days, endAt: endAt.toISOString() },
      },
    ]);
    return this.view(await this.mustFind(enrolmentId));
  }

  /** Cancels with a reason. Progress and results are kept (FR-ENR-009). */
  async cancel(actor: SessionUser, enrolmentId: string, reason: string) {
    const enrolment = await this.mustFind(enrolmentId);
    const entries = await this.prisma.$transaction(async (tx) => {
      const entry = await this.machine.move(tx, {
        enrolmentId,
        from: enrolment.status,
        to: 'CANCELLED',
        actorId: actor.id,
        reason,
      });
      // A payment waiting to be checked would otherwise stay in the admin queue forever.
      await tx.payment.updateMany({
        where: { enrolmentId, status: 'SUBMITTED' },
        data: {
          status: 'REJECTED',
          rejectionReason: 'Enrolment cancelled',
          checkedById: actor.id,
          checkedAt: new Date(),
        },
      });
      return [entry];
    });
    await this.machine.record(entries);
    return this.view(await this.mustFind(enrolmentId));
  }

  /** Enrolments by course or student, newest first. */
  async adminList(query: {
    courseId?: string;
    studentId?: string;
    status?: EnrolmentRow['status'];
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.EnrolmentWhereInput = {
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.enrolment.count({ where }),
      this.prisma.enrolment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          ...enrolmentSelect,
          createdAt: true,
          student: { select: { id: true, fullName: true, phone: true } },
          course: { select: { id: true, title: true, slug: true, access: true } },
        },
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: rows.map((r) => ({
        ...this.view(r),
        createdAt: r.createdAt,
        student: r.student,
        course: r.course,
      })),
    };
  }

  /** Finds students by name or phone, for the "enrol student" and "record cash" dialogs. */
  async searchStudents(q: string) {
    const digits = q.replace(/\D/g, '');
    const students = await this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        status: 'ACTIVE',
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits.slice(-9) } }] : []),
        ],
      },
      orderBy: { fullName: 'asc' },
      take: 8,
      select: { id: true, fullName: true, phone: true },
    });
    return { items: students };
  }

  // ── Activation (used by payments) ─────────────────────────────────────

  /** Opens access from today for the course's access period. Runs inside the caller's transaction. */
  async activate(
    tx: Tx,
    enrolment: Pick<EnrolmentRow, 'id' | 'status' | 'courseId'>,
    actorId: string,
    reason: string,
  ): Promise<AuditEntry> {
    const course = await tx.course.findUniqueOrThrow({
      where: { id: enrolment.courseId },
      select: { accessDays: true },
    });
    const now = new Date();
    return this.machine.move(tx, {
      enrolmentId: enrolment.id,
      from: enrolment.status,
      to: 'ACTIVE',
      actorId,
      reason,
      data: { startAt: now, endAt: accessEnd(now, course.accessDays), expiryReminderSentAt: null },
    });
  }

  // ── Scheduled jobs (ARCHITECTURE §11). `now` is a parameter so tests can move the clock. ──────

  /** Waiting for payment for 7 days → cancelled. Returns how many were cancelled. */
  async cancelUnpaid(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - UNPAID_DAYS * 86_400_000);
    const stale = await this.prisma.enrolment.findMany({
      where: { status: 'AWAITING_PAYMENT', statusChangedAt: { lt: cutoff } },
      select: { id: true },
      take: 500,
    });
    let cancelled = 0;
    for (const { id } of stale) {
      try {
        const entry = await this.prisma.$transaction((tx) =>
          this.machine.move(tx, {
            enrolmentId: id,
            from: 'AWAITING_PAYMENT',
            to: 'CANCELLED',
            reason: `No payment within ${UNPAID_DAYS} days`,
          }),
        );
        await this.machine.record([entry]);
        cancelled++;
      } catch {
        // Paid at the same moment: leave it alone.
      }
    }
    return cancelled;
  }

  /** Access that ran past its end date → expired. */
  async expireDue(now = new Date()): Promise<number> {
    const due = await this.prisma.enrolment.findMany({
      where: { status: 'ACTIVE', endAt: { lt: now } },
      select: { id: true },
      take: 1000,
    });
    let expired = 0;
    for (const { id } of due) {
      try {
        const entry = await this.prisma.$transaction((tx) =>
          this.machine.move(tx, {
            enrolmentId: id,
            from: 'ACTIVE',
            to: 'EXPIRED',
            reason: 'Access period ended',
          }),
        );
        await this.machine.record([entry]);
        expired++;
      } catch {
        // Renewed or cancelled at the same moment.
      }
    }
    return expired;
  }

  /** One SMS, 3 days before access ends (FR-ENR-008). Marked as sent so it is never repeated. */
  async remindExpiring(now = new Date()): Promise<number> {
    const soon = new Date(now.getTime() + REMINDER_DAYS * 86_400_000);
    const due = await this.prisma.enrolment.findMany({
      where: {
        status: { in: ['ACTIVE', 'COMPLETED'] },
        endAt: { gt: now, lte: soon },
        expiryReminderSentAt: null,
      },
      take: 1000,
      select: {
        id: true,
        endAt: true,
        student: { select: { phone: true } },
        course: { select: { title: true } },
      },
    });
    let sent = 0;
    for (const item of due) {
      // Claim it first, so a second run (or a second worker) can't send it twice.
      const claimed = await this.prisma.enrolment.updateMany({
        where: { id: item.id, expiryReminderSentAt: null },
        data: { expiryReminderSentAt: now },
      });
      if (claimed.count !== 1) continue;
      if (item.student.phone && item.endAt) {
        await this.sms.send(item.student.phone, 'access.expiring', {
          course: shorten(item.course.title, 40),
          date: formatDate(item.endAt),
        });
        sent++;
      }
    }
    if (sent) this.logger.log(`Sent ${sent} expiry reminder(s)`);
    return sent;
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  view(e: EnrolmentRow) {
    return {
      id: e.id,
      courseId: e.courseId,
      status: e.status,
      startAt: e.startAt,
      endAt: e.endAt,
      completedAt: e.completedAt,
      progressPct: e.progressPct,
    };
  }

  private latestFor(studentId: string, courseId: string): Promise<EnrolmentRow | null> {
    return this.prisma.enrolment.findFirst({
      where: { studentId, courseId },
      orderBy: { createdAt: 'desc' },
      select: enrolmentSelect,
    });
  }

  private async mustFind(id: string): Promise<EnrolmentRow> {
    const enrolment = await this.prisma.enrolment.findUnique({
      where: { id },
      select: enrolmentSelect,
    });
    if (!enrolment) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return enrolment;
  }

  /** Admins reach any enrolment; a student reaches only their own, and other IDs look like "not found". */
  private async findManaged(actor: SessionUser, id: string): Promise<EnrolmentRow> {
    const enrolment = await this.mustFind(id);
    if (actor.role === 'ADMIN') return enrolment;
    if (actor.role === 'STUDENT' && enrolment.studentId === actor.id) return enrolment;
    throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
