import { HttpStatus, Injectable } from '@nestjs/common';
import { bytesToMb, UPLOAD_LIMITS } from '@natik/shared';
import { AccessPolicy, type Actor } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { createId } from '../../common/security/ids';
import { ImageService } from '../../common/storage/image.service';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type DetectedKind, detectFile } from './file-types';

export type UploadPurpose =
  | 'LESSON_PDF'
  | 'LESSON_AUDIO'
  | 'LESSON_IMAGE'
  | 'LESSON_FILE'
  | 'COURSE_IMAGE'
  | 'QUESTION_MEDIA'
  | 'SIGNATURE'
  | 'SITE_IMAGE';

/** The older Office formats can only be told apart by their name. */
const OLE_TYPES: Record<string, string> = {
  ppt: 'application/vnd.ms-powerpoint',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
};

const PURPOSE_RULES: Record<UploadPurpose, { kind: DetectedKind; limit: { maxBytes: number } }> = {
  LESSON_PDF: { kind: 'pdf', limit: UPLOAD_LIMITS.pdf },
  LESSON_AUDIO: { kind: 'audio', limit: UPLOAD_LIMITS.audio },
  LESSON_IMAGE: { kind: 'image', limit: UPLOAD_LIMITS.image },
  LESSON_FILE: { kind: 'document', limit: UPLOAD_LIMITS.document },
  COURSE_IMAGE: { kind: 'image', limit: UPLOAD_LIMITS.image },
  QUESTION_MEDIA: { kind: 'image', limit: UPLOAD_LIMITS.image },
  SIGNATURE: { kind: 'image', limit: UPLOAD_LIMITS.image },
  SITE_IMAGE: { kind: 'image', limit: UPLOAD_LIMITS.image },
};

export interface UploadedFileView {
  id: string;
  url: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

/** Cleans a file name for display: no folders, no control characters, a sensible length. */
export function displayName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? 'file';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'file').slice(0, 120);
}

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
    private readonly access: AccessPolicy,
    private readonly audit: AuditService,
  ) {}

  /**
   * Checks who is uploading, the size, and the real type from the first bytes (not the name), then
   * stores the file privately. Pictures are re-encoded to WebP, which also strips anything hidden in them.
   */
  async upload(
    actor: Actor,
    input: { purpose: UploadPurpose; courseId?: string },
    file: { buffer: Buffer; originalname: string },
  ): Promise<UploadedFileView> {
    const rule = PURPOSE_RULES[input.purpose];

    if (
      input.purpose === 'COURSE_IMAGE' ||
      input.purpose === 'SIGNATURE' ||
      input.purpose === 'SITE_IMAGE'
    ) {
      if (!this.access.canEditCourseSettings(actor)) {
        throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
      }
    } else {
      if (!input.courseId) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
      await this.access.assertCanEditCourseContent(actor, input.courseId);
    }

    if (file.buffer.length > rule.limit.maxBytes) {
      throw new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, {
        message: `This file is ${bytesToMb(file.buffer.length)} MB. The maximum is ${bytesToMb(rule.limit.maxBytes)} MB.`,
        params: { size: bytesToMb(file.buffer.length), max: bytesToMb(rule.limit.maxBytes) },
      });
    }

    const detected = detectFile(file.buffer);
    if (!detected || detected.kind !== rule.kind) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }

    let body = file.buffer;
    let mime = detected.mime;
    let ext = detected.ext;
    if (detected.ext === 'ole') {
      const named = (file.originalname.split('.').pop() ?? '').toLowerCase();
      if (!OLE_TYPES[named]) {
        throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      }
      ext = named;
      mime = OLE_TYPES[named];
    }
    if (rule.kind === 'image') {
      body =
        input.purpose === 'COURSE_IMAGE'
          ? await this.images.toCourseImage(file.buffer)
          : input.purpose === 'SIGNATURE'
            ? await this.images.toSignature(file.buffer)
            : input.purpose === 'SITE_IMAGE'
              ? await this.images.toAvatar(file.buffer)
              : await this.images.toLessonImage(file.buffer);
      mime = 'image/webp';
      ext = 'webp';
    }

    const id = createId();
    const key =
      input.purpose === 'COURSE_IMAGE'
        ? `courses/${id}.${ext}`
        : input.purpose === 'SIGNATURE'
          ? `signatures/${id}.${ext}`
          : input.purpose === 'SITE_IMAGE'
            ? `site/${id}.${ext}`
            : input.purpose === 'QUESTION_MEDIA'
              ? `quizzes/${input.courseId}/${id}.${ext}`
              : `lessons/${input.courseId}/${id}.${ext}`;
    await this.storage.put(key, body, mime);

    const name = displayName(file.originalname);
    const asset = await this.prisma.fileAsset.create({
      data: {
        purpose: input.purpose,
        storageKey: key,
        mime,
        sizeBytes: body.length,
        originalName: rule.kind === 'image' ? name.replace(/\.[^.]+$/, '') + '.webp' : name,
        uploadedById: actor.id,
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'FILE_UPLOADED',
      entityType: 'FileAsset',
      entityId: asset.id,
      details: { purpose: input.purpose, sizeBytes: asset.sizeBytes },
    });
    return {
      id: asset.id,
      url: `/api/v1/files/${asset.id}`,
      name: asset.originalName,
      mime: asset.mime,
      sizeBytes: asset.sizeBytes,
    };
  }
}
