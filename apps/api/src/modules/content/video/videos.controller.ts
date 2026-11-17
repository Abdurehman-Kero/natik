import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { externalVideoSchema, videoCreateSchema } from '@natik/shared';
import type { Response } from 'express';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../../common/errors/app.exception';
import {
  type AuthedRequest,
  CurrentUser,
  Public,
  Roles,
  type SessionUser,
} from '../../auth/decorators';
import { pipeStored } from '../stream';
import { LOCAL_VIDEO_MAX_BYTES, VideosService } from './videos.service';

class CreateVideoDto extends createZodDto(videoCreateSchema) {}
class ExternalVideoDto extends createZodDto(externalVideoSchema) {}

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Roles('TEACHER', 'ADMIN')
  @Post()
  create(@CurrentUser() user: SessionUser, @Body() dto: CreateVideoDto) {
    return this.videos.create(user, dto);
  }

  /** A YouTube or Vimeo video: nothing is uploaded. */
  @Roles('TEACHER', 'ADMIN')
  @Post('external')
  createExternal(@CurrentUser() user: SessionUser, @Body() dto: ExternalVideoDto) {
    return this.videos.createExternal(user, dto);
  }

  @Roles('TEACHER', 'ADMIN')
  @Post(':id/captions')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 600 * 1024, files: 1 } }))
  captions(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return this.videos.setCaptions(user, id, file);
  }

  /** The still picture shown before the video plays (a frame of the video, or a chosen picture). */
  @Roles('TEACHER', 'ADMIN')
  @Post(':id/poster')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024, files: 1 } }))
  poster(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return this.videos.setPoster(user, id, file);
  }

  @Roles('TEACHER', 'ADMIN')
  @Delete(':id/captions')
  removeCaptions(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.videos.removeCaptions(user, id);
  }

  /** The captions file, after the same access check as the video. */
  @Public()
  @Get(':id/captions')
  async openCaptions(@Req() req: AuthedRequest, @Param('id') id: string, @Res() res: Response) {
    const body = await this.videos.openCaptions(req.user, id);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(body);
  }

  @Roles('TEACHER', 'ADMIN')
  @Get(':id')
  status(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.videos.status(user, id);
  }

  /** Development provider: one-request upload. In production videos go straight to Bunny. */
  @Roles('TEACHER', 'ADMIN')
  @Post(':id/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: LOCAL_VIDEO_MAX_BYTES + 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return this.videos.receiveLocalUpload(user, id, file.buffer);
  }

  /** Signed player link. Public route: free-preview lessons play for visitors; everything else is checked. */
  @Public()
  @Get(':id/embed')
  embed(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.videos.playback(req.user, id);
  }

  @Public()
  @Get(':id/stream')
  async stream(@Req() req: AuthedRequest, @Param('id') id: string, @Res() res: Response) {
    const stored = await this.videos.openLocalStream(req.user, id, req.headers.range);
    await pipeStored(res, stored, {
      contentType: stored.contentType,
      // Videos are for watching, never for saving (D7).
      disposition: 'inline',
      cache: 'private, no-store',
    });
  }
}
