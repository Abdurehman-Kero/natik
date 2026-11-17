import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUES } from '../../jobs/queues';
import { RetentionService } from './retention.service';

/** The daily data-keeping clean-up at 02:00 East Africa Time (ARCHITECTURE §11). */
@Processor(QUEUES.RETENTION)
@Injectable()
export class RetentionProcessor extends WorkerHost implements OnApplicationBootstrap {
  constructor(
    private readonly retention: RetentionService,
    @InjectQueue(QUEUES.RETENTION) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'retention-cleanup',
      { pattern: '0 2 * * *', tz: 'Africa/Addis_Ababa' },
      { name: 'cleanup' },
    );
  }

  async process(job: Job): Promise<{ deleted: number; erased: number } | null> {
    return job.name === 'cleanup' ? this.retention.cleanup() : null;
  }
}
