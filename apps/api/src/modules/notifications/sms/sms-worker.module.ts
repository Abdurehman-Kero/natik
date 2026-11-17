import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications.module';
import { SmsProcessor } from './sms.processor';

/** Registers the SMS queue worker (imported by the worker process only). */
@Module({ imports: [NotificationsModule], providers: [SmsProcessor] })
export class SmsWorkerModule {}
