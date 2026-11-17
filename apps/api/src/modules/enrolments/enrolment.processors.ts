import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUES } from '../../jobs/queues';
import { EnrolmentsService } from './enrolments.service';
import { ProgressService } from './progress.service';

/** The schedule is in East Africa Time (ARCHITECTURE §11). */
const TZ = 'Africa/Addis_Ababa';

const SCHEDULES = [
  { id: 'enrolment-cancel-unpaid', name: 'cancelUnpaid', pattern: '0 * * * *' }, // hourly
  { id: 'enrolment-expire', name: 'expire', pattern: '5 0 * * *' }, // daily 00:05
  { id: 'enrolment-remind-expiry', name: 'remindExpiry', pattern: '0 9 * * *' }, // daily 09:00
] as const;

/** Cancels unpaid enrolments, expires ended access and sends the 3-day reminder. */
@Processor(QUEUES.ENROLMENT)
@Injectable()
export class EnrolmentProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger('EnrolmentJobs');

  constructor(
    private readonly enrolments: EnrolmentsService,
    @InjectQueue(QUEUES.ENROLMENT) private readonly queue: Queue,
  ) {
    super();
  }

  /** Registers the repeating jobs. Safe to run on every start: the same id just updates the schedule. */
  async onApplicationBootstrap(): Promise<void> {
    for (const s of SCHEDULES) {
      await this.queue.upsertJobScheduler(s.id, { pattern: s.pattern, tz: TZ }, { name: s.name });
    }
  }

  async process(job: Job): Promise<number> {
    switch (job.name) {
      case 'cancelUnpaid':
        return this.enrolments.cancelUnpaid();
      case 'expire':
        return this.enrolments.expireDue();
      case 'remindExpiry':
        return this.enrolments.remindExpiring();
      default:
        this.logger.warn(`Unknown enrolment job "${job.name}"`);
        return 0;
    }
  }
}

/** Recalculates every student's progress after lessons are published, hidden or removed. */
@Processor(QUEUES.PROGRESS)
@Injectable()
export class ProgressProcessor extends WorkerHost {
  constructor(private readonly progress: ProgressService) {
    super();
  }

  async process(job: Job<{ courseId: string }>): Promise<number> {
    if (job.name !== 'recalc') return 0;
    return this.progress.recalcCourse(job.data.courseId);
  }
}
