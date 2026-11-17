import { Module } from '@nestjs/common';
import { QueueModule } from '../../jobs/queue.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CertificateProcessor } from './certificate.processor';
import { AdminCertificatesController, MyCertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

/** Requests, approval, PDF, verify, cancel (FR-CERT). */
@Module({
  imports: [QueueModule, NotificationsModule],
  controllers: [MyCertificatesController, AdminCertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}

/** The certificate job. Imported by the worker side only (see ProcessorsModule). */
@Module({
  imports: [AuditModule, QueueModule, CertificatesModule],
  providers: [CertificateProcessor],
})
export class CertificatesWorkerModule {}
