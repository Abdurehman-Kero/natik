import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import type { Role, SessionKind } from '@natik/shared';
import { newToken, sha256 } from '../../common/security/tokens';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from './decorators';

export const SESSION_COOKIE = 'natik_sid';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** Staff are signed out after 60 minutes of inactivity; students stay up to 30 days (BR-AUTH-006). */
export const STAFF_IDLE_MS = 60 * MIN;
export const PERSISTENT_MS = 30 * DAY;
export const BROWSER_SESSION_MS = 12 * 60 * MIN;
/** Don't write to the database on every request. */
const TOUCH_EVERY_MS = MIN;

interface CreatedSession {
  token: string;
  kind: SessionKind;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async create(
    user: { id: string; role: Role },
    options: { keepSignedIn: boolean; ip?: string | null; userAgent?: string | null },
  ): Promise<CreatedSession> {
    const kind: SessionKind =
      user.role === 'STUDENT' ? (options.keepSignedIn ? 'PERSISTENT' : 'BROWSER') : 'STAFF';
    const ttl =
      kind === 'STAFF' ? STAFF_IDLE_MS : kind === 'PERSISTENT' ? PERSISTENT_MS : BROWSER_SESSION_MS;
    const token = newToken();
    const expiresAt = new Date(Date.now() + ttl);
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: sha256(token),
        kind,
        expiresAt,
        ip: options.ip ?? null,
        userAgent: options.userAgent?.slice(0, 300) ?? null,
      },
    });
    return { token, kind, expiresAt };
  }

  /** Returns the signed-in user for a cookie token, or null. Slides staff expiry on activity. */
  async validate(token: string): Promise<{ sessionId: string; user: SessionUser } | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!session) return null;
    const now = Date.now();
    if (session.expiresAt.getTime() <= now || session.user.status !== 'ACTIVE') {
      if (session.expiresAt.getTime() <= now) {
        await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      }
      return null;
    }
    if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
      const slide = session.kind === 'STAFF' ? { expiresAt: new Date(now + STAFF_IDLE_MS) } : {};
      await this.prisma.session
        .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), ...slide } })
        .catch(() => undefined);
      await this.prisma.user
        .update({ where: { id: session.userId }, data: { lastActiveAt: new Date(now) } })
        .catch(() => undefined);
    }
    const u = session.user;
    return {
      sessionId: session.id,
      user: {
        id: u.id,
        fullName: u.fullName,
        role: u.role,
        isOwner: u.isOwner,
        phone: u.phone,
        phoneVerified: u.phoneVerifiedAt !== null,
      },
    };
  }

  revoke(sessionId: string): Promise<unknown> {
    return this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  /** Signs a user out everywhere, optionally keeping one session (password change/reset, disable). */
  revokeAll(userId: string, exceptSessionId?: string): Promise<unknown> {
    return this.prisma.session.deleteMany({
      where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    });
  }

  setCookie(res: Response, session: CreatedSession): void {
    res.cookie(
      SESSION_COOKIE,
      session.token,
      this.cookieOptions(session.kind === 'PERSISTENT' ? session.expiresAt : undefined),
    );
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }

  private cookieOptions(expires?: Date): CookieOptions {
    return {
      httpOnly: true,
      secure:
        this.config.get('APP_ENV') === 'production' || this.config.get('APP_ENV') === 'staging',
      sameSite: 'lax',
      path: '/',
      // No expiry = a browser-session cookie (cleared when the browser closes).
      ...(expires ? { expires } : {}),
    };
  }
}
