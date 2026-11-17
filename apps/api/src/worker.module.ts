import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { ProcessorsModule } from './jobs/processors.module';

/** The background worker: queues and scheduled jobs, no HTTP server. */
@Module({
  imports: [CoreModule, ProcessorsModule],
})
export class WorkerModule {}
