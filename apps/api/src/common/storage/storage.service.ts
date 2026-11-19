import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

export interface StoredStream {
  body: Readable;
  contentType: string;
  contentLength?: number;
  contentRange?: string;
  /** True when only the requested byte range was returned (HTTP 206). */
  partial: boolean;
}

/** Links to private files expire after 5 minutes (FR-LEARN-010). */
export const SIGNED_URL_TTL_SECONDS = 300;

/** A file is read from the database in pieces of this size, so a big video never sits in memory whole. */
const CHUNK_BYTES = 1024 * 1024;

/**
 * Reads an HTTP `Range` header for a file of `size` bytes: `bytes=0-99`, `bytes=100-` or `bytes=-500`.
 * Returns null when the header is not a range (the whole file is sent then).
 */
export function parseByteRange(
  header: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start: number;
  let end: number;
  if (match[1] === '') {
    // The last N bytes.
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) {
    const error = new Error('The requested range cannot be satisfied.');
    error.name = 'InvalidRange';
    throw error;
  }
  return { start, end };
}

/**
 * Private file storage. Files live in an S3-compatible bucket (production) or, for the free pilot and
 * for tests, inside PostgreSQL (`STORAGE_DRIVER=database`). Everything else in the API only sees these
 * methods, so switching later is a setting plus one copy of the files (see docs/PILOT-HOSTING.md).
 */
@Injectable()
export class StorageService {
  private readonly driver: 's3' | 'database';
  private readonly s3: S3Client | null;
  private readonly bucket: string;

  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.driver = config.get('STORAGE_DRIVER');
    this.bucket = config.get('S3_BUCKET');
    this.s3 =
      this.driver === 's3'
        ? new S3Client({
            endpoint: config.get('S3_ENDPOINT'),
            region: config.get('S3_REGION'),
            forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
            credentials: {
              accessKeyId: config.get('S3_ACCESS_KEY'),
              secretAccessKey: config.get('S3_SECRET_KEY'),
            },
          })
        : null;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (!this.s3) {
      const data = new Uint8Array(body);
      await this.prisma.storedObject.upsert({
        where: { key },
        create: { key, contentType, size: body.length, data },
        update: { contentType, size: body.length, data },
      });
      return;
    }
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Reads a stored file (used for images served to visitors with long cache headers). */
  async read(key: string): Promise<{ body: Buffer; contentType: string }> {
    if (!this.s3) {
      const row = await this.prisma.storedObject.findUnique({ where: { key } });
      if (!row) throw new Error(`Empty object: ${key}`);
      return { body: Buffer.from(row.data), contentType: row.contentType };
    }
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty object: ${key}`);
    return { body: Buffer.from(bytes), contentType: res.ContentType ?? 'application/octet-stream' };
  }

  /**
   * Opens a stored file for streaming, optionally a byte range (audio and video need ranges so
   * people can skip ahead without downloading everything).
   */
  async stream(key: string, range?: string): Promise<StoredStream> {
    if (!this.s3) return this.streamFromDatabase(key, range);
    const res = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range }),
    );
    if (!res.Body) throw new Error(`Empty object: ${key}`);
    return {
      body: res.Body as Readable,
      contentType: res.ContentType ?? 'application/octet-stream',
      contentLength: res.ContentLength,
      contentRange: res.ContentRange,
      partial: Boolean(range && res.ContentRange),
    };
  }

  async remove(key: string): Promise<void> {
    if (!this.s3) {
      await this.prisma.storedObject.deleteMany({ where: { key } });
      return;
    }
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * A temporary link the browser can open directly. Create it only after an access check. With
   * database storage there is no such link (null): the API sends the file itself.
   */
  async signedUrl(key: string, options: { download?: string } = {}): Promise<string | null> {
    if (!this.s3) return null;
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: options.download
          ? `attachment; filename="${encodeURIComponent(options.download)}"`
          : undefined,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  }

  private async streamFromDatabase(key: string, range?: string): Promise<StoredStream> {
    const meta = await this.prisma.storedObject.findUnique({
      where: { key },
      select: { contentType: true, size: true },
    });
    if (!meta) throw new Error(`Empty object: ${key}`);
    const bounds = range ? parseByteRange(range, meta.size) : null;
    const start = bounds?.start ?? 0;
    const end = bounds?.end ?? meta.size - 1;
    return {
      body: Readable.from(this.chunks(key, start, end), { objectMode: false }),
      contentType: meta.contentType,
      contentLength: Math.max(end - start + 1, 0),
      contentRange: bounds ? `bytes ${start}-${end}/${meta.size}` : undefined,
      partial: bounds !== null,
    };
  }

  /** The bytes `start`…`end` (inclusive) of a stored file, one piece at a time. */
  private async *chunks(key: string, start: number, end: number): AsyncGenerator<Buffer> {
    for (let position = start; position <= end; position += CHUNK_BYTES) {
      const length = Math.min(CHUNK_BYTES, end - position + 1);
      const rows = await this.prisma.$queryRaw<{ piece: Uint8Array }[]>`
        SELECT substring("data" FROM ${position + 1}::int FOR ${length}::int) AS piece
          FROM "StoredObject" WHERE "key" = ${key}`;
      const piece = rows[0]?.piece;
      if (!piece) return;
      yield Buffer.from(piece);
    }
  }
}
