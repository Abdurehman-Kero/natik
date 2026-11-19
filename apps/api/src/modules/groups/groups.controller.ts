import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  groupEditSchema,
  groupMessageSchema,
  groupMessagesQuerySchema,
  groupReactSchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, type SessionUser } from '../auth/decorators';
import { GroupsService } from './groups.service';

class SendDto extends createZodDto(groupMessageSchema) {}
class EditDto extends createZodDto(groupEditSchema) {}
class ReactDto extends createZodDto(groupReactSchema) {}
class MessagesQuery extends createZodDto(groupMessagesQuerySchema) {}

/** Course group chats. Every signed-in role may ask; who is in which group is decided by the service. */
@ApiTags('Course groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.groups.list(user);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: SessionUser) {
    return this.groups.unreadCount(user);
  }

  @Get(':courseId')
  info(@CurrentUser() user: SessionUser, @Param('courseId') courseId: string) {
    return this.groups.info(user, courseId);
  }

  @Get(':courseId/messages')
  messages(
    @CurrentUser() user: SessionUser,
    @Param('courseId') courseId: string,
    @Query() query: MessagesQuery,
  ) {
    return this.groups.messages(user, courseId, query);
  }

  @Post(':courseId/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: SessionUser, @Param('courseId') courseId: string) {
    return this.groups.markRead(user, courseId);
  }

  @Post(':courseId/messages')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 61 * 1024 * 1024, files: 1 } }))
  send(
    @CurrentUser() user: SessionUser,
    @Param('courseId') courseId: string,
    @Body() dto: SendDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.groups.send(user, courseId, dto, file);
  }

  @Patch('messages/:id')
  edit(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: EditDto) {
    return this.groups.edit(user, id, dto.body);
  }

  @Delete('messages/:id')
  remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.groups.remove(user, id);
  }

  @Post('messages/:id/pin')
  @HttpCode(HttpStatus.OK)
  pin(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.groups.pin(user, id, true);
  }

  @Delete('messages/:id/pin')
  unpin(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.groups.pin(user, id, false);
  }

  @Post('messages/:id/react')
  @HttpCode(HttpStatus.OK)
  react(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: ReactDto) {
    return this.groups.react(user, id, dto.emoji);
  }
}
