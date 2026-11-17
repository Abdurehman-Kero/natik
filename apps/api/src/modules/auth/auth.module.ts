import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiter } from '../../common/security/rate-limiter';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';

/** Register, SMS codes, sign-in, sessions, password reset (SRS AUTH). */
@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    RateLimiter,
    // Every route requires sign-in unless marked @Public() (BR-ROLE-003).
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, SessionService, RateLimiter],
})
export class AuthModule {}
