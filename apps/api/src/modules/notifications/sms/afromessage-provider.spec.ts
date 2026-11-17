import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import { AfroMessageSmsProvider } from './afromessage-provider';

const config = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as AppConfigService;

const base = {
  AFROMESSAGE_TOKEN: 'secret-token',
  AFROMESSAGE_BASE_URL: 'https://api.afromessage.com/api',
  SMS_SENDER: 'Natik',
};

describe('AfroMessageSmsProvider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('posts the message with the bearer token and returns the gateway id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ acknowledge: 'success', response: { message_id: 'm-1' } }), {
        status: 200,
      }),
    );
    const result = await new AfroMessageSmsProvider(config(base)).send(
      '+251911000002',
      'Natik: your code is 123456.',
    );
    expect(result.providerId).toBe('m-1');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.afromessage.com/api/send');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    expect(JSON.parse(init!.body as string)).toEqual({
      to: '+251911000002',
      message: 'Natik: your code is 123456.',
      sender: 'Natik',
    });
  });

  it('throws (so the queue retries) when the gateway refuses, without leaking the token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ acknowledge: 'error', message: 'Invalid sender' }), {
        status: 200,
      }),
    );
    const promise = new AfroMessageSmsProvider(config(base)).send('+251911000002', 'x');
    await expect(promise).rejects.toThrow(/refused.*Invalid sender/);
    await expect(promise).rejects.not.toThrow(/secret-token/);
  });

  it('throws when the gateway cannot be reached or returns an HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(
      new AfroMessageSmsProvider(config(base)).send('+251911000002', 'x'),
    ).rejects.toThrow(/unreachable/);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 401 }));
    await expect(
      new AfroMessageSmsProvider(config(base)).send('+251911000002', 'x'),
    ).rejects.toThrow(/HTTP 401/);
  });

  it('requires a token', async () => {
    await expect(
      new AfroMessageSmsProvider(config({ ...base, AFROMESSAGE_TOKEN: undefined })).send(
        '+251911000002',
        'x',
      ),
    ).rejects.toThrow(/TOKEN/);
  });
});
