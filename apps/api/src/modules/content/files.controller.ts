import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { AccessPolicy } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { StorageService } from '../../common/storage/storage.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type AuthedRequest,
  CurrentUser,
  Public,
  Roles,
  type SessionUser,
} from '../auth/decorators';
import { canOpenConversation } from '../chat/chat-access';
import { MediaAccessService } from './media-access.service';
import { pipeStored } from './stream';
import { type UploadPurpose, UploadsService } from './uploads.service';

/** Anything above this is refused by the upload parser; the friendly size message comes from the checks. */
const UPLOAD_HARD_LIMIT = 60 * 1024 * 1024;

const uploadBodySchema = z.object({
  purpose: z.enum([
    'LESSON_PDF',
    'LESSON_AUDIO',
    'LESSON_IMAGE',
    'LESSON_FILE',
    'COURSE_IMAGE',
    'QUESTION_MEDIA',
    'SIGNATURE',
    'SITE_IMAGE',
  ]),
  courseId: z.string().min(1).max(60).optional(),
});

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly uploads: UploadsService,
    private readonly media: MediaAccessService,
    private readonly access: AccessPolicy,
  ) {}

  /** Teachers (their own courses) and admins upload lesson files; only admins upload course pictures. */
  @Roles('TEACHER', 'ADMIN')
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_HARD_LIMIT, files: 1 } }))
  upload(
    @CurrentUser() user: SessionUser,
    @Body() body: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const parsed = uploadBodySchema.safeParse(body);
    if (!file || !parsed.success)
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return this.uploads.upload(
      user,
      parsed.data as { purpose: UploadPurpose; courseId?: string },
      file,
    );
  }

  /**
   * Public route with its own rules, because some pictures are shown to visitors:
   * - course pictures: visitors see published courses only; staff see drafts too;
   * - profile photos: signed-in people, or visitors for a teacher who chose to be on the website;
   * - lesson files: every request runs the lesson access check (FR-LEARN-010).
   */
  @Public()
  @Get(':id')
  async open(
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!file) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const actor = req.user;

    if (file.purpose === 'COURSE_IMAGE') {
      const published = await this.prisma.course.findFirst({
        where: { imageFileId: id, status: 'PUBLISHED' },
        select: { id: true },
      });
      const isStaff = actor?.role === 'ADMIN' || actor?.role === 'TEACHER';
      if (!published && !isStaff) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      const { body, contentType } = await this.storage.read(file.storageKey);
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Cache-Control',
        published ? 'public, max-age=86400, stale-while-revalidate=604800' : 'private, max-age=60',
      );
      res.send(body);
      return;
    }

    // Pictures on the public website (a student's photo next to their quote) are public once used;
    // before that only admins can see them, in the editor.
    if (file.purpose === 'SITE_IMAGE') {
      const used =
        (await this.prisma.testimonial.findFirst({
          where: { photoFileId: id, published: true },
          select: { id: true },
        })) ??
        // A teacher's photo on the website (set by an admin).
        (await this.prisma.user.findFirst({
          where: { photoFileId: id, role: 'TEACHER', showOnWebsite: true, status: 'ACTIVE' },
          select: { id: true },
        }));
      if (!used && actor?.role !== 'ADMIN')
        throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      const { body, contentType } = await this.storage.read(file.storageKey);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', used ? 'public, max-age=86400' : 'private, max-age=60');
      res.send(body);
      return;
    }

    if (file.purpose === 'VIDEO_POSTER') {
      const { body, contentType } = await this.storage.read(file.storageKey);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.send(body);
      return;
    }

    if (file.purpose === 'AVATAR') {
      if (!actor) {
        const owner = await this.prisma.user.findFirst({
          where: { photoFileId: id, role: 'TEACHER', showOnWebsite: true, status: 'ACTIVE' },
          select: { id: true },
        });
        if (!owner) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      }
      res.setHeader('Cache-Control', 'private, max-age=240');
      const url = await this.storage.signedUrl(file.storageKey);
      if (url) {
        res.redirect(HttpStatus.FOUND, url);
      } else {
        // Files kept in the database have no bucket link: send the picture itself.
        const { body, contentType } = await this.storage.read(file.storageKey);
        res.setHeader('Content-Type', contentType);
        res.send(body);
      }
      return;
    }

    if (
      file.purpose === 'LESSON_PDF' ||
      file.purpose === 'LESSON_AUDIO' ||
      file.purpose === 'LESSON_IMAGE'
    ) {
      const grant = await this.media.assertCanOpenFile(actor, file);
      const wantsDownload = download === '1' || download === 'true';
      // "Allow downloads" is a teacher setting per lesson. Without it the file can only be viewed in the page.
      if (wantsDownload && !grant.downloadsAllowed) {
        throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
      }
      const stored = await this.storage.stream(file.storageKey, req.headers.range);
      const safeName = encodeURIComponent(file.originalName);
      await pipeStored(res, stored, {
        contentType: file.mime,
        disposition: wantsDownload
          ? `attachment; filename*=UTF-8''${safeName}`
          : `inline; filename*=UTF-8''${safeName}`,
        cache: 'private, max-age=300',
      });
      return;
    }

    // PowerPoint, Word and Excel: students who can open the session download them (they can't be
    // shown inside the page).
    if (file.purpose === 'LESSON_FILE') {
      await this.media.assertCanOpenFile(actor, file);
      const stored = await this.storage.stream(file.storageKey, req.headers.range);
      await pipeStored(res, stored, {
        contentType: file.mime,
        disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        cache: 'private, max-age=300',
      });
      return;
    }

    // Quiz pictures: staff of the course, and students whose enrolment opens it (FR-QUIZ-002).
    if (file.purpose === 'QUESTION_MEDIA') {
      const question = await this.prisma.question.findFirst({
        where: { mediaFileId: id },
        select: { quiz: { select: { courseId: true } } },
      });
      if (!question || !actor) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      const courseId = question.quiz.courseId;
      const allowed =
        (await this.access.canEditCourseContent(actor, courseId)) ||
        (actor.role === 'STUDENT' &&
          (await this.access.studentCourseAccess(actor.id, courseId)).allowed);
      if (!allowed) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      const stored = await this.storage.stream(file.storageKey, req.headers.range);
      await pipeStored(res, stored, {
        contentType: file.mime,
        disposition: 'inline',
        cache: 'private, max-age=300',
      });
      return;
    }

    // Signatures are shown to admins in settings; the certificate itself is a PDF.
    if (file.purpose === 'SIGNATURE') {
      if (actor?.role !== 'ADMIN') throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      const stored = await this.storage.stream(file.storageKey, req.headers.range);
      await pipeStored(res, stored, {
        contentType: file.mime,
        disposition: 'inline',
        cache: 'private, max-age=60',
      });
      return;
    }

    // Payment receipts: the admin who checks payments, and the student who sent it. Anyone else gets
    // "not found", the same as a file that doesn't exist (FR-PAY-006, BR-ROLE-003).
    if (file.purpose === 'RECEIPT') {
      const allowed = actor?.role === 'ADMIN' || (!!actor && file.uploadedById === actor.id);
      if (!allowed) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      const stored = await this.storage.stream(file.storageKey, req.headers.range);
      await pipeStored(res, stored, {
        contentType: file.mime,
        disposition: 'inline',
        cache: 'private, no-store',
      });
      return;
    }

    // Chat attachments: the two people in that chat, admins for chats with the Natik team, and the
    // members of a course group for files shared there.
    if (file.purpose === 'CHAT_ATTACHMENT') {
      const message = actor
        ? await this.prisma.chatMessage.findFirst({
            where: { fileId: id },
            select: { conversation: { select: { kind: true, ownerId: true, peerId: true } } },
          })
        : null;
      // A file in a course group: everyone in that group may open it.
      const inGroup =
        actor && !message
          ? await this.prisma.groupMessage.findFirst({
              where: { fileId: id },
              select: { courseId: true },
            })
          : null;
      const allowed = inGroup
        ? (await this.access.courseGroupRole(actor, inGroup.courseId)) !== null
        : !!actor && !!message && canOpenConversation(actor, message.conversation);
      if (!actor || (!message && !inGroup) || !allowed) {
        throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      }
      const wantsDownload = download === '1' || download === 'true';
      const stored = await this.storage.stream(file.storageKey, req.headers.range);
      const safeName = encodeURIComponent(file.originalName);
      await pipeStored(res, stored, {
        contentType: file.mime,
        disposition: `${wantsDownload ? 'attachment' : 'inline'}; filename*=UTF-8''${safeName}`,
        cache: 'private, max-age=300',
      });
      return;
    }

    // Certificates are opened by the milestone that defines who may see them (M6).
    throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
  }
}
