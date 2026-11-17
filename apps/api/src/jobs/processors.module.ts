import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { CertificatesWorkerModule } from '../modules/certificates/certificates.module';
import { EnrolmentsWorkerModule } from '../modules/enrolments/enrolments.module';
import { QuizzesWorkerModule } from '../modules/quizzes/quizzes.module';
import { UsersWorkerModule } from '../modules/users/users.module';
import { SmsWorkerModule } from '../modules/notifications/sms/sms-worker.module';
import { QUEUE_NAMES } from './queues';

/**
 * Queue processors and scheduled jobs live here. It runs in the worker process,
 * or inside the API when RUN_WORKER_IN_API=true (local development).
 * M1 registers the queues only; each later milestone adds its processors.
 */
@Module({
  imports: [
    SmsWorkerModule,
    EnrolmentsWorkerModule,
    QuizzesWorkerModule,
    CertificatesWorkerModule,
    UsersWorkerModule,
  ],
})
export class ProcessorsModule implements OnApplicationBootstrap {
  private readonly logger = new Logger('Worker');

  onApplicationBootstrap(): void {
    this.logger.log(`Worker ready. Queues: ${QUEUE_NAMES.join(', ')}`);
  }
}
