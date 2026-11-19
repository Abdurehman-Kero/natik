import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AccessPolicy } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** Unused accounts are removed after this many days (SRS §8.2). */
export const UNUSED_ACCOUNT_DAYS = 30;
/** Personal details are removed this many years after the last activity (SRS §8.2). */
export const INACTIVE_YEARS = 3;

/**
 * Data-keeping (SRS §8.2). Erasing removes who someone is (name, phone, email, photo, sign-in) and
 * keeps what must stay: results (anonymised), payment records, and certificates, which keep the name
 * printed on them so they still verify (Q9).
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger('Retention');

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly access: AccessPolicy,
  ) {}

  /** Erases one person's personal data, on request or by the 3-year rule. Cannot be undone. */
  async erase(actorId: string | null, userId: string, reason: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, photoFileId: true, phone: true, anonymisedAt: true },
    });
    if (!user) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    // Staff accounts are removed by disabling them; erasing is for students and teachers' personal data.
    if (user.role === 'ADMIN') {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN, {
        message: 'Admin accounts can be disabled, but their data is not erased here.',
      });
    }
    if (user.anonymisedAt) return;

    const photo = user.photoFileId
      ? await this.prisma.fileAsset.findUnique({ where: { id: user.photoFileId } })
      : null;

    // Chats are personal: delete the conversations and the files shared in them.
    const chatFiles = await this.prisma.fileAsset.findMany({
      where: {
        purpose: 'CHAT_ATTACHMENT',
        chatMessages: { some: { conversation: { OR: [{ ownerId: userId }, { peerId: userId }] } } },
      },
      select: { id: true, storageKey: true },
    });

    // What they wrote in course groups goes too: the messages are emptied (so replies still read well)
    // and the files they shared are deleted.
    const groupFiles = await this.prisma.fileAsset.findMany({
      where: { purpose: 'CHAT_ATTACHMENT', groupMessages: { some: { senderId: userId } } },
      select: { id: true, storageKey: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMessage.updateMany({
        where: { senderId: userId },
        data: { deletedAt: new Date(), body: null, pinnedAt: null, fileId: null },
      });
      await tx.groupReaction.deleteMany({ where: { userId } });
      await tx.groupRead.deleteMany({ where: { userId } });
      await tx.fileAsset.deleteMany({ where: { id: { in: groupFiles.map((f) => f.id) } } });
      await tx.conversation.deleteMany({
        where: { OR: [{ ownerId: userId }, { peerId: userId }] },
      });
      await tx.fileAsset.deleteMany({ where: { id: { in: chatFiles.map((f) => f.id) } } });
      await tx.user.update({
        where: { id: userId },
        data: {
          fullName: 'Former student',
          phone: null,
          email: null,
          passwordHash: null,
          photoFileId: null,
          bio: null,
          showOnWebsite: false,
          interestLanguageId: null,
          gender: null,
          country: null,
          city: null,
          status: 'DISABLED',
          failedSignIns: 0,
          lockedUntil: null,
          anonymisedAt: new Date(),
        },
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.passwordToken.deleteMany({ where: { userId } });
      if (user.phone) await tx.otpCode.deleteMany({ where: { phone: user.phone } });
      // Messages they sent keep their text for the centre's records, but not who sent them.
      await tx.inboxMessage.updateMany({
        where: { userId },
        data: { name: 'Former student', phone: null },
      });
      // A certificate name not yet approved is personal data too; issued certificates keep theirs.
      await tx.certificateRequest.updateMany({
        where: { studentId: userId, status: { not: 'ISSUED' } },
        data: { nameOnCertificate: null, adminNote: null },
      });
      if (photo) await tx.fileAsset.delete({ where: { id: photo.id } });
    });
    for (const f of chatFiles) await this.storage.remove(f.storageKey).catch(() => undefined);
    for (const f of groupFiles) await this.storage.remove(f.storageKey).catch(() => undefined);
    if (photo) await this.storage.remove(photo.storageKey).catch(() => undefined);

    await this.audit.record({
      actorId,
      action: 'ACCOUNT_ERASED',
      entityType: 'User',
      entityId: userId,
      details: { reason },
    });
  }

  /** Admin: "Delete personal data" on a user (FR-ADMIN-002, SRS §8.2). */
  async eraseByAdmin(actor: { id: string; role: string }, userId: string, reason: string) {
    if (actor.role !== 'ADMIN') throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    await this.erase(actor.id, userId, reason);
    return { ok: true as const };
  }

  /**
   * The daily clean-up. `now` is a parameter so tests can move the clock.
   * 1. Accounts that were made but never used (no password set, never signed in, no enrolments) after
   *    30 days are deleted. (Phone-code verification was removed, so "never used" stands in for
   *    "unverified".)
   * 2. People with no activity for 3 years have their personal details erased.
   */
  async cleanup(now = new Date()): Promise<{ deleted: number; erased: number }> {
    const unusedBefore = new Date(now.getTime() - UNUSED_ACCOUNT_DAYS * 86_400_000);
    const unused = await this.prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        passwordHash: null,
        anonymisedAt: null,
        lastSignInAt: null,
        lastActiveAt: null,
        createdAt: { lt: unusedBefore },
        enrolments: { none: {} },
        announcements: { none: {} },
      },
      select: { id: true },
      take: 500,
    });
    let deleted = 0;
    for (const { id } of unused) {
      try {
        await this.prisma.user.delete({ where: { id } });
        await this.audit.record({
          actorId: null,
          action: 'ACCOUNT_DELETED_UNUSED',
          entityType: 'User',
          entityId: id,
        });
        deleted++;
      } catch (error) {
        // Something still points at this account: leave it, it is not "unused".
        this.logger.warn(
          `Kept unused account ${id}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const staleBefore = new Date(now.getTime() - INACTIVE_YEARS * 365 * 86_400_000);
    const stale = await this.prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        anonymisedAt: null,
        createdAt: { lt: staleBefore },
        OR: [
          { lastActiveAt: { lt: staleBefore } },
          { lastActiveAt: null, lastSignInAt: { lt: staleBefore } },
          { lastActiveAt: null, lastSignInAt: null },
        ],
      },
      select: { id: true },
      take: 500,
    });
    let erased = 0;
    for (const { id } of stale) {
      try {
        await this.erase(null, id, `No activity for ${INACTIVE_YEARS} years`);
        erased++;
      } catch (error) {
        this.logger.error({ err: error, userId: id }, 'Could not erase a stale account');
      }
    }
    return { deleted, erased };
  }
}
