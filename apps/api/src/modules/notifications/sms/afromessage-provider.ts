import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../../config/app-config.service';
import { SmsProvider } from './sms-provider';

const TIMEOUT_MS = 10_000;

interface AfroResponse {
  acknowledge?: string;
  response?: { status?: string; message_id?: string; errors?: unknown } | null;
  message?: string;
}

/**
 * Real SMS through Afro Message (an Ethiopian gateway): POST {base}/send with a bearer token.
 * Any problem throws, so the queue retries (1, 5, 15 min) and then shows the message as FAILED.
 */
@Injectable()
export class AfroMessageSmsProvider extends SmsProvider {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  async send(to: string, body: string): Promise<{ providerId?: string }> {
    const token = this.config.get('AFROMESSAGE_TOKEN');
    if (!token) throw new Error('AFROMESSAGE_TOKEN is not set');

    const payload: Record<string, string> = {
      to,
      message: body,
      sender: this.config.get('SMS_SENDER'),
    };
    const identifier = this.config.get('AFROMESSAGE_IDENTIFIER_ID');
    if (identifier) payload.from = identifier;

    let res: Response;
    try {
      res = await fetch(`${this.config.get('AFROMESSAGE_BASE_URL')}/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `SMS gateway unreachable: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    const data = (await res.json().catch(() => ({}))) as AfroResponse;
    if (!res.ok || data.acknowledge !== 'success') {
      const detail = data.message ?? JSON.stringify(data.response?.errors ?? data.response ?? {});
      // Never include the token or message text in the error.
      throw new Error(
        `SMS gateway refused the message (HTTP ${res.status}): ${detail}`.slice(0, 300),
      );
    }
    return { providerId: data.response?.message_id };
  }
}
