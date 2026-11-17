import { HttpStatus, Injectable } from '@nestjs/common';
import type { CashPaymentInput, PaymentSubmitInput } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { createId } from '../../common/security/ids';
import { RateLimiter } from '../../common/security/rate-limiter';
import { ImageService } from '../../common/storage/image.service';
import { StorageService } from '../../common/storage/storage.service';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditEntry } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';
import { detectFile } from '../content/file-types';
import { accessEnd } from '../enrolments/enrolment-rules';
import { EnrolmentMachine } from '../enrolments/enrolment-machine';
import { EnrolmentsService, shorten } from '../enrolments/enrolments.service';
import { ProgressService } from '../enrolments/progress.service';
import { SmsService } from '../notifications/sms/sms.service';
import { PaymentAccountsService } from './payment-accounts.service';

const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** Trim, upper-case, no spaces: "ft 2431 xyz" and "FT2431XYZ" are the same reference (FR-PAY-003). */
export function normalizeReference(reference: string): string {
  return reference.replace(/\s+/g, '').toUpperCase();
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const paymentRow = {
  id: true,
  kind: true,
  method: true,
  reference: true,
  amountSantim: true,
  expectedSantim: true,
  paidOn: true,
  status: true,
  rejectionReason: true,
  receiptFileId: true,
  createdAt: true,
  checkedAt: true,
  enrolment: {
    select: {
      id: true,
      status: true,
      student: { select: { id: true, fullName: true, phone: true } },
      course: { select: { id: true, title: true, slug: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof paymentRow }>;

/**
 * Manual payments (FR-PAY). Nothing a student sends opens access: only an admin's confirmation (or a
 * cash payment an admin records) does (FR-PAY-006). No card numbers or PINs are asked for or kept.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machine: EnrolmentMachine,
    private readonly enrolments: EnrolmentsService,
    private readonly progress: ProgressService,
    private readonly accounts: PaymentAccountsService,
    private readonly sms: SmsService,
    private readonly images: ImageService,
    private readonly storage: StorageService,
    private readonly limiter: RateLimiter,
  ) {}

  // ── Student ───────────────────────────────────────────────────────────

  /** Everything the payment screen needs: the amount, where to pay, and where the payment stands. */
  async info(student: SessionUser, enrolmentId: string) {
    const enrolment = await this.ownEnrolment(student, enrolmentId);
    const [accounts, reviewing, lastRejected] = await Promise.all([
      this.accounts.active(),
      this.prisma.payment.findFirst({
        where: { enrolmentId, status: 'SUBMITTED' },
        select: { id: true, createdAt: true, reference: true, amountSantim: true },
      }),
      this.prisma.payment.findFirst({
        where: { enrolmentId, status: 'REJECTED' },
        orderBy: { checkedAt: 'desc' },
        select: { rejectionReason: true, checkedAt: true },
      }),
    ]);
    const kind = enrolment.status === 'EXPIRED' ? 'RENEWAL' : 'NEW';
    const canSubmit =
      !reviewing && (enrolment.status === 'AWAITING_PAYMENT' || enrolment.status === 'EXPIRED');
    return {
      enrolment: { id: enrolment.id, status: enrolment.status },
      course: enrolment.course,
      kind,
      canSubmit,
      underReview: reviewing,
      // Shown once, so the student knows what to fix before trying again.
      lastRejection: lastRejected && enrolment.status !== 'PAYMENT_SUBMITTED' ? lastRejected : null,
      accounts,
    };
  }

  async submit(
    student: SessionUser,
    enrolmentId: string,
    input: PaymentSubmitInput,
    receipt?: { buffer: Buffer; originalname: string },
  ) {
    await this.limiter.assert(`pay-submit:${student.id}`, 10, 3600);
    const enrolment = await this.ownEnrolment(student, enrolmentId);
    const kind = enrolment.status === 'EXPIRED' ? 'RENEWAL' : 'NEW';
    if (enrolment.status !== 'AWAITING_PAYMENT' && enrolment.status !== 'EXPIRED') {
      throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT);
    }
    if (!enrolment.course.priceSantim) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);
    }
    const pending = await this.prisma.payment.count({
      where: { enrolmentId, status: 'SUBMITTED' },
    });
    if (pending > 0) throw new AppException('ENROLMENT_NOT_ALLOWED', HttpStatus.CONFLICT);

    const referenceNorm = normalizeReference(input.reference);
    await this.assertReferenceFree(referenceNorm);

    const receiptFileId = receipt ? await this.storeReceipt(student, receipt) : null;
    try {
      const { payment, entries } = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            branchId: enrolment.branchId,
            enrolmentId,
            kind,
            method: input.method,
            reference: input.reference,
            referenceNorm,
            amountSantim: input.amount,
            expectedSantim: enrolment.course.priceSantim!,
            paidOn: new Date(`${input.paidOn}T00:00:00Z`),
            receiptFileId,
            submittedById: student.id,
          },
          select: { id: true, createdAt: true },
        });
        const list: AuditEntry[] = [
          {
            actorId: student.id,
            action: 'PAYMENT_SUBMITTED',
            entityType: 'Payment',
            entityId: created.id,
            details: { kind, method: input.method },
          },
        ];
        if (kind === 'NEW') {
          list.push(
            await this.machine.move(tx, {
              enrolmentId,
              from: 'AWAITING_PAYMENT',
              to: 'PAYMENT_SUBMITTED',
              actorId: student.id,
            }),
          );
        }
        return { payment: created, entries: list };
      });
      await this.machine.record(entries);
      return { id: payment.id, status: 'SUBMITTED' as const, submittedAt: payment.createdAt };
    } catch (error) {
      if (receiptFileId) await this.discardReceipt(receiptFileId);
      if (isUniqueViolation(error)) {
        throw new AppException('PAYMENT_REFERENCE_DUPLICATE', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  /** The student's own payment history (FR-PAY-008). */
  async mine(student: SessionUser) {
    const rows = await this.prisma.payment.findMany({
      where: { enrolment: { studentId: student.id } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: paymentRow,
    });
    return { items: rows.map((r) => this.studentView(r)) };
  }

  // ── Admin ─────────────────────────────────────────────────────────────

  async adminList(query: {
    status: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.PaymentWhereInput = { status: query.status };
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        // Oldest first for the queue, so nobody waits longest; newest first for history.
        orderBy: { createdAt: query.status === 'SUBMITTED' ? 'asc' : 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { ...paymentRow, checkedBy: { select: { fullName: true } } },
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: rows.map((r) => ({
        ...this.adminView(r),
        checkedBy: r.checkedBy?.fullName ?? null,
      })),
    };
  }

  async pendingCount(): Promise<{ count: number }> {
    return { count: await this.prisma.payment.count({ where: { status: 'SUBMITTED' } }) };
  }

  /** Confirms a payment and opens the course. Only one admin can win (FR-PAY-005). */
  async confirm(admin: SessionUser, paymentId: string) {
    const payment = await this.mustFindForCheck(paymentId);
    const entries = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: 'SUBMITTED' },
        data: { status: 'CONFIRMED', checkedById: admin.id, checkedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new AppException('PAYMENT_ALREADY_CHECKED', HttpStatus.CONFLICT);
      }
      const enrolment = await tx.enrolment.findUniqueOrThrow({
        where: { id: payment.enrolment.id },
        select: { id: true, status: true, courseId: true },
      });
      const opened = await this.enrolments.activate(tx, enrolment, admin.id, 'Payment confirmed');
      return [
        {
          actorId: admin.id,
          action: 'PAYMENT_CONFIRMED',
          entityType: 'Payment',
          entityId: paymentId,
          details: { amountSantim: payment.amountSantim },
        } satisfies AuditEntry,
        opened,
      ];
    });
    await this.machine.record(entries);
    await this.progress.recalcEnrolment(payment.enrolment.id);
    await this.notifyConfirmed(payment.enrolment.student.phone, payment.enrolment.course.title);
    return { id: paymentId, status: 'CONFIRMED' as const };
  }

  /** Rejects with a reason. The student can try again; the 7-day timer restarts (Q5). */
  async reject(admin: SessionUser, paymentId: string, reason: string) {
    const payment = await this.mustFindForCheck(paymentId);
    const entries = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: { id: paymentId, status: 'SUBMITTED' },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
          checkedById: admin.id,
          checkedAt: new Date(),
        },
      });
      if (claimed.count !== 1) {
        throw new AppException('PAYMENT_ALREADY_CHECKED', HttpStatus.CONFLICT);
      }
      const list: AuditEntry[] = [
        {
          actorId: admin.id,
          action: 'PAYMENT_REJECTED',
          entityType: 'Payment',
          entityId: paymentId,
          details: { reason },
        },
      ];
      // A renewal payment leaves the enrolment EXPIRED; a first payment goes back to "awaiting".
      if (payment.kind === 'NEW') {
        list.push(
          await this.machine.move(tx, {
            enrolmentId: payment.enrolment.id,
            from: 'PAYMENT_SUBMITTED',
            to: 'AWAITING_PAYMENT',
            actorId: admin.id,
            reason,
          }),
        );
      }
      return list;
    });
    await this.machine.record(entries);
    if (payment.enrolment.student.phone) {
      await this.sms.send(payment.enrolment.student.phone, 'payment.rejected', {
        course: shorten(payment.enrolment.course.title, 35),
        reason: shorten(reason, 50),
      });
    }
    return { id: paymentId, status: 'REJECTED' as const };
  }

  /** Money received at the centre: recorded as confirmed and opens access straight away (FR-PAY-007). */
  async cash(admin: SessionUser, input: CashPaymentInput) {
    const [student, course] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: input.studentId, role: 'STUDENT', status: 'ACTIVE' },
        select: { id: true, phone: true },
      }),
      this.prisma.course.findFirst({
        where: { id: input.courseId, status: 'PUBLISHED' },
        select: {
          id: true,
          branchId: true,
          title: true,
          access: true,
          priceSantim: true,
          accessDays: true,
        },
      }),
    ]);
    if (!student || !course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (course.access !== 'PAID' || !course.priceSantim) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'This course is free, so there is nothing to pay.',
      });
    }
    const reference = input.reference?.trim() || null;
    const referenceNorm = reference ? normalizeReference(reference) : null;
    if (referenceNorm) await this.assertReferenceFree(referenceNorm);

    try {
      const { paymentId, entries, enrolmentId } = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.enrolment.findFirst({
          where: { studentId: student.id, courseId: course.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, courseId: true },
        });
        const list: AuditEntry[] = [];
        let id: string;
        let kind: 'NEW' | 'RENEWAL' = 'NEW';

        if (!existing || existing.status === 'CANCELLED') {
          const now = new Date();
          const created = await this.machine.create(tx, {
            branchId: course.branchId,
            studentId: student.id,
            courseId: course.id,
            to: 'ACTIVE',
            actorId: admin.id,
            reason: 'Cash payment',
            startAt: now,
            endAt: accessEnd(now, course.accessDays),
          });
          id = created.enrolment.id;
          list.push(created.entry);
        } else if (['AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'EXPIRED'].includes(existing.status)) {
          id = existing.id;
          if (existing.status === 'EXPIRED') kind = 'RENEWAL';
          list.push(await this.enrolments.activate(tx, existing, admin.id, 'Cash payment'));
          // Anything the student had sent for checking is now settled by the cash payment.
          await tx.payment.updateMany({
            where: { enrolmentId: id, status: 'SUBMITTED' },
            data: {
              status: 'REJECTED',
              rejectionReason: 'Paid in cash at the centre',
              checkedById: admin.id,
              checkedAt: new Date(),
            },
          });
        } else {
          throw new AppException('ALREADY_ENROLLED', HttpStatus.CONFLICT);
        }

        const payment = await tx.payment.create({
          data: {
            branchId: course.branchId,
            enrolmentId: id,
            kind,
            method: 'CASH',
            reference,
            referenceNorm,
            amountSantim: input.amount,
            expectedSantim: course.priceSantim!,
            paidOn: new Date(`${input.paidOn}T00:00:00Z`),
            status: 'CONFIRMED',
            submittedById: admin.id,
            checkedById: admin.id,
            checkedAt: new Date(),
          },
          select: { id: true },
        });
        list.push({
          actorId: admin.id,
          action: 'PAYMENT_CASH_RECORDED',
          entityType: 'Payment',
          entityId: payment.id,
          details: { amountSantim: input.amount },
        });
        return { paymentId: payment.id, entries: list, enrolmentId: id };
      });
      await this.machine.record(entries);
      await this.progress.recalcEnrolment(enrolmentId);
      await this.notifyConfirmed(student.phone, course.title);
      return { id: paymentId, status: 'CONFIRMED' as const, enrolmentId };
    } catch (error) {
      if (isUniqueViolation(error) && referenceNorm) {
        throw new AppException('PAYMENT_REFERENCE_DUPLICATE', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private async ownEnrolment(student: SessionUser, id: string) {
    const enrolment = await this.prisma.enrolment.findFirst({
      where: { id, studentId: student.id },
      select: {
        id: true,
        branchId: true,
        status: true,
        course: { select: { id: true, title: true, slug: true, priceSantim: true } },
      },
    });
    // Someone else's enrolment looks exactly like one that doesn't exist (BR-ROLE-003).
    if (!enrolment) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return enrolment;
  }

  private async mustFindForCheck(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id }, select: paymentRow });
    if (!payment) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (payment.status !== 'SUBMITTED') {
      throw new AppException('PAYMENT_ALREADY_CHECKED', HttpStatus.CONFLICT);
    }
    return payment;
  }

  private async assertReferenceFree(referenceNorm: string): Promise<void> {
    const used = await this.prisma.payment.findFirst({
      where: { referenceNorm, status: { in: ['SUBMITTED', 'CONFIRMED'] } },
      select: { id: true },
    });
    if (used) {
      throw new AppException('PAYMENT_REFERENCE_DUPLICATE', HttpStatus.CONFLICT);
    }
  }

  /** Checks the real file type, shrinks photos, and stores the receipt privately. */
  private async storeReceipt(
    student: SessionUser,
    file: { buffer: Buffer; originalname: string },
  ): Promise<string> {
    if (file.buffer.length > RECEIPT_MAX_BYTES) {
      throw new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, {
        message: `This file is ${Math.ceil(file.buffer.length / 1048576)} MB. The maximum is 5 MB.`,
      });
    }
    const detected = detectFile(file.buffer);
    if (!detected || (detected.kind !== 'image' && detected.kind !== 'pdf')) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    const isImage = detected.kind === 'image';
    const body = isImage ? await this.images.toReceipt(file.buffer) : file.buffer;
    const mime = isImage ? 'image/webp' : 'application/pdf';
    const key = `receipts/${createId()}.${isImage ? 'webp' : 'pdf'}`;
    await this.storage.put(key, body, mime);
    const asset = await this.prisma.fileAsset.create({
      data: {
        purpose: 'RECEIPT',
        storageKey: key,
        mime,
        sizeBytes: body.length,
        originalName: isImage ? 'receipt.webp' : 'receipt.pdf',
        uploadedById: student.id,
      },
    });
    return asset.id;
  }

  private async discardReceipt(fileId: string): Promise<void> {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!asset) return;
    await this.prisma.fileAsset.delete({ where: { id: fileId } }).catch(() => undefined);
    await this.storage.remove(asset.storageKey).catch(() => undefined);
  }

  private async notifyConfirmed(phone: string | null, courseTitle: string): Promise<void> {
    if (!phone) return;
    await this.sms.send(phone, 'payment.confirmed', { course: shorten(courseTitle, 60) });
  }

  private studentView(r: PaymentRow) {
    return {
      id: r.id,
      kind: r.kind,
      method: r.method,
      reference: r.reference,
      amountSantim: r.amountSantim,
      paidOn: r.paidOn,
      status: r.status,
      rejectionReason: r.rejectionReason,
      submittedAt: r.createdAt,
      course: r.enrolment.course,
      enrolmentId: r.enrolment.id,
    };
  }

  private adminView(r: PaymentRow) {
    return {
      id: r.id,
      kind: r.kind,
      method: r.method,
      reference: r.reference,
      amountSantim: r.amountSantim,
      expectedSantim: r.expectedSantim,
      matches: r.amountSantim === r.expectedSantim,
      paidOn: r.paidOn,
      status: r.status,
      rejectionReason: r.rejectionReason,
      submittedAt: r.createdAt,
      checkedAt: r.checkedAt,
      receiptUrl: r.receiptFileId ? `/api/v1/files/${r.receiptFileId}` : null,
      student: r.enrolment.student,
      course: r.enrolment.course,
      enrolmentId: r.enrolment.id,
    };
  }
}
