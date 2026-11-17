import { HttpStatus, Injectable } from '@nestjs/common';
import { AccessPolicy, type Actor } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';

export interface MediaGrant {
  /** Whether the lesson that opened this file allows downloading it (videos never do, D7). */
  downloadsAllowed: boolean;
}

/**
 * Decides who may open a lesson file or video. A file is reachable only through the lessons that
 * use it, and each of those goes through `canOpenLesson`. The free-preview flag therefore opens a
 * lesson's media to everyone (FR-LEARN-010, FR-CAT-005). Files not used by any lesson yet (just
 * uploaded) are visible to their uploader and to admins.
 */
@Injectable()
export class MediaAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
  ) {}

  /** Lessons whose blocks use this file, either as the block's file or as a picture inside text. */
  async lessonsUsingFile(fileId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ lessonId: string }[]>`
      SELECT DISTINCT "lessonId"
      FROM "LessonBlock"
      WHERE "fileId" = ${fileId}
         OR ("type" = 'TEXT' AND "textJson"::text LIKE ${`%/api/v1/files/${fileId}%`})
         OR "id" IN (SELECT "blockId" FROM "LessonSlide" WHERE "imageFileId" = ${fileId})
    `;
    return rows.map((r) => r.lessonId);
  }

  async lessonsUsingVideo(videoId: string): Promise<string[]> {
    const blocks = await this.prisma.lessonBlock.findMany({
      where: { videoId },
      select: { lessonId: true },
    });
    return [...new Set(blocks.map((b) => b.lessonId))];
  }

  private async firstOpenable(
    actor: Actor | undefined,
    lessonIds: string[],
  ): Promise<MediaGrant | null> {
    let opened = false;
    let downloads = false;
    for (const lessonId of lessonIds) {
      const result = await this.access.canOpenLesson(actor, lessonId);
      if (result.allowed) {
        opened = true;
        downloads = downloads || result.lesson.downloadsAllowed;
      }
    }
    return opened ? { downloadsAllowed: downloads } : null;
  }

  /** Throws unless the person may open this lesson file. */
  async assertCanOpenFile(
    actor: Actor | undefined,
    file: { id: string; uploadedById: string | null },
  ): Promise<MediaGrant> {
    const grant = await this.firstOpenable(actor, await this.lessonsUsingFile(file.id));
    if (grant) return grant;
    if (actor && (actor.role === 'ADMIN' || file.uploadedById === actor.id)) {
      return { downloadsAllowed: true };
    }
    throw this.denied(actor);
  }

  async assertCanOpenVideo(
    actor: Actor | undefined,
    video: { id: string; createdById: string | null },
  ): Promise<void> {
    const grant = await this.firstOpenable(actor, await this.lessonsUsingVideo(video.id));
    if (grant) return;
    if (actor && (actor.role === 'ADMIN' || video.createdById === actor.id)) return;
    throw this.denied(actor);
  }

  private denied(actor: Actor | undefined): AppException {
    return actor
      ? new AppException('COURSE_ACCESS_DENIED', HttpStatus.FORBIDDEN)
      : new AppException('UNAUTHENTICATED', HttpStatus.UNAUTHORIZED);
  }
}
