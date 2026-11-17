import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { reportProblemSchema, resumeSchema } from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { LearningService } from './learning.service';

class ReportDto extends createZodDto(reportProblemSchema) {}
class ResumeDto extends createZodDto(resumeSchema) {}

/**
 * The student's learning area. Students only: teachers and admins use their own preview screens.
 * Every lesson action checks the enrolment again, so guessing an ID shows nothing (BR-ROLE-003).
 */
@ApiTags('Learning')
@Roles('STUDENT')
@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('me/dashboard')
  dashboard(@CurrentUser() user: SessionUser) {
    return this.learning.dashboard(user);
  }

  @Get('me/courses')
  courses(@CurrentUser() user: SessionUser) {
    return this.learning.myCourses(user);
  }

  @Get('learn/lessons/:id')
  lesson(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.learning.lesson(user, id);
  }

  @Post('learn/lessons/:id/open')
  @HttpCode(HttpStatus.OK)
  open(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.learning.open(user, id);
  }

  /** Where the student is in the lesson (step and video position), saved as they go. */
  @Put('learn/lessons/:id/resume')
  resume(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: ResumeDto) {
    return this.learning.saveResume(user, id, dto);
  }

  @Post('learn/lessons/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.learning.complete(user, id);
  }

  @Post('learn/lessons/:id/report')
  @HttpCode(HttpStatus.OK)
  report(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: ReportDto) {
    return this.learning.report(user, id, dto.message);
  }

  /** Declared last so "lessons" is never read as a course address. */
  @Get('learn/:slug')
  outline(@CurrentUser() user: SessionUser, @Param('slug') slug: string) {
    return this.learning.outline(user, slug);
  }
}
