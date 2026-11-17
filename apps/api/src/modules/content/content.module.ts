import { Module } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueModule } from '../../jobs/queue.module';
import { ContentService } from './content.service';
import { FilesController } from './files.controller';
import { LessonViewService } from './lesson-view.service';
import { MediaAccessService } from './media-access.service';
import { TeachController } from './teach.controller';
import { UploadsService } from './uploads.service';
import { BunnyVideoProvider } from './video/bunny.provider';
import { LocalVideoProvider } from './video/local.provider';
import { VIDEO_PROVIDER, type VideoProvider } from './video/video-provider';
import { VideosController } from './video/videos.controller';
import { VideosService } from './video/videos.service';

/** Units, lessons, blocks, files and videos (FR-TEACH, FR-LEARN-006…011). */
@Module({
  imports: [QueueModule],
  controllers: [TeachController, FilesController, VideosController],
  providers: [
    ContentService,
    LessonViewService,
    MediaAccessService,
    UploadsService,
    VideosService,
    {
      provide: VIDEO_PROVIDER,
      inject: [AppConfigService, StorageService, PrismaService],
      // Chosen by VIDEO_PROVIDER, so the video service can change without touching feature code (D8).
      useFactory: (
        config: AppConfigService,
        storage: StorageService,
        prisma: PrismaService,
      ): VideoProvider =>
        config.get('VIDEO_PROVIDER') === 'bunny'
          ? new BunnyVideoProvider({
              libraryId: config.get('BUNNY_LIBRARY_ID')!,
              apiKey: config.get('BUNNY_API_KEY')!,
              tokenKey: config.get('BUNNY_TOKEN_KEY')!,
              apiUrl: config.get('BUNNY_API_URL'),
              tusUrl: config.get('BUNNY_TUS_URL'),
              embedUrl: config.get('BUNNY_EMBED_URL'),
              cdnHost: config.get('BUNNY_CDN_HOST'),
            })
          : new LocalVideoProvider(storage, prisma),
    },
  ],
  exports: [ContentService, LessonViewService, MediaAccessService, VIDEO_PROVIDER],
})
export class ContentModule {}
