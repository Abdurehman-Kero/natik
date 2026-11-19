import { Injectable, Logger } from '@nestjs/common';
import { maskEmail } from '@natik/shared';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfigService } from '../../../config/app-config.service';
import type { EmailContent } from './email-templates';

export interface RecentEmail {
  to: string;
  subject: string;
  text: string;
  at: string;
}

const RECENT_LIMIT = 50;

/**
 * Sends email through any SMTP service. With `EMAIL_PROVIDER=console` (the default) nothing leaves the
 * server: the message is logged, and in development it can be read at /api/v1/dev/email.
 *
 * Sending never throws: a mail service that is down must not stop an admin from adding a person. The
 * caller learns whether it was delivered and falls back (SMS, or showing the link on screen).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger('Email');
  private readonly transporter: Transporter | null;
  private readonly from: string;
  /** Console mode only: the last messages, for the development inbox and for tests. */
  private readonly recent: RecentEmail[] = [];

  constructor(private readonly config: AppConfigService) {
    this.from = config.get('EMAIL_FROM') ?? 'Natik <no-reply@natik.local>';
    this.transporter =
      config.get('EMAIL_PROVIDER') === 'smtp'
        ? nodemailer.createTransport({
            host: config.get('SMTP_HOST'),
            port: config.get('SMTP_PORT'),
            // Port 465 is encrypted from the first byte; the others upgrade with STARTTLS.
            secure: config.get('SMTP_PORT') === 465,
            ...(config.get('SMTP_USER')
              ? { auth: { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASSWORD') } }
              : {}),
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
          })
        : null;
  }

  /** True when messages really leave the server. */
  get delivers(): boolean {
    return this.transporter !== null;
  }

  async send(to: string, content: EmailContent): Promise<{ delivered: boolean }> {
    if (!this.transporter) {
      this.logger.log(`[dev] email to ${maskEmail(to)}: ${content.subject}`);
      this.recent.unshift({
        to,
        subject: content.subject,
        text: content.text,
        at: new Date().toISOString(),
      });
      this.recent.length = Math.min(this.recent.length, RECENT_LIMIT);
      return { delivered: false };
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      return { delivered: true };
    } catch (error) {
      // Never log the message itself: it holds a password link.
      this.logger.error(
        `Email to ${maskEmail(to)} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { delivered: false };
    }
  }

  /** The last messages kept in console mode (newest first). */
  recentMessages(): RecentEmail[] {
    return this.recent;
  }
}
