import { HttpStatus, Injectable } from '@nestjs/common';
import { bytesToMb, UPLOAD_LIMITS } from '@natik/shared';
import sharp, { type Sharp } from 'sharp';
import { AppException } from '../errors/app.exception';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

@Injectable()
export class ImageService {
  /**
   * Checks the real file content (not the name or the browser's claim), then re-encodes it to a small
   * WebP. Re-encoding also removes anything hidden in the file (NFR-SEC-004, NFR-PERF-003).
   */
  async toAvatar(input: Buffer, maxBytes = UPLOAD_LIMITS.image.maxBytes): Promise<Buffer> {
    return this.encode(input, maxBytes, (image) =>
      image.rotate().resize(320, 320, { fit: 'cover', position: 'centre' }),
    );
  }

  /** Course picture: 3:2, fits cards and the course page. */
  async toCourseImage(input: Buffer, maxBytes = UPLOAD_LIMITS.image.maxBytes): Promise<Buffer> {
    return this.encode(input, maxBytes, (image) =>
      image.rotate().resize(1200, 800, { fit: 'cover', position: 'attention' }),
    );
  }

  /** Picture inside a lesson: as wide as a phone needs, never enlarged. */
  async toLessonImage(input: Buffer, maxBytes = UPLOAD_LIMITS.image.maxBytes): Promise<Buffer> {
    return this.encode(input, maxBytes, (image) =>
      image.rotate().resize({ width: 1400, withoutEnlargement: true }),
    );
  }

  /** The still picture shown before a video plays: 16:9, as wide as a laptop screen needs. */
  async toVideoPoster(input: Buffer, maxBytes = UPLOAD_LIMITS.image.maxBytes): Promise<Buffer> {
    return this.encode(input, maxBytes, (image) =>
      image.rotate().resize(1280, 720, { fit: 'cover', position: 'attention' }),
    );
  }

  /** Signature picture for certificates: small, keeps transparency. */
  async toSignature(input: Buffer, maxBytes = UPLOAD_LIMITS.image.maxBytes): Promise<Buffer> {
    return this.encode(input, maxBytes, (image) =>
      image.rotate().resize({ width: 600, height: 240, fit: 'inside', withoutEnlargement: true }),
    );
  }

  /** Payment receipt photo: kept readable (text must stay sharp) but never huge. */
  async toReceipt(input: Buffer, maxBytes = UPLOAD_LIMITS.receipt.maxBytes): Promise<Buffer> {
    return this.encode(input, maxBytes, (image) =>
      image.rotate().resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true }),
    );
  }

  private async encode(
    input: Buffer,
    maxBytes: number,
    transform: (image: Sharp) => Sharp,
  ): Promise<Buffer> {
    if (input.length > maxBytes) {
      throw new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, {
        message: `This file is ${bytesToMb(input.length)} MB. The maximum is ${bytesToMb(maxBytes)} MB.`,
        params: { size: bytesToMb(input.length), max: bytesToMb(maxBytes) },
      });
    }
    try {
      const image = sharp(input, { failOn: 'error', limitInputPixels: 40_000_000 });
      const meta = await image.metadata();
      if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new Error('format');
      return await transform(image).webp({ quality: 82 }).toBuffer();
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
  }
}
