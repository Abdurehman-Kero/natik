import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  /** e.g. SIGN_IN, SIGN_IN_FAILED, ROLE_CHANGED, USER_DISABLED (FR-REP-003). */
  action: string;
  entityType: string;
  entityId: string;
  /** Never put passwords, codes or full phone numbers in here. */
  details?: Prisma.InputJsonValue;
  ip?: string | null;
}

/** Writes the read-only activity log (the database blocks edits and deletes). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  /** Logging must never break the action being logged, so failures are reported, not thrown. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          details: entry.details,
          ip: entry.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error({ err: error, action: entry.action }, 'Could not write activity log entry');
    }
  }
}
