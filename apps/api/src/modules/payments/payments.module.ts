import { Module } from '@nestjs/common';
import { EnrolmentsModule } from '../enrolments/enrolments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentAccountsService } from './payment-accounts.service';
import {
  AdminPaymentsController,
  PaymentAccountsController,
  StudentPaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';

/** Payment submissions, the admin queue, cash and payment accounts (FR-PAY). */
@Module({
  imports: [EnrolmentsModule, NotificationsModule],
  controllers: [StudentPaymentsController, AdminPaymentsController, PaymentAccountsController],
  providers: [PaymentsService, PaymentAccountsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
