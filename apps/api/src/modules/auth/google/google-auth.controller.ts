import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { googleCompleteSchema } from '@natik/shared';
import type { CookieOptions, Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfigService } from '../../../config/app-config.service';
import type { ClientInfo } from '../auth.service';
import { type AuthedRequest, Public } from '../decorators';
import { readCookie } from '../auth.guard';
import { SessionService } from '../session.service';
import { GoogleAuthService, type GoogleOutcome, safeNextPath } from './google-auth.service';

class GoogleCompleteDto extends createZodDto(googleCompleteSchema) {}

const HOME_FOR_ROLE = { STUDENT: '/dashboard', TEACHER: '/teach', ADMIN: '/admin' } as const;
const STATE_COOKIE = 'natik_gstate';
const PENDING_COOKIE = 'natik_gpending';
/** These cookies are only ever needed by the Google routes. */
const COOKIE_PATH = '/api/v1/auth/google';

const clientOf = (req: AuthedRequest): ClientInfo => ({
  ip: req.ip ?? null,
  userAgent: req.headers['user-agent'] ?? null,
});

/** "Continue with Google" (sign in and sign up) and "Connect Google" in the Profile. */
@ApiTags('Auth')
@Controller('auth')
export class GoogleAuthController {
  private readonly logger = new Logger('Google');

  constructor(
    private readonly google: GoogleAuthService,
    private readonly sessions: SessionService,
    private readonly config: AppConfigService,
  ) {}

  private cookieOptions(maxAgeSeconds: number): CookieOptions {
    const env = this.config.get('APP_ENV');
    return {
      httpOnly: true,
      secure: env === 'production' || env === 'staging',
      // Google sends the person back with a normal link click, which Lax allows.
      sameSite: 'lax',
      path: COOKIE_PATH,
      maxAge: maxAgeSeconds * 1000,
    };
  }

  /**
   * The browser opens the start and callback addresses itself, so a crash must not end as raw JSON on a
   * white page. The cause is logged (with the request id) and the person goes back to try again.
   */
  private bail(req: AuthedRequest, res: Response, error: unknown) {
    const requestId = (req as unknown as { id?: string }).id;
    if (error instanceof AppException) {
      this.logger.warn({ requestId, err: error.message }, 'Google sign-in refused');
    } else {
      this.logger.error({ requestId, err: error }, 'Google sign-in stopped by an error');
    }
    return res.redirect(HttpStatus.FOUND, `${req.user ? '/profile' : '/sign-in'}?google=invalid`);
  }

  /** The sign-in screens ask this to know whether to show the Google button. */
  @Public()
  @Get('providers')
  providers() {
    return { google: this.google.enabled };
  }

  /** The button's address: sends the browser to Google. */
  @Public()
  @Get('google/start')
  async start(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('next') next?: string,
    @Query('mode') mode?: string,
    @Query('login_hint') loginHint?: string,
  ) {
    if (!this.google.enabled) return res.redirect(HttpStatus.FOUND, '/sign-in?google=off');
    const linking = mode === 'link';
    if (linking && !req.user) return res.redirect(HttpStatus.FOUND, '/sign-in?google=signed-out');
    try {
      const { url, state } = await this.google.begin({
        next: safeNextPath(next),
        mode: linking ? 'link' : 'sign-in',
        userId: linking ? (req.user?.id ?? null) : null,
        loginHint: loginHint?.slice(0, 200),
        ip: req.ip ?? null,
      });
      res.cookie(STATE_COOKIE, state, this.cookieOptions(10 * 60));
      return res.redirect(HttpStatus.FOUND, url);
    } catch (error) {
      return this.bail(req, res, error);
    }
  }

  /** Where Google sends the person back to. Always ends by redirecting to a page of the website. */
  @Public()
  @Get('google/callback')
  async callback(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    try {
      const outcome = await this.google.finish({
        code,
        state,
        error,
        stateCookie: readCookie(req.headers.cookie, STATE_COOKIE),
        sessionUserId: req.user?.id ?? null,
        client: clientOf(req),
      });
      res.clearCookie(STATE_COOKIE, { path: COOKIE_PATH });
      return res.redirect(HttpStatus.FOUND, this.apply(outcome, res));
    } catch (failure) {
      return this.bail(req, res, failure);
    }
  }

  /** Sets what the outcome needs (a session, or the "finish signing up" cookie) and says where to go. */
  private apply(outcome: GoogleOutcome, res: Response): string {
    switch (outcome.kind) {
      case 'signed-in':
        this.sessions.setCookie(res, outcome.session);
        return outcome.next ?? HOME_FOR_ROLE[outcome.role];
      case 'pending':
        res.cookie(PENDING_COOKIE, outcome.pendingId, this.cookieOptions(15 * 60));
        return '/register/google';
      case 'linked':
        return '/profile?google=connected';
      case 'failed': {
        const base = outcome.mode === 'link' ? '/profile' : '/sign-in';
        return `${base}?google=${outcome.reason}`;
      }
    }
  }

  /** The last step of a new person's sign-up asks this for the name and email Google gave. */
  @Public()
  @Get('google/pending')
  pending(@Req() req: AuthedRequest) {
    return this.google.pendingInfo(readCookie(req.headers.cookie, PENDING_COOKIE));
  }

  /** A new person accepted the terms: create the account and sign them in. */
  @Public()
  @Post('google/complete')
  @HttpCode(HttpStatus.CREATED)
  async complete(
    @Body() dto: GoogleCompleteDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, role, next } = await this.google.complete({
      pendingId: readCookie(req.headers.cookie, PENDING_COOKIE),
      data: dto,
      client: clientOf(req),
    });
    res.clearCookie(PENDING_COOKIE, { path: COOKIE_PATH });
    this.sessions.setCookie(res, session);
    return { ok: true, home: next ?? HOME_FOR_ROLE[role] };
  }
}
