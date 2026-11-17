import { HttpStatus, Injectable } from '@nestjs/common';
import type { ActivityGroup } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Which recorded actions belong to which filter (FR-REP-003). Anything unlisted is "Other". */
const GROUPS: Record<Exclude<ActivityGroup, 'OTHER'>, Prisma.AuditLogWhereInput[]> = {
  SIGN_IN: [{ action: { in: ['SIGN_IN', 'SIGN_IN_FAILED'] } }],
  ACCOUNTS: [
    { action: { startsWith: 'ACCOUNT_' } },
    { action: { startsWith: 'USER_' } },
    { action: { startsWith: 'ROLE_' } },
    { action: { startsWith: 'ADMIN_' } },
    { action: { startsWith: 'PASSWORD_' } },
  ],
  ENROLMENTS: [{ action: { startsWith: 'ENROLMENT_' } }, { action: { startsWith: 'ATTEMPT_' } }],
  PAYMENTS: [{ action: { startsWith: 'PAYMENT_' } }],
  MARKS: [{ action: { in: ['MARK_CHANGED', 'ANSWER_MARKED'] } }],
  CERTIFICATES: [{ action: { startsWith: 'CERTIFICATE_' } }],
  COURSES: [
    { action: { startsWith: 'COURSE_' } },
    { action: { startsWith: 'QUIZ_' } },
    { action: { startsWith: 'LESSON_' } },
    { action: { startsWith: 'UNIT_' } },
    { action: { startsWith: 'BLOCK_' } },
    { action: { startsWith: 'VIDEO_' } },
    { action: { startsWith: 'LANGUAGE_' } },
    { action: { startsWith: 'LEVEL_' } },
  ],
};

function groupWhere(group: ActivityGroup): Prisma.AuditLogWhereInput {
  if (group !== 'OTHER') return { OR: GROUPS[group] };
  return { NOT: { OR: Object.values(GROUPS).flat() } };
}

const range = (from?: string, to?: string): Prisma.DateTimeFilter | undefined =>
  from || to
    ? {
        ...(from ? { gte: new Date(`${from}T00:00:00+03:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999+03:00`) } : {}),
      }
    : undefined;

/** The read-only activity log (FR-REP-004). The database refuses any edit or delete of its rows. */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    group?: ActivityGroup;
    actorId?: string;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }) {
    const createdAt = range(query.from, query.to);
    const where: Prisma.AuditLogWhereInput = {
      AND: [
        query.group ? groupWhere(query.group) : {},
        query.actorId ? { actorId: query.actorId } : {},
        createdAt ? { createdAt } : {},
      ],
    };
    const [total, rows, staff] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'TEACHER'] } },
        orderBy: { fullName: 'asc' },
        select: { id: true, fullName: true },
        take: 200,
      }),
    ]);
    const actors = await this.actorNames(rows.map((r) => r.actorId));
    const subjects = await this.subjects(rows);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      actors: staff,
      items: rows.map((r) => ({
        id: String(r.id),
        createdAt: r.createdAt,
        action: r.action,
        actor: r.actorId ? { id: r.actorId, name: actors.get(r.actorId) ?? null } : null,
        subject: subjects.get(`${r.entityType}:${r.entityId}`) ?? null,
        entityType: r.entityType,
      })),
    };
  }

  async detail(id: string) {
    if (!/^\d{1,18}$/.test(id)) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const row = await this.prisma.auditLog.findUnique({ where: { id: BigInt(id) } });
    if (!row) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const actors = await this.actorNames([row.actorId]);
    const subjects = await this.subjects([row]);
    return {
      id: String(row.id),
      createdAt: row.createdAt,
      action: row.action,
      actor: row.actorId ? { id: row.actorId, name: actors.get(row.actorId) ?? null } : null,
      entityType: row.entityType,
      entityId: row.entityId,
      subject: subjects.get(`${row.entityType}:${row.entityId}`) ?? null,
      // Never contains passwords, codes or full phone numbers (see AuditService).
      details: row.details,
      ip: row.ip,
    };
  }

  private async actorNames(ids: (string | null)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((i): i is string => !!i))];
    if (unique.length === 0) return new Map();
    const users = await this.prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  /** A short "who/what it was about" for common record types, so a row reads without opening it. */
  private async subjects(rows: { entityType: string; entityId: string }[]) {
    const ids = (type: string) => [
      ...new Set(rows.filter((r) => r.entityType === type).map((r) => r.entityId)),
    ];
    const out = new Map<string, string>();
    const [users, payments, enrolments, certificates, courses] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids('User') } },
        select: { id: true, fullName: true },
      }),
      this.prisma.payment.findMany({
        where: { id: { in: ids('Payment') } },
        select: {
          id: true,
          enrolment: {
            select: {
              student: { select: { fullName: true } },
              course: { select: { title: true } },
            },
          },
        },
      }),
      this.prisma.enrolment.findMany({
        where: { id: { in: ids('Enrolment') } },
        select: {
          id: true,
          student: { select: { fullName: true } },
          course: { select: { title: true } },
        },
      }),
      this.prisma.certificate.findMany({
        where: { id: { in: ids('Certificate') } },
        select: { id: true, number: true, studentNameSnapshot: true },
      }),
      this.prisma.course.findMany({
        where: { id: { in: ids('Course') } },
        select: { id: true, title: true },
      }),
    ]);
    for (const u of users) out.set(`User:${u.id}`, u.fullName);
    for (const p of payments) {
      out.set(`Payment:${p.id}`, `${p.enrolment.student.fullName} · ${p.enrolment.course.title}`);
    }
    for (const e of enrolments)
      out.set(`Enrolment:${e.id}`, `${e.student.fullName} · ${e.course.title}`);
    for (const c of certificates)
      out.set(`Certificate:${c.id}`, `${c.studentNameSnapshot} · ${c.number}`);
    for (const c of courses) out.set(`Course:${c.id}`, c.title);
    return out;
  }
}
