import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { normalizePhone, type GoogleCompleteInput, type Role } from '@natik/shared';
import type Redis from 'ioredis';
import { AppException } from '../../../common/errors/app.exception';
import { RateLimiter } from '../../../common/security/rate-limiter';
import { AppConfigService } from '../../../config/app-config.service';
import { Prisma, type User } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { REDIS } from '../../../redis/redis.module';
import { AuditService } from '../../audit/audit.service';
import { AuthService, type ClientInfo } from '../auth.service';
import {
  GoogleExchangeError,
  GoogleOAuthClient,
  randomUrlToken,
  s256Challenge,
} from './google-oauth.client';

const STATE_TTL_SECONDS = 10 * 60;
const PENDING_TTL_SECONDS = 15 * 60;

type Mode = 'sign-in' | 'link';
type Session = Awaited<ReturnType<AuthService['startSession']>>['session'];

/** Why a Google attempt did not end in a signed-in person. The website shows a plain message for each. */
export type GoogleFailure =
  /** The person pressed "Cancel" at Google. */
  | 'cancelled'
  /** Something did not check out (expired, tampered, Google unreachable). */
  | 'invalid'
  /** Google has not verified that email address. */
  | 'unverified'
  | 'disabled'
  /** This Google account is already connected to someone else. */
  | 'taken'
  /** Connecting needs a signed-in person. */
  | 'signed-out';

export type GoogleOutcome =
  | { kind: 'signed-in'; session: Session; role: Role; next: string | null }
  | { kind: 'pending'; pendingId: string; next: string | null }
  | { kind: 'linked' }
  | { kind: 'failed'; reason: GoogleFailure; mode: Mode; next: string | null };

interface StateRecord {
  verifier: string;
  nonce: string;
  mode: Mode;
  userId: string | null;
  next: string | null;
}

interface PendingRecord {
  sub: string;
  email: string;
  name: string;
  next: string | null;
}

/** Only addresses on this site: stops "?next=https://evil.example" redirects. */
export function safeNextPath(value: string | undefined | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return null;
  return value.slice(0, 300);
}

/**
 * "Continue with Google". The rules, in order:
 *  1. Google must have verified the email.
 *  2. A person already connected to this Google account signs in.
 *  3. An account that already exists for that email (created by an admin, or registered with a
 *     password) is connected and signs in: Google proves the person owns that email. Its password, if
 *     any, keeps working. (Natik does not verify emails at registration, so this trusts Google over a
 *     password someone else may have set for an address that is not theirs; see docs/GOOGLE-SIGN-IN.md.)
 *  4. Otherwise it is a new person: they confirm the terms and age, then the account is created.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly google: GoogleOAuthClient,
    private readonly config: AppConfigService,
    private readonly auth: AuthService,
    private readonly limiter: RateLimiter,
    private readonly audit: AuditService,
  ) {}

  get enabled(): boolean {
    return this.google.enabled;
  }

  private redirectUri(): string {
    return `${this.config.get('APP_URL').replace(/\/$/, '')}/api/v1/auth/google/callback`;
  }

  /** Starts a sign-in (or a "connect Google" from the Profile): where to send the browser, and the state to remember. */
  async begin(options: {
    next: string | null;
    mode: Mode;
    userId: string | null;
    loginHint?: string;
    ip: string | null;
  }): Promise<{ url: string; state: string }> {
    if (!this.enabled) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.limiter.assert(`google-start-ip:${options.ip}`, 30, 600);
    const state = randomUrlToken();
    const nonce = randomUrlToken();
    const verifier = randomUrlToken(48);
    const record: StateRecord = {
      verifier,
      nonce,
      mode: options.mode,
      userId: options.userId,
      next: options.next,
    };
    await this.redis.set(`google:state:${state}`, JSON.stringify(record), 'EX', STATE_TTL_SECONDS);
    const url = this.google.authorizationUrl({
      state,
      nonce,
      challenge: s256Challenge(verifier),
      redirectUri: this.redirectUri(),
      loginHint: options.loginHint,
    });
    return { url, state };
  }

  /** Google sent the person back. */
  async finish(input: {
    code?: string;
    state?: string;
    error?: string;
    /** The state stored in this browser when the sign-in started. */
    stateCookie: string | null;
    /** The person signed in right now (for "connect Google"), if any. */
    sessionUserId: string | null;
    client: ClientInfo;
  }): Promise<GoogleOutcome> {
    const fail = (reason: GoogleFailure, mode: Mode = 'sign-in', next: string | null = null) =>
      ({ kind: 'failed', reason, mode, next }) satisfies GoogleOutcome;
    if (!this.enabled) return fail('invalid');
    await this.limiter.assert(`google-finish-ip:${input.client.ip}`, 60, 600);
    if (input.error) return fail('cancelled');
    if (!input.code || !input.state) return fail('invalid');

    // The state is single use, and must be the one this very browser was given (CSRF defence).
    const raw = await this.redis.getdel(`google:state:${input.state}`);
    if (!raw || input.stateCookie !== input.state) return fail('invalid');
    const record = JSON.parse(raw) as StateRecord;

    let profile;
    try {
      profile = await this.google.exchange({
        code: input.code,
        verifier: record.verifier,
        redirectUri: this.redirectUri(),
        nonce: record.nonce,
      });
    } catch (error) {
      if (!(error instanceof GoogleExchangeError)) throw error;
      return fail('invalid', record.mode, record.next);
    }
    if (!profile.emailVerified) return fail('unverified', record.mode, record.next);
    const email = profile.email.trim().toLowerCase();

    if (record.mode === 'link') {
      if (!input.sessionUserId || input.sessionUserId !== record.userId) {
        return fail('signed-out', 'link');
      }
      const owner = await this.prisma.user.findUnique({ where: { googleId: profile.sub } });
      if (owner && owner.id !== input.sessionUserId) return fail('taken', 'link');
      await this.prisma.user.update({
        where: { id: input.sessionUserId },
        data: { googleId: profile.sub },
      });
      await this.audit.record({
        actorId: input.sessionUserId,
        action: 'GOOGLE_CONNECTED',
        entityType: 'User',
        entityId: input.sessionUserId,
        ip: input.client.ip,
      });
      return { kind: 'linked' };
    }

    const connected = await this.prisma.user.findUnique({ where: { googleId: profile.sub } });
    if (connected) return this.signIn(connected, record.next, input.client);

    const sameEmail = await this.prisma.user.findUnique({ where: { email } });
    if (sameEmail) {
      if (sameEmail.status !== 'ACTIVE') return fail('disabled', 'sign-in', record.next);
      if (sameEmail.googleId) return fail('taken', 'sign-in', record.next);
      // An account already exists for this email (made by an admin, or registered with a password):
      // Google has verified the email, so this is its owner. Connect Google and sign them in; any
      // password they have keeps working.
      const linked = await this.prisma.user.update({
        where: { id: sameEmail.id },
        data: { googleId: profile.sub },
      });
      await this.audit.record({
        actorId: linked.id,
        action: 'GOOGLE_CONNECTED',
        entityType: 'User',
        entityId: linked.id,
        details: { atFirstSignIn: true, hadPassword: sameEmail.passwordHash !== null },
        ip: input.client.ip,
      });
      return this.signIn(linked, record.next, input.client);
    }

    const pendingId = randomUrlToken();
    const pending: PendingRecord = {
      sub: profile.sub,
      email,
      name: profile.name,
      next: record.next,
    };
    await this.redis.set(
      `google:pending:${pendingId}`,
      JSON.stringify(pending),
      'EX',
      PENDING_TTL_SECONDS,
    );
    return { kind: 'pending', pendingId, next: record.next };
  }

  /** What the last step of a new person's sign-up shows (their name and email from Google). */
  async pendingInfo(
    pendingId: string | null,
  ): Promise<{ name: string; email: string; next: string | null }> {
    const pending = await this.readPending(pendingId);
    return { name: pending.name, email: pending.email, next: pending.next };
  }

  /** A new person confirmed the terms and age: create the account and sign them in. */
  async complete(input: {
    pendingId: string | null;
    data: GoogleCompleteInput;
    client: ClientInfo;
  }): Promise<{ session: Session; role: Role; next: string | null }> {
    await this.limiter.assert(`google-complete-ip:${input.client.ip}`, 20, 3600);
    const pending = await this.readPending(input.pendingId);
    const phone = input.data.phone ? normalizePhone(input.data.phone) : null;

    if (await this.prisma.user.findUnique({ where: { email: pending.email } })) {
      throw new AppException('EMAIL_ALREADY_REGISTERED', HttpStatus.CONFLICT);
    }
    if (phone && (await this.prisma.user.findUnique({ where: { phone } }))) {
      throw new AppException('PHONE_ALREADY_REGISTERED', HttpStatus.CONFLICT, {
        fields: { phone: ['This number already has an account.'] },
      });
    }

    const branch = await this.prisma.branch.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
    const now = new Date();
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          branchId: branch.id,
          role: 'STUDENT',
          fullName: input.data.fullName.trim(),
          email: pending.email,
          googleId: pending.sub,
          phone,
          // No password: they sign in with Google (or choose one later with "Forgot password").
          passwordHash: null,
          gender: input.data.gender ?? null,
          country: input.data.country ?? null,
          city: input.data.city?.trim() || null,
          termsAcceptedAt: now,
          ageConfirmedAt: now,
          lastSignInAt: now,
          lastActiveAt: now,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppException('EMAIL_ALREADY_REGISTERED', HttpStatus.CONFLICT);
      }
      throw error;
    }
    await this.redis.del(`google:pending:${input.pendingId}`);
    await this.audit.record({
      actorId: user.id,
      action: 'ACCOUNT_REGISTERED',
      entityType: 'User',
      entityId: user.id,
      details: { via: 'google' },
      ip: input.client.ip,
    });
    const { session, role } = await this.auth.startSession(user, false, input.client);
    return { session, role, next: pending.next };
  }

  private async readPending(pendingId: string | null): Promise<PendingRecord> {
    const raw = pendingId ? await this.redis.get(`google:pending:${pendingId}`) : null;
    if (!raw) throw new AppException('GOOGLE_SIGN_UP_EXPIRED', HttpStatus.GONE);
    return JSON.parse(raw) as PendingRecord;
  }

  private async signIn(
    user: User,
    next: string | null,
    client: ClientInfo,
  ): Promise<GoogleOutcome> {
    if (user.status !== 'ACTIVE')
      return { kind: 'failed', reason: 'disabled', mode: 'sign-in', next };
    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedSignIns: 0, lockedUntil: null, lastSignInAt: now, lastActiveAt: now },
    });
    const { session, role } = await this.auth.startSession(user, false, client);
    await this.audit.record({
      actorId: user.id,
      action: 'SIGN_IN',
      entityType: 'User',
      entityId: user.id,
      details: { via: 'google' },
      ip: client.ip,
    });
    return { kind: 'signed-in', session, role, next };
  }
}
