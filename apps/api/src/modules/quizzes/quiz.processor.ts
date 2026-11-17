import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { QUEUES } from '../../jobs/queues';
import { AttemptGrader } from './attempt-grader.service';

/** Submits attempts whose time ran out, every minute, with whatever the student saved (FR-QUIZ-007). */
@Processor(QUEUES.QUIZ)
@Injectable()
export class QuizProcessor extends WorkerHost implements OnApplicationBootstrap {
  constructor(
    private readonly grader: AttemptGrader,
    @InjectQueue(QUEUES.QUIZ) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'quiz-auto-submit',
      { pattern: '* * * * *' },
      { name: 'autoSubmit' },
    );
  }

  async process(job: Job): Promise<number> {
    return job.name === 'autoSubmit' ? this.grader.submitDue() : 0;
  }
}
