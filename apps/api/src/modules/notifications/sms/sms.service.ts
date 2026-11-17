import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUES } from '../../../jobs/queues';
import { PrismaService } from '../../../prisma/prisma.service';
import { renderSms, type SmsParams, type SmsTemplate } from './sms-templates';

export const SMS_MAX_ATTEMPTS = 4; // first try + retries after 1, 5 and 15 minutes
export const SMS_RETRY_DELAYS_MS = [60_000, 300_000, 900_000];

const JOB_OPTIONS = { attempts: SMS_MAX_ATTEMPTS, backoff: { type: 'custom' } } as const;

@Injectable()
export class SmsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.SMS) private readonly queue: Queue,
  ) {}

  /** Saves the message and queues it. Returns immediately; sending happens in the worker. */
  async send<T extends SmsTemplate>(
    to: string,
    template: T,
    params: SmsParams<T>,
  ): Promise<string> {
    const body = renderSms(template, params);
    const message = await this.prisma.smsMessage.create({ data: { to, template, body } });
    await this.queue.add('send', { smsId: message.id }, JOB_OPTIONS);
    return message.id;
  }

  /** Admin "Retry" for a FAILED message (list view arrives in M7). */
  async retry(id: string): Promise<void> {
    await this.prisma.smsMessage.update({
      where: { id },
      data: { status: 'QUEUED', lastError: null },
    });
    await this.queue.add('send', { smsId: id }, JOB_OPTIONS);
  }
}
