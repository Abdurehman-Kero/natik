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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { announcementInputSchema } from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { AnnouncementsService } from './announcements.service';

class AnnouncementDto extends createZodDto(announcementInputSchema) {}

/** Admins manage every announcement. */
@ApiTags('Announcements')
@Roles('ADMIN')
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.announcements.list(user);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() dto: AnnouncementDto) {
    return this.announcements.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: AnnouncementDto) {
    return this.announcements.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.announcements.remove(user, id);
  }
}

/** Teachers post to their own courses only; the service refuses everything else (SRS §3). */
@ApiTags('Announcements')
@Roles('TEACHER', 'ADMIN')
@Controller('teach/announcements')
export class TeachAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.announcements.list(user);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() dto: AnnouncementDto) {
    return this.announcements.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: AnnouncementDto) {
    return this.announcements.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.announcements.remove(user, id);
  }
}

/** A student's own feed with unread markers. Only what they are allowed to see is ever returned. */
@ApiTags('Announcements')
@Roles('STUDENT')
@Controller('me/announcements')
export class StudentAnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  feed(@CurrentUser() user: SessionUser) {
    return this.announcements.studentFeed(user.id);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: SessionUser) {
    return this.announcements.unreadCount(user.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: SessionUser) {
    return this.announcements.markAllRead(user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.announcements.markRead(user.id, id);
  }
}
