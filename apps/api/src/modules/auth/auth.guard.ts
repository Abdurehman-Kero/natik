import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { AppConfigService } from '../../config/app-config.service';
import { type AuthedRequest, PUBLIC_KEY, ROLES_KEY } from './decorators';
import { SESSION_COOKIE, SessionService } from './session.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Runs on every request (BR-ROLE-003): identifies the user from the session cookie,
 * blocks cross-site writes, then enforces @Public / @Roles.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    this.checkOrigin(req);

    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) {
      const found = await this.sessions.validate(token);
      if (found) {
        req.user = found.user;
        req.sessionId = found.sessionId;
      }
    }

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    if (!req.user) throw new AppException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && roles.length > 0 && !roles.includes(req.user.role)) {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    return true;
  }

  /** Browsers send Origin on every non-GET request; it must be our own site (CSRF defence, ARCHITECTURE §8). */
  private checkOrigin(req: AuthedRequest): void {
    // Local development is reached through changing addresses (localhost, a phone on the same Wi-Fi).
    if (this.config.isLocal || SAFE_METHODS.has(req.method)) return;
    const origin = req.headers.origin;
    if (!origin) return; // not a browser (tests, server-to-server)
    if (origin !== new URL(this.config.get('APP_URL')).origin) {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
  }
}
