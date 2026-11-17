import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { ChatModule } from './chat/chat.module';
import { CertificatesModule } from './certificates/certificates.module';
import { ContentModule } from './content/content.module';
import { EnrolmentsModule } from './enrolments/enrolments.module';
import { LearningModule } from './learning/learning.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { SiteModule } from './site/site.module';
import { UsersModule } from './users/users.module';

/** One module per SRS area (ARCHITECTURE §4, NFR-MAINT-002). */
export const FEATURE_MODULES = [
  AuthModule,
  UsersModule,
  CatalogModule,
  ContentModule,
  EnrolmentsModule,
  PaymentsModule,
  LearningModule,
  QuizzesModule,
  CertificatesModule,
  ChatModule,
  NotificationsModule,
  SiteModule,
  ReportsModule,
  AuditModule,
  SettingsModule,
];
