import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { placementAnswersSchema, publicCoursesQuerySchema } from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthedRequest, Public } from '../auth/decorators';
import { PublicCatalogService } from './public-catalog.service';
import { PublicExtrasService } from './public-extras.service';

class CoursesQuery extends createZodDto(publicCoursesQuerySchema) {}
class PlacementAnswersDto extends createZodDto(placementAnswersSchema) {}

/** Public catalogue: published courses only (FR-CAT, FR-WEB-006). */
@ApiTags('Public')
@Public()
@Controller('public')
export class PublicCatalogController {
  constructor(
    private readonly catalog: PublicCatalogService,
    private readonly extras: PublicExtrasService,
  ) {}

  /** Languages (with how many courses each has) and levels, for forms and filters. Editable by admins. */
  @Get('filters')
  filters() {
    return this.catalog.filters();
  }

  /** Languages visitors can choose when registering. */
  @Get('languages')
  async languages() {
    const { languages } = await this.catalog.filters();
    return { items: languages };
  }

  @Get('courses')
  list(
    @Query() query: CoursesQuery,
    @Req() req: AuthedRequest,
    @Query('featured') featured?: string,
  ) {
    // Admins see every price (their pickers need it); everyone else only the prices that are public.
    return this.catalog.list({
      ...query,
      featured: featured === 'true',
      allPrices: req.user?.role === 'ADMIN',
    });
  }

  @Get('courses/:slug')
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }

  /** Live totals for the home page. */
  @Get('stats')
  stats() {
    return this.extras.stats();
  }

  /** Teachers who chose to appear on the website. */
  @Get('teachers')
  teachers() {
    return this.extras.teachers();
  }

  /** Languages that have a "Find your level" check. */
  @Get('placement')
  placementLanguages() {
    return this.extras.placementLanguages();
  }

  @Get('placement/:language')
  placementQuestions(@Param('language') language: string) {
    return this.extras.placementQuestions(language);
  }

  /** Marks the check on the server and suggests a level and courses. */
  @Post('placement/:language/result')
  @HttpCode(HttpStatus.OK)
  placementResult(@Param('language') language: string, @Body() dto: PlacementAnswersDto) {
    return this.extras.placementResult(language, dto.answers);
  }
}
