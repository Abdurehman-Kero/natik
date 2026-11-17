import { Injectable, Logger } from '@nestjs/common';

/** One adapter per gateway; the real Ethiopian gateway is added once Natik chooses it (README Q2). */
export abstract class SmsProvider {
  /** Returns the gateway's message id, if it has one. Throws if the message could not be sent. */
  abstract send(to: string, body: string): Promise<{ providerId?: string }>;
}

/** Development driver: nothing is sent. The message is logged and visible at /api/v1/dev/sms. */
@Injectable()
export class ConsoleSmsProvider extends SmsProvider {
  private readonly logger = new Logger('SMS');

  async send(to: string, body: string): Promise<{ providerId?: string }> {
    this.logger.log(`[dev] to ${to.slice(0, 7)}•••••: ${body}`);
    return { providerId: 'console' };
  }
}
