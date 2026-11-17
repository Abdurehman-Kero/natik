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
  courseInputSchema,
  languageInputSchema,
  levelInputSchema,
  listAdminCoursesQuerySchema,
  reorderSchema,
  teachersAssignSchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { AdminCoursesService } from './admin-courses.service';
import { CatalogueListsService } from './catalogue-lists.service';

class CourseDto extends createZodDto(courseInputSchema) {}
class ListCoursesQuery extends createZodDto(listAdminCoursesQuerySchema) {}
class TeachersDto extends createZodDto(teachersAssignSchema) {}
class LanguageDto extends createZodDto(languageInputSchema) {}
class LevelDto extends createZodDto(levelInputSchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}

/** Course management: admins only (FR-ADMIN-003/004/005). Teachers never reach these routes. */
@ApiTags('Admin · Courses')
@Roles('ADMIN')
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly courses: AdminCoursesService) {}

  @Get()
  list(@Query() query: ListCoursesQuery) {
    return this.courses.list(query);
  }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: CourseDto) {
    return this.courses.create(actor, dto);
  }

  @Get('teachers')
  teachers() {
    return this.courses.teacherChoices();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.courses.get(id);
  }

  @Patch(':id')
  update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: CourseDto) {
    return this.courses.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    await this.courses.remove(actor, id);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    return this.courses.publish(actor, id);
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  hide(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    return this.courses.hide(actor, id);
  }

  @Put(':id/teachers')
  setTeachers(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body() dto: TeachersDto,
  ) {
    return this.courses.setTeachers(actor, id, dto.teacherIds);
  }
}

/** Languages and levels shown in filters and on course forms (FR-CAT-001). */
@ApiTags('Admin · Languages and levels')
@Roles('ADMIN')
@Controller('admin')
export class AdminCatalogueListsController {
  constructor(private readonly lists: CatalogueListsService) {}

  @Get('languages')
  languages() {
    return this.lists.languages();
  }

  @Post('languages')
  createLanguage(@CurrentUser() actor: SessionUser, @Body() dto: LanguageDto) {
    return this.lists.createLanguage(actor, dto);
  }

  @Post('languages/reorder')
  @HttpCode(HttpStatus.OK)
  reorderLanguages(@Body() dto: ReorderDto) {
    return this.lists.reorderLanguages(dto.ids);
  }

  @Patch('languages/:id')
  updateLanguage(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Body() dto: LanguageDto,
  ) {
    return this.lists.updateLanguage(actor, id, dto);
  }

  @Delete('languages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLanguage(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    await this.lists.deleteLanguage(actor, id);
  }

  @Get('levels')
  levels() {
    return this.lists.levels();
  }

  @Post('levels')
  createLevel(@CurrentUser() actor: SessionUser, @Body() dto: LevelDto) {
    return this.lists.createLevel(actor, dto);
  }

  @Post('levels/reorder')
  @HttpCode(HttpStatus.OK)
  reorderLevels(@Body() dto: ReorderDto) {
    return this.lists.reorderLevels(dto.ids);
  }

  @Patch('levels/:id')
  updateLevel(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: LevelDto) {
    return this.lists.updateLevel(actor, id, dto);
  }

  @Delete('levels/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteLevel(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    await this.lists.deleteLevel(actor, id);
  }
}
