import { HttpStatus, Injectable } from '@nestjs/common';
import {
  maskEmail,
  maskPhone,
  normalizePhone,
  type RegisterInput,
  type Role,
  type SignInInput,
} from '@natik/shared';
import { Prisma } from '../../generated/prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { RateLimiter } from '../../common/security/rate-limiter';
import { hashPassword, verifyPassword } from '../../common/security/password-hasher';
import { newToken, sha256 } from '../../common/security/tokens';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { accountCreatedEmail, passwordLinkEmail } from '../notifications/email/email-templates';
import { EmailService } from '../notifications/email/email.service';
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
  /** Verified against when the account is unknown, so unknown and wrong-password answers take equally long. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly otp: OtpService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  // ── Register ───────────────────────────────────────────────────────────

  /**
   * Creates a student account and signs them in at once: name, email, phone and password are all that
   * is needed. The email is what they sign in with. No SMS is sent (change request: SMS verification
   * removed from registration).
   */
  async register(input: RegisterInput, client: ClientInfo) {
    const phone = normalizePhone(input.phone)!;
    await this.limiter.assert(`register-ip:${client.ip}`, 10, 3600);

    if (await this.prisma.user.findUnique({ where: { phone } })) {
      throw new AppException('PHONE_ALREADY_REGISTERED', HttpStatus.CONFLICT, {
        fields: { phone: ['This number already has an account.'] },
      });
    }

    if (await this.prisma.user.findUnique({ where: { email: input.email } })) {
      throw new AppException('EMAIL_ALREADY_REGISTERED', HttpStatus.CONFLICT, {
        fields: { email: ['This email already has an account.'] },
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
    const user = await this.prisma.user
      .create({
        data: {
          branchId: branch.id,
          phone,
          role: 'STUDENT',
          fullName: input.fullName.trim(),
          email: input.email,
          passwordHash: await hashPassword(input.password),
          interestLanguageId: input.interestLanguageId ?? null,
          gender: input.gender ?? null,
          country: input.country ?? null,
          city: input.city?.trim() || null,
          termsAcceptedAt: now,
          ageConfirmedAt: now,
          lastSignInAt: now,
          // Signing up is activity: teachers see "active today", not "not active yet".
          lastActiveAt: now,
        },
      })
      .catch((error: unknown) => {
        // Two people registering the same address at the same moment: the database refuses the second.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const taken = JSON.stringify(error.meta ?? {}).includes('email') ? 'email' : 'phone';
          throw new AppException(
            taken === 'email' ? 'EMAIL_ALREADY_REGISTERED' : 'PHONE_ALREADY_REGISTERED',
            HttpStatus.CONFLICT,
          );
        }
        throw error;
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

  /**
   * Finds the account a reset is for: by email (what the website asks for) or by phone. The code is
   * always texted to the phone on that account. For an unknown address a stand-in key is used so the
   * limits and the answer look the same as for a known one.
   */
  private async resetTarget(who: { email?: string; phone?: string }) {
    const phone = who.phone ? normalizePhone(who.phone) : null;
    const user = who.email
      ? await this.prisma.user.findUnique({ where: { email: who.email } })
      : phone
        ? await this.prisma.user.findUnique({ where: { phone } })
        : null;
    const key = user?.phone ?? phone ?? `email:${who.email ?? ''}`;
    return { user, key };
  }

  /** Sends a password-reset code. Always the same outcome for known and unknown accounts. */
  private async sendResetCode(who: { email?: string; phone?: string }, client: ClientInfo) {
    const { user, key } = await this.resetTarget(who);
    await this.otp.issue(
      key,
      'RESET_PASSWORD',
      client.ip,
      !!user && user.status === 'ACTIVE' && (!!user.phone || !!user.email),
      user?.email ? { email: user.email, name: user.fullName } : null,
    );
  }

  // ── Sign in and out ────────────────────────────────────────────────────

  async signIn(input: SignInInput, client: ClientInfo) {
    const email = input.email ?? null;
    const phone = input.phone ? normalizePhone(input.phone) : null;
    await this.limiter.assert(`signin-ip:${client.ip}`, 10, 60);

    const user = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : phone
        ? await this.prisma.user.findUnique({ where: { phone } })
        : null;
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppException('ACCOUNT_LOCKED', HttpStatus.TOO_MANY_REQUESTS);
    }

    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await verifyPassword(hash, input.password);
    if (!user || !passwordOk || user.status !== 'ACTIVE') {
      await this.recordFailure(
        user?.id ?? null,
        email ? maskEmail(email) : maskPhone(phone),
        client,
      );
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

  /** Always answers the same way, whether or not the email has an account (FR-AUTH-004). */
  async forgotPassword(who: { email?: string; phone?: string }, client: ClientInfo): Promise<void> {
    await this.sendResetCode(who, client);
  }

  /** Step 2 of reset: a valid SMS code becomes a short-lived single-use token. */
  async verifyResetCode(
    who: { email?: string; phone?: string },
    code: string,
    client: ClientInfo,
  ): Promise<{ token: string }> {
    await this.limiter.assert(`verify-ip:${client.ip}`, 30, 3600);
    const { user, key } = await this.resetTarget(who);
    await this.otp.verify(key, 'RESET_PASSWORD', code);
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

  /**
   * Creates a "set your password" link and sends it (admin-created accounts, "send password link").
   *
   * It goes by **email** first (the message also says who they are and how to sign in). If email is not
   * set up or fails, it is texted when a real SMS gateway exists. If neither really leaves the server
   * (as in a pilot before email is configured) the link is returned instead: the admin sees it on
   * screen and passes it on by hand. When a message really went out, the link is never returned.
   */
  async sendPasswordLink(
    user: {
      id: string;
      fullName: string;
      role: Role;
      phone: string | null;
      email: string | null;
    },
    template: 'account.created' | 'password.link',
  ): Promise<{ link: string | null; sentTo: 'email' | 'sms' | null }> {
    if (!user.phone && !user.email) return { link: null, sentTo: null };
    const token = await this.createPasswordToken(user.id, SET_PASSWORD_LINK_TTL_MS);
    const appUrl = this.config.get('APP_URL').replace(/\/$/, '');
    const link = `${appUrl}/set-password?token=${token}`;

    if (user.email) {
      const details = { name: user.fullName, email: user.email, link };
      const content =
        template === 'account.created'
          ? accountCreatedEmail({ ...details, role: user.role, signInUrl: `${appUrl}/sign-in` })
          : passwordLinkEmail(details);
      if ((await this.email.send(user.email, content)).delivered)
        return { link: null, sentTo: 'email' };
    }
    if (user.phone) {
      await this.sms.send(user.phone, template, { link });
      if (this.config.get('SMS_PROVIDER') !== 'console') return { link: null, sentTo: 'sms' };
    }
    return { link, sentTo: null };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async createPasswordToken(userId: string, ttlMs: number): Promise<string> {
    const token = newToken();
    await this.prisma.passwordToken.create({
      data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return token;
  }

  async startSession(
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
    who: string,
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
      details: { who },
      ip: client.ip,
    });
  }

  private getDummyHash(): Promise<string> {
    return (this.dummyHash ??= hashPassword(newToken()));
  }
}
