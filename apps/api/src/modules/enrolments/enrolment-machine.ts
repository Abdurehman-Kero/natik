import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { EnrolmentStatus, Prisma } from '../../generated/prisma/client';
import { type AuditEntry, AuditService } from '../audit/audit.service';
import { canTransition, type EnrolmentState } from './enrolment-rules';

export type Tx = Prisma.TransactionClient;

export interface MoveInput {
  enrolmentId: string;
  from: EnrolmentState;
  to: EnrolmentStatus;
  actorId?: string | null;
  reason?: string | null;
  /** Other columns to change in the same step (access dates, completion time). */
  data?: Prisma.EnrolmentUpdateManyMutationInput;
}

/**
 * The only place an enrolment's status changes (ARCHITECTURE §6). A move is refused unless it is in
 * the table, and it only applies if the enrolment is still in the status the caller saw, so two
 * admins (or a student and a job) can never both win. Every move writes the history row; the caller
 * records the returned activity-log entry once its transaction has committed.
 */
@Injectable()
export class EnrolmentMachine {
  constructor(private readonly audit: AuditService) {}

  async move(tx: Tx, input: MoveInput): Promise<AuditEntry> {
    const { enrolmentId, from, to } = input;
    if (from === 'NEW' || !canTransition(from, to)) {
      throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT);
    }
    const changed = await tx.enrolment.updateMany({
      where: { id: enrolmentId, status: from },
      data: { ...input.data, status: to, statusChangedAt: new Date() },
    });
    if (changed.count !== 1) throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT);
    return this.writeHistory(tx, input);
  }

  /** Starts a brand-new enrolment: ACTIVE for free courses, AWAITING_PAYMENT for paid ones. */
  async create(
    tx: Tx,
    input: {
      branchId: string;
      studentId: string;
      courseId: string;
      to: Extract<EnrolmentStatus, 'ACTIVE' | 'AWAITING_PAYMENT'>;
      actorId?: string | null;
      reason?: string | null;
      startAt?: Date | null;
      endAt?: Date | null;
    },
  ) {
    const enrolment = await tx.enrolment.create({
      data: {
        branchId: input.branchId,
        studentId: input.studentId,
        courseId: input.courseId,
        status: input.to,
        startAt: input.startAt ?? null,
        endAt: input.endAt ?? null,
      },
    });
    const entry = await this.writeHistory(tx, {
      enrolmentId: enrolment.id,
      from: 'NEW',
      to: input.to,
      actorId: input.actorId,
      reason: input.reason,
    });
    return { enrolment, entry };
  }

  private async writeHistory(tx: Tx, input: MoveInput): Promise<AuditEntry> {
    await tx.enrolmentEvent.create({
      data: {
        enrolmentId: input.enrolmentId,
        fromStatus: input.from === 'NEW' ? null : input.from,
        toStatus: input.to,
        actorId: input.actorId ?? null,
        reason: input.reason ?? null,
      },
    });
    return {
      actorId: input.actorId ?? null,
      action: `ENROLMENT_${input.to}`,
      entityType: 'Enrolment',
      entityId: input.enrolmentId,
      details: {
        from: input.from,
        to: input.to,
        ...(input.reason ? { reason: input.reason } : {}),
      },
    };
  }

  async record(entries: AuditEntry[]): Promise<void> {
    for (const entry of entries) await this.audit.record(entry);
  }
}
