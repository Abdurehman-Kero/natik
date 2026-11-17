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
import {
  blockCreateSchema,
  blockUpdateSchema,
  lessonInputSchema,
  lessonsReorderSchema,
  reorderSchema,
  slideInputSchema,
  unitInputSchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { ContentService } from './content.service';
import { LessonViewService } from './lesson-view.service';

class UnitDto extends createZodDto(unitInputSchema) {}
class LessonCreateDto extends createZodDto(lessonInputSchema.pick({ title: true })) {}
class LessonUpdateDto extends createZodDto(lessonInputSchema.partial()) {}
class LessonsReorderDto extends createZodDto(lessonsReorderSchema) {}
class BlockCreateDto extends createZodDto(blockCreateSchema) {}
class BlockUpdateDto extends createZodDto(blockUpdateSchema) {}
class SlideDto extends createZodDto(slideInputSchema) {}
class SlideUpdateDto extends createZodDto(slideInputSchema.partial()) {}
class ReorderDto extends createZodDto(reorderSchema) {}

/**
 * The teacher's workspace: courses they are assigned to (admins can open every course).
 * Every handler goes through AccessPolicy, so a teacher can never reach another teacher's course (AT-12).
 */
@ApiTags('Teach')
@Roles('TEACHER', 'ADMIN')
@Controller('teach')
export class TeachController {
  constructor(
    private readonly content: ContentService,
    private readonly views: LessonViewService,
  ) {}

  @Get('courses')
  courses(@CurrentUser() user: SessionUser) {
    return this.content.myCourses(user);
  }

  @Get('courses/:id/outline')
  outline(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.content.outline(user, id);
  }

  // Units

  @Post('courses/:id/units')
  createUnit(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: UnitDto) {
    return this.content.createUnit(user, id, dto.title);
  }

  @Post('courses/:id/units/reorder')
  @HttpCode(HttpStatus.OK)
  reorderUnits(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: ReorderDto) {
    return this.content.reorderUnits(user, id, dto.ids);
  }

  @Patch('units/:id')
  renameUnit(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: UnitDto) {
    return this.content.renameUnit(user, id, dto.title);
  }

  @Post('units/:id/publish')
  @HttpCode(HttpStatus.OK)
  publishUnit(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.content.setUnitStatus(user, id, 'PUBLISHED');
  }

  @Post('units/:id/hide')
  @HttpCode(HttpStatus.OK)
  hideUnit(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.content.setUnitStatus(user, id, 'HIDDEN');
  }

  @Delete('units/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUnit(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.content.deleteUnit(user, id);
  }

  // Lessons

  @Post('units/:id/lessons')
  createLesson(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: LessonCreateDto,
  ) {
    return this.content.createLesson(user, id, dto.title);
  }

  @Post('courses/:id/lessons/reorder')
  @HttpCode(HttpStatus.OK)
  reorderLessons(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: LessonsReorderDto,
  ) {
    return this.content.reorderLessons(user, id, dto.units);
  }

  @Get('lessons/:id')
  lesson(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.content.getLesson(user, id);
  }

  @Patch('lessons/:id')
  updateLesson(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: LessonUpdateDto,
  ) {
    return this.content.updateLesson(user, id, dto);
  }

  @Post('lessons/:id/publish')
  @HttpCode(HttpStatus.OK)
  publishLesson(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.content.setLessonStatus(user, id, 'PUBLISHED');
  }

  @Post('lessons/:id/hide')
  @HttpCode(HttpStatus.OK)
  hideLesson(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.content.setLessonStatus(user, id, 'HIDDEN');
  }

  @Delete('lessons/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLesson(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.content.deleteLesson(user, id);
  }

  /** The same render model students get, so a preview is exactly what they will see (M3 goal). */
  @Get('lessons/:id/view')
  async view(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.content.assertCanPreview(user, id);
    return this.views.build(id);
  }

  // Blocks

  @Post('lessons/:id/blocks')
  createBlock(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: BlockCreateDto,
  ) {
    return this.content.createBlock(user, id, dto);
  }

  @Post('lessons/:id/blocks/reorder')
  @HttpCode(HttpStatus.OK)
  reorderBlocks(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: ReorderDto,
  ) {
    return this.content.reorderBlocks(user, id, dto.ids);
  }

  @Patch('blocks/:id')
  updateBlock(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: BlockUpdateDto,
  ) {
    return this.content.updateBlock(user, id, dto);
  }

  @Delete('blocks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlock(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.content.deleteBlock(user, id);
  }

  // Slides

  @Post('blocks/:id/slides')
  createSlide(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: SlideDto) {
    return this.content.createSlide(user, id, dto);
  }

  @Post('blocks/:id/slides/reorder')
  @HttpCode(HttpStatus.OK)
  reorderSlides(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: ReorderDto,
  ) {
    return this.content.reorderSlides(user, id, dto.ids);
  }

  @Patch('slides/:id')
  updateSlide(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: SlideUpdateDto,
  ) {
    return this.content.updateSlide(user, id, dto);
  }

  @Delete('slides/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSlide(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.content.deleteSlide(user, id);
  }
}
