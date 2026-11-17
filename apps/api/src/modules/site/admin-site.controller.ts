import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  faqInputSchema,
  featuredCoursesSchema,
  listMessagesQuerySchema,
  policyInputSchema,
  reorderSchema,
  SITE_CONTENT_KEYS,
  type SiteContentKey,
  testimonialInputSchema,
} from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../common/errors/app.exception';
import { CurrentUser, Roles, type SessionUser } from '../auth/decorators';
import { InboxService } from './inbox.service';
import { SiteContentService } from './site-content.service';

class FaqDto extends createZodDto(faqInputSchema) {}
class TestimonialDto extends createZodDto(testimonialInputSchema) {}
class PolicyDto extends createZodDto(policyInputSchema) {}
class FeaturedDto extends createZodDto(featuredCoursesSchema) {}
class ReorderDto extends createZodDto(reorderSchema) {}
class MessagesQuery extends createZodDto(listMessagesQuerySchema) {}

function siteKey(key: string): SiteContentKey {
  if (!(SITE_CONTENT_KEYS as readonly string[]).includes(key)) {
    throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
  }
  return key as SiteContentKey;
}

/** The website editor (FR-WEB-005): admins only. */
@ApiTags('Admin · Website')
@Roles('ADMIN')
@Controller('admin')
export class AdminSiteController {
  constructor(private readonly content: SiteContentService) {}

  @Get('site/:key')
  getSite(@Param('key') key: string) {
    return this.content.getSite(siteKey(key));
  }

  @Put('site/:key')
  putSite(@CurrentUser() user: SessionUser, @Param('key') key: string, @Body() body: unknown) {
    return this.content.putSite(user, siteKey(key), body);
  }

  @Delete('site/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetSite(@CurrentUser() user: SessionUser, @Param('key') key: string) {
    await this.content.resetSite(user, siteKey(key));
  }

  @Get('faq')
  faq() {
    return this.content.listFaq();
  }

  @Post('faq')
  createFaq(@CurrentUser() user: SessionUser, @Body() dto: FaqDto) {
    return this.content.createFaq(user, dto);
  }

  @Post('faq/reorder')
  @HttpCode(HttpStatus.OK)
  reorderFaq(@Body() dto: ReorderDto) {
    return this.content.reorder('faqItem', dto.ids);
  }

  @Put('faq/:id')
  updateFaq(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() dto: FaqDto) {
    return this.content.updateFaq(user, id, dto);
  }

  @Delete('faq/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFaq(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.content.deleteFaq(user, id);
  }

  @Get('testimonials')
  testimonials() {
    return this.content.listTestimonials();
  }

  @Post('testimonials')
  createTestimonial(@CurrentUser() user: SessionUser, @Body() dto: TestimonialDto) {
    return this.content.createTestimonial(user, dto);
  }

  @Post('testimonials/reorder')
  @HttpCode(HttpStatus.OK)
  reorderTestimonials(@Body() dto: ReorderDto) {
    return this.content.reorder('testimonial', dto.ids);
  }

  @Put('testimonials/:id')
  updateTestimonial(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() dto: TestimonialDto,
  ) {
    return this.content.updateTestimonial(user, id, dto);
  }

  @Delete('testimonials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTestimonial(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.content.deleteTestimonial(user, id);
  }

  @Get('policies/:slug')
  policy(@Param('slug') slug: string) {
    return this.content.getPolicy(slug);
  }

  @Put('policies/:slug')
  putPolicy(@CurrentUser() user: SessionUser, @Param('slug') slug: string, @Body() dto: PolicyDto) {
    return this.content.putPolicy(user, slug, dto);
  }

  @Get('featured-courses')
  featured() {
    return this.content.featured();
  }

  @Put('featured-courses')
  setFeatured(@CurrentUser() user: SessionUser, @Body() dto: FeaturedDto) {
    return this.content.setFeatured(user, dto.ids);
  }
}

/** The contact inbox (FR-ADMIN-007). */
@ApiTags('Admin · Messages')
@Roles('ADMIN')
@Controller('admin/messages')
export class AdminMessagesController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  list(@Query() query: MessagesQuery) {
    return this.inbox.list(query);
  }

  @Get('count')
  async count() {
    return { count: await this.inbox.newCount() };
  }

  /** The messages shown on the Messages page have been seen. */
  @Post('seen')
  @HttpCode(HttpStatus.OK)
  seen(@Body() body: { ids?: unknown; all?: unknown }) {
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((x): x is string => typeof x === 'string')
      : [];
    return this.inbox.markSeen(ids, body?.all === true);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  close(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.inbox.setStatus(user, id, 'CLOSED');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  reopen(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.inbox.setStatus(user, id, 'NEW');
  }
}
