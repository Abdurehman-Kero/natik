import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../../../jobs/queues';
import { PrismaService } from '../../../prisma/prisma.service';
import { SmsProvider } from './sms-provider';
import { SMS_MAX_ATTEMPTS, SMS_RETRY_DELAYS_MS } from './sms.service';

/** Sends queued SMS; retries 3 times (1, 5, 15 min), then marks FAILED for the admin view (FR-NOTIF-004). */
@Processor(QUEUES.SMS, {
  settings: {
    backoffStrategy: (attemptsMade: number) =>
      SMS_RETRY_DELAYS_MS[Math.min(attemptsMade, SMS_RETRY_DELAYS_MS.length) - 1] ?? 900_000,
  },
})
export class SmsProcessor extends WorkerHost {
  private readonly logger = new Logger('SmsWorker');

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: SmsProvider,
  ) {
    super();
  }

  async process(job: Job<{ smsId: string }>): Promise<void> {
    const message = await this.prisma.smsMessage.findUnique({ where: { id: job.data.smsId } });
    if (!message || message.status === 'SENT') return;
    try {
      const { providerId } = await this.provider.send(message.to, message.body);
      await this.prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerId,
          attempts: { increment: 1 },
          lastError: null,
        },
      });
    } catch (error) {
      const final = job.attemptsMade + 1 >= (job.opts.attempts ?? SMS_MAX_ATTEMPTS);
      const reason = error instanceof Error ? error.message.slice(0, 300) : 'Unknown error';
      await this.prisma.smsMessage.update({
        where: { id: message.id },
        data: {
          status: final ? 'FAILED' : 'QUEUED',
          attempts: { increment: 1 },
          lastError: reason,
        },
      });
      this.logger.warn(
        `SMS ${message.id} failed (${final ? 'giving up' : 'will retry'}): ${reason}`,
      );
      throw error;
    }
  }
}
