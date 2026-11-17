import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AppException } from '../../common/errors/app.exception';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { ChatService } from './chat.service';

const openSchema = z.object({ with: z.string().min(1).max(60) });
const sendSchema = z.object({
  body: z.string().max(4000).optional(),
  voice: z.enum(['true', 'false']).optional(),
  durationSec: z.coerce.number().int().min(0).max(3600).optional(),
});

/**
 * Chat between students and the Natik team, students and their teachers, and teachers and the
 * Natik team. Every call re-checks that the person is in that conversation.
 */
@ApiTags('Chat')
@Roles('STUDENT', 'TEACHER', 'ADMIN')
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('unread-count')
  async unread(@CurrentUser() user: SessionUser) {
    return { count: await this.chat.unreadCount(user) };
  }

  @Get('conversations')
  list(@CurrentUser() user: SessionUser) {
    return this.chat.list(user);
  }

  @Get('contacts')
  contacts(@CurrentUser() user: SessionUser, @Query('q') q?: string) {
    return this.chat.contacts(user, (q ?? '').slice(0, 80));
  }

  @Post('conversations')
  @HttpCode(HttpStatus.OK)
  open(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const parsed = openSchema.safeParse(body);
    if (!parsed.success) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return this.chat.open(user, parsed.data.with);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Query('after') after?: string,
  ) {
    return this.chat.messages(user, id, after);
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  async read(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.chat.markRead(user, id);
    return { ok: true };
  }

  @Post('conversations/:id/messages')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  send(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const parsed = sendSchema.safeParse(body ?? {});
    if (!parsed.success) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    return this.chat.send(
      user,
      id,
      {
        body: parsed.data.body,
        voice: parsed.data.voice === 'true',
        durationSec: parsed.data.durationSec,
      },
      file,
    );
  }

  /** "Clear history" and "Delete chat": hides the current messages for you only. */
  @Post('conversations/:id/clear')
  @HttpCode(HttpStatus.OK)
  async clear(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.chat.clear(user, id);
    return { ok: true };
  }

  /** Delete one message (yours) for everyone. */
  @Delete('messages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMessage(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.chat.deleteMessage(user, id);
  }
}
