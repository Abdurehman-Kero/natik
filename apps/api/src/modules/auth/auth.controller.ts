import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  forgotPasswordSchema,
  normalizePhone,
  registerSchema,
  setPasswordSchema,
  signInSchema,
  verifyResetCodeSchema,
} from '@natik/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { AuthService, type ClientInfo } from './auth.service';
import { type AuthedRequest, Public } from './decorators';
import { SessionService } from './session.service';

class RegisterDto extends createZodDto(registerSchema) {}
class SignInDto extends createZodDto(signInSchema) {}
class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
class VerifyResetCodeDto extends createZodDto(verifyResetCodeSchema) {}
class SetPasswordDto extends createZodDto(setPasswordSchema) {}

const clientOf = (req: AuthedRequest): ClientInfo => ({
  ip: req.ip ?? null,
  userAgent: req.headers['user-agent'] ?? null,
});

const HOME_FOR_ROLE = { STUDENT: '/dashboard', TEACHER: '/teach', ADMIN: '/admin' } as const;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  /** Creates the account and signs the person in; no SMS code is involved. */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, role } = await this.auth.register(dto, clientOf(req));
    this.sessions.setCookie(res, session);
    return { ok: true, home: HOME_FOR_ROLE[role] };
  }

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() dto: SignInDto,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { session, role } = await this.auth.signIn(dto, clientOf(req));
    this.sessions.setCookie(res, session);
    return { ok: true, home: HOME_FOR_ROLE[role] };
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  async signOut(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.signOut(req.sessionId);
    this.sessions.clearCookie(res);
    return { ok: true };
  }

  /** Always the same answer, whether or not the number has an account. */
  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  async forgot(@Body() dto: ForgotPasswordDto, @Req() req: AuthedRequest) {
    await this.auth.forgotPassword(normalizePhone(dto.phone)!, clientOf(req));
    return { ok: true };
  }

  @Public()
  @Post('password/verify-code')
  @HttpCode(HttpStatus.OK)
  verifyResetCode(@Body() dto: VerifyResetCodeDto, @Req() req: AuthedRequest) {
    return this.auth.verifyResetCode(normalizePhone(dto.phone)!, dto.code, clientOf(req));
  }

  /** Used by the reset flow and by the SMS "set your password" link. */
  @Public()
  @Post('password/set')
  @HttpCode(HttpStatus.OK)
  async setPassword(@Body() dto: SetPasswordDto, @Req() req: AuthedRequest) {
    await this.auth.setPassword(dto.token, dto.newPassword, clientOf(req));
    return { ok: true };
  }
}
