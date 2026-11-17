import { Module } from '@nestjs/common';
import { QueueModule } from '../../jobs/queue.module';
import { ContentModule } from '../content/content.module';
import { AdminCatalogueListsController, AdminCoursesController } from './admin-catalog.controller';
import { AdminCoursesService } from './admin-courses.service';
import { CatalogueListsService } from './catalogue-lists.service';
import { PublicCatalogController } from './public-catalog.controller';
import { PublicExtrasService } from './public-extras.service';
import { PublicCatalogService } from './public-catalog.service';

/** Courses, languages, levels: the public catalogue and admin management (FR-CAT, FR-ADMIN-003…005). */
@Module({
  imports: [QueueModule, ContentModule],
  controllers: [PublicCatalogController, AdminCoursesController, AdminCatalogueListsController],
  providers: [
    PublicCatalogService,
    PublicExtrasService,
    AdminCoursesService,
    CatalogueListsService,
  ],
})
export class CatalogModule {}
