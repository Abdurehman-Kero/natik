import { Module } from '@nestjs/common';
import { QueueModule } from '../../jobs/queue.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EnrolmentMachine } from './enrolment-machine';
import { EnrolmentProcessor, ProgressProcessor } from './enrolment.processors';
import { AdminEnrolmentsController, EnrolmentsController } from './enrolments.controller';
import { EnrolmentsService } from './enrolments.service';
import { ProgressService } from './progress.service';

/** Enrolment state machine, progress and expiry (FR-ENR, FR-LEARN-004). */
@Module({
  imports: [NotificationsModule, QueueModule],
  controllers: [EnrolmentsController, AdminEnrolmentsController],
  providers: [EnrolmentMachine, ProgressService, EnrolmentsService],
  exports: [EnrolmentMachine, ProgressService, EnrolmentsService],
})
export class EnrolmentsModule {}

/** The background jobs for enrolments. Imported by the worker side only (see ProcessorsModule). */
@Module({
  // AuditModule is listed because the worker process does not load the API's feature modules.
  imports: [AuditModule, QueueModule, EnrolmentsModule],
  providers: [EnrolmentProcessor, ProgressProcessor],
})
export class EnrolmentsWorkerModule {}
