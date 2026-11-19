import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppConfigService } from '../../config/app-config.service';
import { createHarness, type Harness } from '../../test/harness';
import { parseByteRange, StorageService } from './storage.service';

/** Files kept inside PostgreSQL (STORAGE_DRIVER=database): what the free pilot relies on. */
describe('database file storage', () => {
  let h: Harness;
  let storage: StorageService;
  const keys: string[] = [];
  const key = (name: string) => {
    const k = `test/${Date.now()}-${Math.random().toString(36).slice(2)}-${name}`;
    keys.push(k);
    return k;
  };

  beforeAll(async () => {
    h = await createHarness();
    const config = { get: (name: string) => (name === 'STORAGE_DRIVER' ? 'database' : '') };
    storage = new StorageService(config as unknown as AppConfigService, h.prisma as never);
  });
  afterAll(async () => {
    await h.prisma.storedObject.deleteMany({ where: { key: { in: keys } } });
    await h?.close();
  });

  const collect = async (stream: AsyncIterable<unknown>) => {
    const parts: Buffer[] = [];
    for await (const part of stream) parts.push(Buffer.from(part as Uint8Array));
    return Buffer.concat(parts);
  };

  it('stores a file, reads it back and replaces it', async () => {
    const k = key('a.bin');
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 255]);
    await storage.put(k, bytes, 'application/octet-stream');
    const first = await storage.read(k);
    expect(first.contentType).toBe('application/octet-stream');
    expect(first.body.equals(bytes)).toBe(true);

    await storage.put(k, Buffer.from('new text'), 'text/plain');
    const second = await storage.read(k);
    expect(second).toMatchObject({ contentType: 'text/plain' });
    expect(second.body.toString()).toBe('new text');
  });

  it('streams a whole file, or just the part that was asked for', async () => {
    const k = key('digits.txt');
    await storage.put(k, Buffer.from('0123456789'), 'text/plain');

    const whole = await storage.stream(k);
    expect(whole).toMatchObject({ contentLength: 10, partial: false, contentType: 'text/plain' });
    expect((await collect(whole.body)).toString()).toBe('0123456789');

    const middle = await storage.stream(k, 'bytes=2-5');
    expect(middle).toMatchObject({ contentLength: 4, contentRange: 'bytes 2-5/10', partial: true });
    expect((await collect(middle.body)).toString()).toBe('2345');

    const rest = await storage.stream(k, 'bytes=7-');
    expect(rest.contentRange).toBe('bytes 7-9/10');
    expect((await collect(rest.body)).toString()).toBe('789');

    const tail = await storage.stream(k, 'bytes=-3');
    expect(tail.contentRange).toBe('bytes 7-9/10');
    expect((await collect(tail.body)).toString()).toBe('789');

    // Asking past the end is clamped, like a bucket does.
    const clamped = await storage.stream(k, 'bytes=8-99');
    expect((await collect(clamped.body)).toString()).toBe('89');
  });

  it('refuses a range that starts after the end', async () => {
    const k = key('short.txt');
    await storage.put(k, Buffer.from('abc'), 'text/plain');
    await expect(storage.stream(k, 'bytes=10-20')).rejects.toMatchObject({ name: 'InvalidRange' });
  });

  it('reads big files in pieces and gets every byte right, also across the piece boundary', async () => {
    const k = key('big.bin');
    const big = randomBytes(3 * 1024 * 1024 + 123);
    await storage.put(k, big, 'application/octet-stream');
    expect((await collect((await storage.stream(k)).body)).equals(big)).toBe(true);

    const from = 1024 * 1024 - 5;
    const crossing = await storage.stream(k, `bytes=${from}-${from + 9}`);
    expect((await collect(crossing.body)).equals(big.subarray(from, from + 10))).toBe(true);
  });

  it('deletes a file, and a missing file is an error to read but fine to delete again', async () => {
    const k = key('gone.txt');
    await storage.put(k, Buffer.from('bye'), 'text/plain');
    await storage.remove(k);
    await expect(storage.read(k)).rejects.toThrow();
    await expect(storage.stream(k)).rejects.toThrow();
    await storage.remove(k);
  });

  it('has no bucket links: the API sends the file itself', async () => {
    expect(await storage.signedUrl('anything')).toBeNull();
  });
});

describe('byte ranges', () => {
  it('reads the three forms of the Range header', () => {
    expect(parseByteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseByteRange('bytes=-5000', 1000)).toEqual({ start: 0, end: 999 });
  });
  it('ignores what is not a range and refuses what cannot be met', () => {
    expect(parseByteRange('items=1-2', 10)).toBeNull();
    expect(parseByteRange('bytes=-', 10)).toBeNull();
    expect(() => parseByteRange('bytes=20-30', 10)).toThrow();
    expect(() => parseByteRange('bytes=5-2', 10)).toThrow();
  });
});
