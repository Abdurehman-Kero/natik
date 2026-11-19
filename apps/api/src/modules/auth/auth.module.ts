import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiter } from '../../common/security/rate-limiter';
import { AppConfigService } from '../../config/app-config.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { GoogleAuthController } from './google/google-auth.controller';
import { GoogleAuthService } from './google/google-auth.service';
import {
  DevGoogleOAuthClient,
  DisabledGoogleOAuthClient,
  GoogleOAuthClient,
  RealGoogleOAuthClient,
} from './google/google-oauth.client';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';

/** Register, SMS codes, sign-in, sessions, password reset (SRS AUTH). */
@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    {
      provide: GoogleOAuthClient,
      inject: [AppConfigService],
      // Chosen by GOOGLE_CLIENT_ID: empty = no Google button, `dev` = a fake for development and tests.
      useFactory: (config: AppConfigService): GoogleOAuthClient => {
        const id = config.get('GOOGLE_CLIENT_ID');
        if (!id) return new DisabledGoogleOAuthClient();
        if (id === 'dev') return new DevGoogleOAuthClient();
        return new RealGoogleOAuthClient(id, config.get('GOOGLE_CLIENT_SECRET') ?? '');
      },
    },
    OtpService,
    SessionService,
    RateLimiter,
    // Every route requires sign-in unless marked @Public() (BR-ROLE-003).
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, SessionService, RateLimiter],
})
export class AuthModule {}
