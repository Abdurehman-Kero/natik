import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  adminEnrolSchema,
  cancelEnrolmentSchema,
  extendEnrolmentSchema,
  listAdminEnrolmentsQuerySchema,
  studentSearchQuerySchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { EnrolmentsService } from './enrolments.service';

class AdminEnrolDto extends createZodDto(adminEnrolSchema) {}
class ExtendDto extends createZodDto(extendEnrolmentSchema) {}
class CancelDto extends createZodDto(cancelEnrolmentSchema) {}
class ListQuery extends createZodDto(listAdminEnrolmentsQuerySchema) {}
class StudentSearchQuery extends createZodDto(studentSearchQuerySchema) {}

/** Students enrol themselves (FR-ENR-002). Every record is looked up by the signed-in student. */
@ApiTags('Enrolments')
@Controller()
export class EnrolmentsController {
  constructor(private readonly enrolments: EnrolmentsService) {}

  @Roles('STUDENT')
  @Post('courses/:id/enrol')
  @HttpCode(HttpStatus.OK)
  enrol(@CurrentUser() user: SessionUser, @Param('id') courseId: string) {
    return this.enrolments.enrol(user, courseId);
  }

  @Roles('STUDENT')
  @Post('enrolments/:id/renew')
  @HttpCode(HttpStatus.OK)
  renew(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.enrolments.renew(user, id);
  }

  /** Decides which button the course page shows (FR-CAT-004). Any signed-in role may ask. */
  @Get('me/course-state/:slug')
  state(@CurrentUser() user: SessionUser, @Param('slug') slug: string) {
    return this.enrolments.stateForCourse(user, slug);
  }
}

/** Admin: enrolments by course or student (FR-ADMIN-006, FR-ADMIN-008). */
@ApiTags('Admin · Enrolments')
@Roles('ADMIN')
@Controller('admin')
export class AdminEnrolmentsController {
  constructor(private readonly enrolments: EnrolmentsService) {}

  @Get('enrolments')
  list(@Query() query: ListQuery) {
    return this.enrolments.adminList(query);
  }

  @Get('students')
  students(@Query() query: StudentSearchQuery) {
    return this.enrolments.searchStudents(query.q);
  }

  @Post('enrolments')
  enrol(@CurrentUser() actor: SessionUser, @Body() dto: AdminEnrolDto) {
    return this.enrolments.adminEnrol(actor, dto.studentId, dto.courseId);
  }

  @Post('enrolments/:id/extend')
  @HttpCode(HttpStatus.OK)
  extend(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ExtendDto) {
    return this.enrolments.extend(actor, id, dto.days);
  }

  @Post('enrolments/:id/renew')
  @HttpCode(HttpStatus.OK)
  renew(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    return this.enrolments.renew(actor, id);
  }

  @Post('enrolments/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.enrolments.cancel(actor, id, dto.reason);
  }
}
