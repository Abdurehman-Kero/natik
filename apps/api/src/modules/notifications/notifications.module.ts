import { Module } from '@nestjs/common';
import { QueueModule } from '../../jobs/queue.module';
import { AppConfigService } from '../../config/app-config.service';
import {
  AdminAnnouncementsController,
  StudentAnnouncementsController,
  TeachAnnouncementsController,
} from './announcements.controller';
import { AnnouncementsService } from './announcements.service';
import { AdminSmsController } from './admin-sms.controller';
import { DevEmailController } from './email/dev-email.controller';
import { EmailService } from './email/email.service';
import { AfroMessageSmsProvider } from './sms/afromessage-provider';
import { DevAccountsController, DevSmsController } from './sms/dev-sms.controller';
import { ConsoleSmsProvider, SmsProvider } from './sms/sms-provider';
import { SmsService } from './sms/sms.service';

/** SMS outbox now; announcements and read markers arrive in M4/M5 (FR-NOTIF). */
@Module({
  imports: [QueueModule],
  controllers: [
    DevSmsController,
    DevAccountsController,
    DevEmailController,
    AdminAnnouncementsController,
    TeachAnnouncementsController,
    StudentAnnouncementsController,
    AdminSmsController,
  ],
  providers: [
    SmsService,
    EmailService,
    AnnouncementsService,
    {
      provide: SmsProvider,
      inject: [AppConfigService],
      // Chosen by SMS_PROVIDER, so the gateway can change without touching code.
      useFactory: (config: AppConfigService): SmsProvider =>
        config.get('SMS_PROVIDER') === 'afromessage'
          ? new AfroMessageSmsProvider(config)
          : new ConsoleSmsProvider(),
    },
  ],
  exports: [SmsService, SmsProvider, EmailService, AnnouncementsService],
})
export class NotificationsModule {}
