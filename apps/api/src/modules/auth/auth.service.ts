import { HttpStatus, Injectable } from '@nestjs/common';
import { maskPhone, normalizePhone, type RegisterInput, type SignInInput } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { RateLimiter } from '../../common/security/rate-limiter';
import { hashPassword, verifyPassword } from '../../common/security/password-hasher';
import { newToken, sha256 } from '../../common/security/tokens';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SmsService } from '../notifications/sms/sms.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';

const LOCK_AFTER_FAILURES = 5;
const FAILURE_WINDOW_SECONDS = 15 * 60;
const LOCK_MS = 15 * 60_000;
const RESET_TOKEN_TTL_MS = 15 * 60_000;
/** Links sent by SMS for new or admin-reset accounts stay valid for 72 hours (README Q6). */
export const SET_PASSWORD_LINK_TTL_MS = 72 * 60 * 60_000;

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  /** Verified against when the phone is unknown, so unknown and wrong-password answers take equally long. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly otp: OtpService,
    private readonly sms: SmsService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  // ── Register ───────────────────────────────────────────────────────────

  /**
   * Creates a student account and signs them in at once: name, phone and password are all that is
   * needed. No SMS is sent (change request: SMS verification removed from registration).
   */
  async register(input: RegisterInput, client: ClientInfo) {
    const phone = normalizePhone(input.phone)!;
    await this.limiter.assert(`register-ip:${client.ip}`, 10, 3600);

    if (await this.prisma.user.findUnique({ where: { phone } })) {
      throw new AppException('PHONE_ALREADY_REGISTERED', HttpStatus.CONFLICT, {
        fields: { phone: ['This number already has an account.'] },
      });
    }

    if (input.interestLanguageId) {
      const language = await this.prisma.language.findFirst({
        where: { id: input.interestLanguageId, active: true },
      });
      if (!language) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }

    const now = new Date();
    const branch = await this.prisma.branch.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
    const user = await this.prisma.user.create({
      data: {
        branchId: branch.id,
        phone,
        role: 'STUDENT',
        fullName: input.fullName.trim(),
        email: input.email?.trim() || null,
        passwordHash: await hashPassword(input.password),
        interestLanguageId: input.interestLanguageId ?? null,
        termsAcceptedAt: now,
        ageConfirmedAt: now,
        lastSignInAt: now,
        // Signing up is activity: teachers see "active today", not "not active yet".
        lastActiveAt: now,
      },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'ACCOUNT_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      ip: client.ip,
    });
    return this.startSession(user, false, client);
  }

  /** Sends a password-reset code. Always the same outcome for known and unknown numbers. */
  private async sendResetCode(phone: string, client: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { phone } });
    await this.otp.issue(phone, 'RESET_PASSWORD', client.ip, !!user && user.status === 'ACTIVE');
  }

  // ── Sign in and out ────────────────────────────────────────────────────

  async signIn(input: SignInInput, client: ClientInfo) {
    const phone = normalizePhone(input.phone)!;
    await this.limiter.assert(`signin-ip:${client.ip}`, 10, 60);

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppException('ACCOUNT_LOCKED', HttpStatus.TOO_MANY_REQUESTS);
    }

    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await verifyPassword(hash, input.password);
    if (!user || !passwordOk || user.status !== 'ACTIVE') {
      await this.recordFailure(user?.id ?? null, phone, client);
      throw new AppException('INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED);
    }

    await this.limiter.reset(`signin-fail:${user.id}`);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedSignIns: 0,
        lockedUntil: null,
        lastSignInAt: new Date(),
        lastActiveAt: new Date(),
      },
    });
    const result = await this.startSession(user, input.keepSignedIn ?? false, client);
    await this.audit.record({
      actorId: user.id,
      action: 'SIGN_IN',
      entityType: 'User',
      entityId: user.id,
      ip: client.ip,
    });
    return result;
  }

  async signOut(sessionId: string | undefined): Promise<void> {
    if (sessionId) await this.sessions.revoke(sessionId);
  }

  // ── Forgot / reset / set password ──────────────────────────────────────

  /** Always answers the same way, whether or not the number has an account (FR-AUTH-004). */
  async forgotPassword(phone: string, client: ClientInfo): Promise<void> {
    await this.sendResetCode(phone, client);
  }

  /** Step 2 of reset: a valid SMS code becomes a short-lived single-use token. */
  async verifyResetCode(
    phone: string,
    code: string,
    client: ClientInfo,
  ): Promise<{ token: string }> {
    await this.limiter.assert(`verify-ip:${client.ip}`, 30, 3600);
    await this.otp.verify(phone, 'RESET_PASSWORD', code);
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user || user.status !== 'ACTIVE')
      throw new AppException('OTP_INVALID', HttpStatus.BAD_REQUEST);
    return { token: await this.createPasswordToken(user.id, RESET_TOKEN_TTL_MS) };
  }

  /** Step 3 of reset, and the SMS "set your password" link. Signs the user out everywhere. */
  async setPassword(token: string, newPassword: string, client: ClientInfo): Promise<void> {
    const record = await this.prisma.passwordToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    const invalid = () => new AppException('PASSWORD_LINK_INVALID', HttpStatus.BAD_REQUEST);
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) throw invalid();
    if (record.user.status !== 'ACTIVE') throw invalid();

    const claimed = await this.prisma.passwordToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw invalid();

    await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        failedSignIns: 0,
        lockedUntil: null,
        // Opening the link sent to this phone proves the person has it.
        phoneVerifiedAt: record.user.phoneVerifiedAt ?? new Date(),
      },
    });
    await this.limiter.reset(`signin-fail:${record.userId}`);
    await this.sessions.revokeAll(record.userId);
    await this.audit.record({
      actorId: record.userId,
      action: 'PASSWORD_SET',
      entityType: 'User',
      entityId: record.userId,
      ip: client.ip,
    });
  }

  /** Creates a "set your password" link token and texts it (admin-created accounts, reset links). */
  async sendPasswordLink(
    user: { id: string; phone: string | null },
    template: 'account.created' | 'password.link',
  ) {
    if (!user.phone) return;
    const token = await this.createPasswordToken(user.id, SET_PASSWORD_LINK_TTL_MS);
    const link = `${this.config.get('APP_URL')}/set-password?token=${token}`;
    await this.sms.send(user.phone, template, { link });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async createPasswordToken(userId: string, ttlMs: number): Promise<string> {
    const token = newToken();
    await this.prisma.passwordToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return token;
  }

  private async startSession(
    user: { id: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN' },
    keepSignedIn: boolean,
    client: ClientInfo,
  ) {
    const session = await this.sessions.create(user, { keepSignedIn, ...client });
    return { session, role: user.role };
  }

  /** 5 wrong passwords in 15 minutes lock the account for 15 minutes (BR-AUTH-005). */
  private async recordFailure(
    userId: string | null,
    phone: string,
    client: ClientInfo,
  ): Promise<void> {
    if (userId) {
      const failures = await this.limiter.count(`signin-fail:${userId}`, FAILURE_WINDOW_SECONDS);
      const lock = failures >= LOCK_AFTER_FAILURES;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedSignIns: failures,
          ...(lock ? { lockedUntil: new Date(Date.now() + LOCK_MS) } : {}),
        },
      });
      if (lock) await this.limiter.reset(`signin-fail:${userId}`);
    }
    await this.audit.record({
      actorId: userId,
      action: 'SIGN_IN_FAILED',
      entityType: 'User',
      entityId: userId ?? 'unknown',
      details: { phone: maskPhone(phone) },
      ip: client.ip,
    });
  }

  private getDummyHash(): Promise<string> {
    return (this.dummyHash ??= hashPassword(newToken()));
  }
}
