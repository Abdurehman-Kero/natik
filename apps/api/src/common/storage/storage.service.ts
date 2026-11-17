import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { AppConfigService } from '../../config/app-config.service';

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

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(config: AppConfigService) {
    this.bucket = config.get('S3_BUCKET');
    this.s3 = new S3Client({
      endpoint: config.get('S3_ENDPOINT'),
      region: config.get('S3_REGION'),
      forcePathStyle: config.get('S3_FORCE_PATH_STYLE'),
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY'),
        secretAccessKey: config.get('S3_SECRET_KEY'),
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Reads a stored file (used for images served to visitors with long cache headers). */
  async read(key: string): Promise<{ body: Buffer; contentType: string }> {
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
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** A temporary link the browser can open directly. Create it only after an access check. */
  signedUrl(key: string, options: { download?: string } = {}): Promise<string> {
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
}
