import { Module } from '@nestjs/common';
import { AdminMessagesController, AdminSiteController } from './admin-site.controller';
import { InboxService } from './inbox.service';
import { PublicSiteController } from './public-site.controller';
import { PublicSiteService } from './public-site.service';
import { SiteContentService } from './site-content.service';

/** Public website content and its editor, the contact inbox, and the certificate check (FR-WEB, FR-ADMIN-007). */
@Module({
  controllers: [PublicSiteController, AdminSiteController, AdminMessagesController],
  providers: [PublicSiteService, SiteContentService, InboxService],
})
export class SiteModule {}
