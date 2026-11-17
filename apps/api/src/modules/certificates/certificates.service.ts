import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { CertificateSettingsInput } from '@natik/shared';
import { Queue } from 'bullmq';
import { AppException } from '../../common/errors/app.exception';
import { StorageService } from '../../common/storage/storage.service';
import { AppConfigService } from '../../config/app-config.service';
import { Prisma } from '../../generated/prisma/client';
import { QUEUES } from '../../jobs/queues';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';
import { shorten } from '../enrolments/enrolments.service';
import { SmsService } from '../notifications/sms/sms.service';
import { renderCertificatePdf } from './certificate-renderer';

const SETTINGS_KEY = 'certificate';
const DEFAULT_SETTINGS = {
  signatoryName: 'Natik Language Centre',
  signatoryTitle: 'Director',
  signatureFileId: null as string | null,
};

/** The year in East Africa Time, so a certificate issued just after midnight on 1 January is that year's. */
function eatYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Addis_Ababa', year: 'numeric' }).format(
      date,
    ),
  );
}

/**
 * Certificates (FR-CERT). Finishing a course opens a request; the student confirms the name to print;
 * an admin approves it, which numbers the certificate (one after another each year), prints the PDF and
 * tells the student. Anyone can check a number, and an admin can cancel a certificate with a reason.
 */
@Injectable()
export class CertificatesService {
  private readonly logger = new Logger('Certificates');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
    private readonly sms: SmsService,
    @InjectQueue(QUEUES.CERTIFICATE) private readonly queue: Queue,
  ) {}

  // ── Requests: the student confirms the name, an admin approves ─────────

  /**
   * Opens the certificate request for a finished course (FR-CERT-001). Nothing is printed yet: the
   * student first confirms the name to print, then an admin approves it. Safe to call again.
   */
  async openRequest(enrolmentId: string): Promise<void> {
    const enrolment = await this.prisma.enrolment.findUnique({
      where: { id: enrolmentId },
      select: {
        id: true,
        studentId: true,
        courseId: true,
        status: true,
        certificates: { select: { id: true }, take: 1 },
      },
    });
    // Courses finished before this change already have their certificate.
    if (!enrolment || enrolment.status !== 'COMPLETED' || enrolment.certificates.length > 0) return;
    try {
      await this.prisma.certificateRequest.upsert({
        where: { enrolmentId },
        create: {
          enrolmentId,
          studentId: enrolment.studentId,
          courseId: enrolment.courseId,
        },
        update: {},
      });
    } catch (error) {
      // Opened at the same moment by the worker and the student's page: one of them wins.
      const unique =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!unique) throw error;
    }
  }

  /** The student writes the name to print. They can change it until an admin approves it. */
  async submitName(student: SessionUser, requestId: string, name: string) {
    const done = await this.prisma.certificateRequest.updateMany({
      where: {
        id: requestId,
        studentId: student.id,
        status: { in: ['AWAITING_NAME', 'AWAITING_APPROVAL', 'RETURNED'] },
      },
      data: {
        nameOnCertificate: name,
        status: 'AWAITING_APPROVAL',
        submittedAt: new Date(),
        adminNote: null,
      },
    });
    if (done.count !== 1) {
      const mine = await this.prisma.certificateRequest.findFirst({
        where: { id: requestId, studentId: student.id },
        select: { id: true },
      });
      // Someone else's request looks like it doesn't exist (BR-ROLE-003); an issued one is final.
      throw mine
        ? new AppException('CONFLICT', HttpStatus.CONFLICT, {
            message: 'This certificate has already been issued, so the name can no longer change.',
          })
        : new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    await this.audit.record({
      actorId: student.id,
      action: 'CERTIFICATE_NAME_SUBMITTED',
      entityType: 'CertificateRequest',
      entityId: requestId,
      details: { name },
    });
    return { id: requestId, status: 'AWAITING_APPROVAL' as const, nameOnCertificate: name };
  }

  /** How many certificates wait for an admin (the menu badge). */
  async pendingCount(): Promise<{ count: number }> {
    return {
      count: await this.prisma.certificateRequest.count({ where: { status: 'AWAITING_APPROVAL' } }),
    };
  }

  /** The admin's list: waiting for approval (oldest first), waiting for the student, sent back, issued. */
  async adminRequests(query: {
    status?: 'AWAITING_NAME' | 'AWAITING_APPROVAL' | 'RETURNED' | 'ISSUED';
    page: number;
    pageSize: number;
  }) {
    const status = query.status ?? 'AWAITING_APPROVAL';
    const where: Prisma.CertificateRequestWhereInput = { status };
    const [total, rows, grouped] = await Promise.all([
      this.prisma.certificateRequest.count({ where }),
      this.prisma.certificateRequest.findMany({
        where,
        orderBy:
          status === 'AWAITING_APPROVAL'
            ? [{ submittedAt: 'asc' }, { createdAt: 'asc' }]
            : [{ updatedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          status: true,
          nameOnCertificate: true,
          submittedAt: true,
          adminNote: true,
          reviewedAt: true,
          createdAt: true,
          student: { select: { fullName: true, phone: true } },
          course: { select: { title: true } },
          enrolment: { select: { completedAt: true } },
          certificate: { select: { id: true, number: true } },
        },
      }),
      this.prisma.certificateRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      counts: {
        AWAITING_APPROVAL: counts.AWAITING_APPROVAL ?? 0,
        AWAITING_NAME: counts.AWAITING_NAME ?? 0,
        RETURNED: counts.RETURNED ?? 0,
        ISSUED: counts.ISSUED ?? 0,
      },
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        nameOnCertificate: r.nameOnCertificate,
        profileName: r.student.fullName,
        studentPhone: r.student.phone,
        courseTitle: r.course.title,
        completedAt: r.enrolment.completedAt,
        submittedAt: r.submittedAt,
        adminNote: r.adminNote,
        reviewedAt: r.reviewedAt,
        certificate: r.certificate,
      })),
    };
  }

  /**
   * An admin approves: the certificate is numbered with the confirmed name (the admin may correct it),
   * printed, and the student is told by SMS. Numbers come from a counter locked while it is used, so two
   * approvals at the same moment never share a number (FR-CERT-002).
   */
  async approve(admin: SessionUser, requestId: string, correctedName?: string) {
    let issued: { id: string; number: string; course: string; phone: string | null } | null = null;
    for (let attempt = 0; attempt < 4 && !issued; attempt++) {
      try {
        issued = await this.prisma.$transaction(async (tx) => {
          // One decision at a time per request, so a double click can't issue two certificates.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${requestId}))`;
          const request = await tx.certificateRequest.findUnique({
            where: { id: requestId },
            select: {
              id: true,
              status: true,
              nameOnCertificate: true,
              studentId: true,
              courseId: true,
              enrolmentId: true,
              enrolment: { select: { status: true } },
              course: { select: { title: true } },
              student: { select: { phone: true } },
            },
          });
          if (!request) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
          if (request.status !== 'AWAITING_APPROVAL' || request.enrolment.status !== 'COMPLETED') {
            throw new AppException('CONFLICT', HttpStatus.CONFLICT, {
              message:
                request.status === 'ISSUED'
                  ? 'This certificate has already been issued.'
                  : 'This certificate is waiting for the student to confirm their name.',
            });
          }
          const printedName = correctedName ?? request.nameOnCertificate!;
          const now = new Date();
          const year = eatYear(now);
          const counter = await tx.certificateCounter.upsert({
            where: { year },
            create: { year, last: 1 },
            update: { last: { increment: 1 } },
          });
          const certificate = await tx.certificate.create({
            data: {
              number: `NLC-${year}-${String(counter.last).padStart(5, '0')}`,
              studentId: request.studentId,
              courseId: request.courseId,
              enrolmentId: request.enrolmentId,
              // What is printed is kept, so later renames never change an issued certificate.
              studentNameSnapshot: printedName,
              courseTitleSnapshot: request.course.title,
              issuedAt: now,
            },
            select: { id: true, number: true },
          });
          await tx.certificateRequest.update({
            where: { id: requestId },
            data: {
              status: 'ISSUED',
              nameOnCertificate: printedName,
              certificateId: certificate.id,
              reviewedById: admin.id,
              reviewedAt: now,
              adminNote: null,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: admin.id,
              action: 'CERTIFICATE_ISSUED',
              entityType: 'Certificate',
              entityId: certificate.id,
              details: { number: certificate.number, name: printedName },
            },
          });
          return {
            id: certificate.id,
            number: certificate.number,
            course: request.course.title,
            phone: request.student.phone,
          };
        });
      } catch (error) {
        // Two first certificates of a new year at once: one of them retries and takes the next number.
        const unique =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!unique || attempt === 3) throw error;
      }
    }
    const certificate = issued!;
    await this.queue
      .add('render', { certificateId: certificate.id }, { jobId: `render-${certificate.id}` })
      .catch(() => undefined);
    if (certificate.phone)
      await this.sms
        .send(certificate.phone, 'certificate.ready', {
          course: shorten(certificate.course, 40),
          number: certificate.number,
        })
        .catch((error: unknown) =>
          this.logger.warn({ err: error, requestId }, 'Could not send the certificate SMS'),
        );
    return {
      id: requestId,
      status: 'ISSUED' as const,
      certificate: { id: certificate.id, number: certificate.number },
    };
  }

  /** An admin sends it back with a note (for example "write your full name as on your ID"). */
  async returnToStudent(admin: SessionUser, requestId: string, note: string) {
    const done = await this.prisma.certificateRequest.updateMany({
      where: { id: requestId, status: 'AWAITING_APPROVAL' },
      data: { status: 'RETURNED', adminNote: note, reviewedById: admin.id, reviewedAt: new Date() },
    });
    const request = await this.prisma.certificateRequest.findUnique({
      where: { id: requestId },
      select: { course: { select: { title: true } }, student: { select: { phone: true } } },
    });
    if (!request) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (done.count !== 1) {
      throw new AppException('CONFLICT', HttpStatus.CONFLICT, {
        message: 'Only a certificate waiting for approval can be sent back.',
      });
    }
    await this.audit.record({
      actorId: admin.id,
      action: 'CERTIFICATE_RETURNED',
      entityType: 'CertificateRequest',
      entityId: requestId,
      details: { note },
    });
    if (request.student.phone)
      await this.sms
        .send(request.student.phone, 'certificate.returned', {
          course: shorten(request.course.title, 50),
        })
        .catch((error: unknown) =>
          this.logger.warn({ err: error, requestId }, 'Could not send the certificate SMS'),
        );
    return { id: requestId, status: 'RETURNED' as const, adminNote: note };
  }

  /** Prints the PDF and stores it privately. Re-running replaces nothing: an issued PDF is final. */
  async render(certificateId: string): Promise<void> {
    const certificate = await this.prisma.certificate.findUnique({ where: { id: certificateId } });
    if (!certificate || certificate.pdfFileId) return;

    const course = await this.prisma.course.findUnique({
      where: { id: certificate.courseId },
      select: { language: { select: { name: true } }, level: { select: { name: true } } },
    });
    const enrolment = await this.prisma.enrolment.findUnique({
      where: { id: certificate.enrolmentId },
      select: { completedAt: true },
    });
    const pdf = await renderCertificatePdf({
      number: certificate.number,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      languageName: course?.language.name ?? null,
      levelName: course?.level.name ?? null,
      issuedAt: certificate.issuedAt,
      completedAt: enrolment?.completedAt ?? certificate.issuedAt,
      ...(await this.signatory()),
      verifyUrl: this.verifyUrl(certificate.number),
    });
    const key = `certificates/${certificate.id}.pdf`;
    await this.storage.put(key, pdf, 'application/pdf');
    let asset: { id: string };
    try {
      asset = await this.prisma.fileAsset.create({
        data: {
          purpose: 'CERTIFICATE',
          storageKey: key,
          mime: 'application/pdf',
          sizeBytes: pdf.length,
          originalName: `${certificate.number}.pdf`,
        },
        select: { id: true },
      });
    } catch (error) {
      // Printed at the same moment by the worker and by a download: keep the one saved first.
      const unique =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!unique) throw error;
      asset = await this.prisma.fileAsset.findUniqueOrThrow({
        where: { storageKey: key },
        select: { id: true },
      });
    }
    await this.prisma.certificate.updateMany({
      where: { id: certificate.id, pdfFileId: null },
      data: { pdfFileId: asset.id },
    });
  }

  /** Who signs: the name and title from the settings, and the signature picture as a data URL. */
  private async signatory() {
    const settings = await this.settings();
    let signatureDataUrl: string | null = null;
    if (settings.signatureFileId) {
      const file = await this.prisma.fileAsset.findUnique({
        where: { id: settings.signatureFileId },
      });
      if (file) {
        const { body, contentType } = await this.storage.read(file.storageKey);
        signatureDataUrl = `data:${contentType};base64,${body.toString('base64')}`;
      }
    }
    return {
      signatoryName: settings.signatoryName,
      signatoryTitle: settings.signatoryTitle,
      signatureDataUrl,
    };
  }

  private verifyUrl(number: string): string {
    return `${this.config.get('APP_URL').replace(/\/$/, '')}/verify?n=${number}`;
  }

  /**
   * A sample certificate with the current signatory and signature, so an admin can see the design
   * before any student finishes a course. Nothing is stored.
   */
  async preview(): Promise<{ body: Buffer; name: string }> {
    const body = await renderCertificatePdf({
      number: 'NLC-0000-00000',
      studentName: 'Sample Student',
      courseTitle: 'Arabic for Beginners',
      languageName: 'Arabic',
      levelName: 'Beginner',
      issuedAt: new Date(),
      ...(await this.signatory()),
      verifyUrl: this.verifyUrl('NLC-0000-00000'),
    });
    return { body, name: 'certificate-preview.pdf' };
  }

  // ── Students ──────────────────────────────────────────────────────────

  /**
   * The student's certificates, and the ones still on their way: waiting for the student to confirm
   * the name, waiting for an admin, or sent back with a note. A finished course whose request was not
   * opened yet (the worker was down) gets it now, so nobody is left waiting.
   */
  async listMine(student: SessionUser) {
    const missing = await this.prisma.enrolment.findMany({
      where: {
        studentId: student.id,
        status: 'COMPLETED',
        certificates: { none: {} },
        certificateRequest: { is: null },
      },
      select: { id: true },
    });
    for (const { id } of missing) await this.openRequest(id);

    const [rows, requests, me] = await Promise.all([
      this.prisma.certificate.findMany({
        where: { studentId: student.id },
        orderBy: { issuedAt: 'desc' },
        select: {
          id: true,
          number: true,
          status: true,
          issuedAt: true,
          studentNameSnapshot: true,
          courseTitleSnapshot: true,
          course: { select: { slug: true } },
        },
      }),
      this.prisma.certificateRequest.findMany({
        where: { studentId: student.id, status: { not: 'ISSUED' } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          nameOnCertificate: true,
          adminNote: true,
          submittedAt: true,
          course: { select: { title: true, slug: true } },
          enrolment: { select: { completedAt: true } },
        },
      }),
      this.prisma.user.findUnique({ where: { id: student.id }, select: { fullName: true } }),
    ]);
    return {
      items: rows.map((c) => ({
        id: c.id,
        number: c.number,
        status: c.status,
        issuedAt: c.issuedAt,
        nameOnCertificate: c.studentNameSnapshot,
        courseTitle: c.courseTitleSnapshot,
        courseSlug: c.course.slug,
        pdfUrl: c.status === 'VALID' ? `/api/v1/me/certificates/${c.id}/pdf` : null,
      })),
      requests: requests.map((r) => ({
        id: r.id,
        status: r.status,
        courseTitle: r.course.title,
        courseSlug: r.course.slug,
        completedAt: r.enrolment.completedAt,
        nameOnCertificate: r.nameOnCertificate,
        suggestedName: r.nameOnCertificate ?? me?.fullName ?? '',
        adminNote: r.adminNote,
        submittedAt: r.submittedAt,
      })),
    };
  }

  /** The PDF of the student's own certificate. Someone else's looks like it doesn't exist (BR-ROLE-003). */
  async pdfForStudent(student: SessionUser, id: string) {
    const certificate = await this.prisma.certificate.findFirst({
      where: { id, studentId: student.id, status: 'VALID' },
      select: { id: true },
    });
    if (!certificate) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return this.pdf(id);
  }

  async pdf(id: string): Promise<{ body: Buffer; name: string }> {
    let certificate = await this.prisma.certificate.findUnique({ where: { id } });
    if (!certificate) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (!certificate.pdfFileId) {
      try {
        await this.render(id);
      } catch (error) {
        this.logger.error({ err: error, certificateId: id }, 'Could not print the certificate');
        throw new AppException('CERTIFICATE_NOT_READY', HttpStatus.SERVICE_UNAVAILABLE);
      }
      certificate = await this.prisma.certificate.findUniqueOrThrow({ where: { id } });
    }
    const file = await this.prisma.fileAsset.findUniqueOrThrow({
      where: { id: certificate.pdfFileId! },
    });
    const { body } = await this.storage.read(file.storageKey);
    return { body, name: `${certificate.number}.pdf` };
  }

  // ── Admin ─────────────────────────────────────────────────────────────

  async adminList(query: {
    q?: string;
    status?: 'VALID' | 'CANCELLED';
    page: number;
    pageSize: number;
  }) {
    const q = query.q?.trim();
    const where: Prisma.CertificateWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { studentNameSnapshot: { contains: q, mode: 'insensitive' } },
              { courseTitleSnapshot: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          number: true,
          status: true,
          issuedAt: true,
          studentNameSnapshot: true,
          courseTitleSnapshot: true,
          cancelReason: true,
          cancelledAt: true,
          student: { select: { phone: true } },
        },
      }),
    ]);
    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      items: rows.map((c) => ({
        id: c.id,
        number: c.number,
        status: c.status,
        issuedAt: c.issuedAt,
        studentName: c.studentNameSnapshot,
        studentPhone: c.student.phone,
        courseTitle: c.courseTitleSnapshot,
        cancelReason: c.cancelReason,
        cancelledAt: c.cancelledAt,
      })),
    };
  }

  /** Cancels with a reason. The verify page then says "cancelled" (FR-CERT-005). */
  async cancel(admin: SessionUser, id: string, reason: string) {
    const done = await this.prisma.certificate.updateMany({
      where: { id, status: 'VALID' },
      data: {
        status: 'CANCELLED',
        cancelReason: reason,
        cancelledById: admin.id,
        cancelledAt: new Date(),
      },
    });
    if (done.count !== 1) {
      const exists = await this.prisma.certificate.findUnique({
        where: { id },
        select: { id: true },
      });
      throw new AppException(
        exists ? 'CONFLICT' : 'NOT_FOUND',
        exists ? HttpStatus.CONFLICT : HttpStatus.NOT_FOUND,
      );
    }
    await this.audit.record({
      actorId: admin.id,
      action: 'CERTIFICATE_CANCELLED',
      entityType: 'Certificate',
      entityId: id,
      details: { reason },
    });
    return { id, status: 'CANCELLED' as const };
  }

  // ── Signatory setting ─────────────────────────────────────────────────

  async settings(): Promise<typeof DEFAULT_SETTINGS> {
    const row = await this.prisma.setting.findUnique({ where: { key: SETTINGS_KEY } });
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<typeof DEFAULT_SETTINGS>) ?? {}) };
  }

  async getSettings() {
    const s = await this.settings();
    return { ...s, signatureUrl: s.signatureFileId ? `/api/v1/files/${s.signatureFileId}` : null };
  }

  async putSettings(admin: SessionUser, input: CertificateSettingsInput) {
    if (input.signatureFileId) {
      const file = await this.prisma.fileAsset.findFirst({
        where: { id: input.signatureFileId, purpose: 'SIGNATURE' },
        select: { id: true },
      });
      if (!file) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    const value = {
      signatoryName: input.signatoryName,
      signatoryTitle: input.signatoryTitle,
      signatureFileId: input.signatureFileId ?? null,
    };
    await this.prisma.setting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value, updatedById: admin.id },
      update: { value, updatedById: admin.id },
    });
    await this.audit.record({
      actorId: admin.id,
      action: 'CERTIFICATE_SETTINGS_CHANGED',
      entityType: 'Setting',
      entityId: SETTINGS_KEY,
    });
    return this.getSettings();
  }
}
