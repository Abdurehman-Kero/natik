import { HttpStatus, Injectable } from '@nestjs/common';
import { formatPhone } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';

/** The admin inbox for contact-form messages and "report a problem" notes (FR-ADMIN-007). */
@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: { status?: 'NEW' | 'CLOSED'; page: number; pageSize: number }) {
    const where: Prisma.InboxMessageWhereInput = query.status ? { status: query.status } : {};
    const [rows, total, newCount] = await Promise.all([
      this.prisma.inboxMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          closedBy: { select: { fullName: true } },
          lesson: { select: { id: true, title: true } },
        },
      }),
      this.prisma.inboxMessage.count({ where }),
      this.prisma.inboxMessage.count({ where: { status: 'NEW' } }),
    ]);
    return {
      items: rows.map((m) => ({
        id: m.id,
        type: m.type,
        name: m.name,
        phone: m.phone ? formatPhone(m.phone) : null,
        message: m.message,
        status: m.status,
        lesson: m.lesson,
        createdAt: m.createdAt,
        closedAt: m.closedAt,
        closedBy: m.closedBy?.fullName ?? null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      newCount,
    };
  }

  /** How many messages still need an answer (shown on the menu). */
  async newCount(): Promise<number> {
    return this.prisma.inboxMessage.count({ where: { status: 'NEW', seenAt: null } });
  }

  /** The messages on screen have been seen: they stop counting as unread on the menu. */
  async markSeen(ids: string[], all = false): Promise<{ ok: true }> {
    if (all) {
      await this.prisma.inboxMessage.updateMany({
        where: { status: 'NEW', seenAt: null },
        data: { seenAt: new Date() },
      });
    } else if (ids.length > 0) {
      await this.prisma.inboxMessage.updateMany({
        where: { id: { in: ids.slice(0, 100) }, seenAt: null },
        data: { seenAt: new Date() },
      });
    }
    return { ok: true };
  }

  async setStatus(actor: SessionUser, id: string, status: 'NEW' | 'CLOSED') {
    const message = await this.prisma.inboxMessage.findUnique({ where: { id } });
    if (!message) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (message.status !== status) {
      await this.prisma.inboxMessage.update({
        where: { id },
        data:
          status === 'CLOSED'
            ? { status, closedById: actor.id, closedAt: new Date() }
            : { status, closedById: null, closedAt: null },
      });
      await this.audit.record({
        actorId: actor.id,
        action: status === 'CLOSED' ? 'MESSAGE_CLOSED' : 'MESSAGE_REOPENED',
        entityType: 'InboxMessage',
        entityId: id,
      });
    }
    return { id, status };
  }
}
