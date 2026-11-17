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
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  answerSaveSchema,
  attemptGrantSchema,
  markAnswerSchema,
  markingQueueQuerySchema,
  type QuestionInput,
  questionInputSchema,
  quizCreateSchema,
  quizSettingsSchema,
  reorderSchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../common/errors/app.exception';
import { zodFieldErrors } from '../../common/errors/to-error-response';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { MarkingService } from './marking.service';
import { QuizAttemptsService } from './quiz-attempts.service';
import { QuizBuilderService } from './quiz-builder.service';

class QuizCreateDto extends createZodDto(quizCreateSchema) {}
class QuizSettingsDto extends createZodDto(quizSettingsSchema) {}

/** The four question types are one union, which a DTO class can't describe, so it is checked here. */
function parseQuestion(body: unknown): QuestionInput {
  const parsed = questionInputSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
      fields: zodFieldErrors(parsed.error),
    });
  }
  return parsed.data;
}
class ReorderDto extends createZodDto(reorderSchema) {}
class AnswerDto extends createZodDto(answerSaveSchema) {}
class MarkDto extends createZodDto(markAnswerSchema) {}
class GrantDto extends createZodDto(attemptGrantSchema) {}
class QueueQuery extends createZodDto(markingQueueQuerySchema) {}

/** Building quizzes: teachers of the course, and admins (FR-TEACH-005). */
@ApiTags('Teach · Quizzes')
@Roles('TEACHER', 'ADMIN')
@Controller('teach')
export class QuizBuilderController {
  constructor(private readonly builder: QuizBuilderService) {}

  @Post('lessons/:lessonId/quiz')
  create(
    @CurrentUser() user: SessionUser,
    @Param('lessonId') lessonId: string,
    @Body() dto: QuizCreateDto,
  ) {
    return this.builder.createForLesson(user, lessonId, dto.title, dto.isFinal);
  }

  @Get('quizzes/:id')
  get(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.builder.get(user, id);
  }

  @Patch('quizzes/:id')
  update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: QuizSettingsDto) {
    return this.builder.updateSettings(user, id, dto);
  }

  @Delete('quizzes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.builder.remove(user, id);
  }

  @Post('quizzes/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.builder.publish(user, id);
  }

  @Post('quizzes/:id/hide')
  @HttpCode(HttpStatus.OK)
  hide(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.builder.hide(user, id);
  }

  @Get('quizzes/:id/preview')
  preview(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.builder.preview(user, id);
  }

  @Post('quizzes/:id/questions')
  addQuestion(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() body: unknown) {
    return this.builder.addQuestion(user, id, parseQuestion(body));
  }

  @Put('quizzes/:id/questions/order')
  reorder(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: ReorderDto) {
    return this.builder.reorderQuestions(user, id, dto.ids);
  }

  @Put('quizzes/:id/questions/:questionId')
  updateQuestion(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() body: unknown,
  ) {
    return this.builder.updateQuestion(user, id, questionId, parseQuestion(body));
  }

  @Delete('quizzes/:id/questions/:questionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeQuestion(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    await this.builder.removeQuestion(user, id, questionId);
  }
}

/** The marking queue and extra attempts (FR-QUIZ-009, FR-QUIZ-012). */
@ApiTags('Teach · Marking')
@Roles('TEACHER', 'ADMIN')
@Controller('teach')
export class MarkingController {
  constructor(private readonly marking: MarkingService) {}

  @Get('marking')
  queue(@CurrentUser() user: SessionUser, @Query() query: QueueQuery) {
    return this.marking.queue(user, query);
  }

  @Get('marking/count')
  count(@CurrentUser() user: SessionUser) {
    return this.marking.count(user);
  }

  @Post('answers/:id/mark')
  @HttpCode(HttpStatus.OK)
  mark(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: MarkDto) {
    return this.marking.mark(user, id, dto);
  }

  @Post('quizzes/:id/grants')
  grant(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: GrantDto) {
    return this.marking.grant(user, id, dto.studentId);
  }

  @Get('courses/:id/students/:studentId/attempts')
  studentAttempts(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('studentId') studentId: string,
  ) {
    return this.marking.studentAttempts(user, id, studentId);
  }
}

/** Taking quizzes. Students only; every call re-checks the enrolment (AT-07). */
@ApiTags('Learning · Quizzes')
@Roles('STUDENT')
@Controller('learn')
export class StudentQuizController {
  constructor(private readonly attempts: QuizAttemptsService) {}

  @Get('quizzes/:id')
  intro(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.attempts.intro(user, id);
  }

  @Get('quizzes/:id/attempts')
  history(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.attempts.history(user, id);
  }

  @Post('quizzes/:id/attempts')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.attempts.start(user, id);
  }

  @Get('attempts/:id')
  attempt(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.attempts.get(user, id);
  }

  @Put('attempts/:id/answers/:questionId')
  save(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: AnswerDto,
  ) {
    return this.attempts.saveAnswer(user, id, questionId, dto.response);
  }

  @Post('attempts/:id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.attempts.submit(user, id);
  }

  @Get('attempts/:id/result')
  result(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.attempts.result(user, id);
  }
}
