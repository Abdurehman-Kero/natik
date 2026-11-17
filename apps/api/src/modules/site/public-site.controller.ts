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
import { contactSchema } from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { type AuthedRequest, Public } from '../auth/decorators';
import { PublicSiteService } from './public-site.service';
import { SiteContentService } from './site-content.service';

class ContactDto extends createZodDto(contactSchema) {}

/** Public website data: contact form, news and certificate check. No sign-in needed. */
@ApiTags('Public')
@Public()
@Controller('public')
export class PublicSiteController {
  constructor(
    private readonly site: PublicSiteService,
    private readonly content: SiteContentService,
  ) {}

  @Post('contact')
  @HttpCode(HttpStatus.OK)
  async contact(@Body() dto: ContactDto, @Req() req: AuthedRequest) {
    await this.site.contact(dto, req.ip ?? null);
    return { ok: true };
  }

  /** Home, About and contact text edited by admins; empty entries mean the built-in wording. */
  @Get('site')
  siteContent() {
    return this.content.publicSite();
  }

  @Get('faq')
  faq() {
    return this.content.publicFaq();
  }

  @Get('testimonials')
  testimonials() {
    return this.content.publicTestimonials();
  }

  @Get('policies/:slug')
  policy(@Param('slug') slug: string) {
    return this.content.publicPolicy(slug);
  }

  @Get('teachers')
  teachers() {
    return this.site.teachers();
  }

  @Get('announcements')
  announcements(@Query('limit') limit?: string) {
    const n = Math.min(Math.max(Number.parseInt(limit ?? '', 10) || 10, 1), 20);
    return this.site.announcements(n);
  }

  @Get('certificates/:number')
  certificate(@Param('number') number: string, @Req() req: AuthedRequest) {
    return this.site.verifyCertificate(number, req.ip ?? null);
  }
}
