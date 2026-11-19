import { HttpStatus, Injectable, Inject } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { renderRichText } from './rich-text';
import { videoPosterUrl } from './video/video-poster';
import { VIDEO_PROVIDER, type VideoProvider } from './video/video-provider';

export type LessonStageName = 'PREPARE' | 'WATCH' | 'REVISE' | 'EXAMPLES';

export interface LessonViewSlide {
  id: string;
  title: string;
  body: string | null;
  keywords: string[];
  imageUrl: string | null;
}

/** `stage` says which step of the guided lesson a block belongs to; null is the plain lesson part. */
export type LessonViewBlock = { stage: LessonStageName | null } & (
  | { id: string; type: 'TEXT'; html: string }
  | { id: string; type: 'IMAGE'; url: string; caption: string | null }
  | { id: string; type: 'SLIDES'; slides: LessonViewSlide[] }
  | {
      id: string;
      type: 'PDF' | 'AUDIO';
      url: string;
      name: string;
      sizeBytes: number;
      caption: string | null;
      /** Present only when the teacher allowed downloads for this lesson. */
      downloadUrl: string | null;
    }
  | {
      id: string;
      /** PowerPoint, Word or Excel: always downloaded (it can't be shown inside the page). */
      type: 'FILE';
      url: string;
      name: string;
      sizeBytes: number;
      caption: string | null;
    }
  | {
      id: string;
      type: 'VIDEO';
      videoId: string;
      title: string;
      status: string;
      durationSec: number | null;
      posterUrl: string | null;
      caption: string | null;
    }
);

export interface LessonViewModel {
  id: string;
  title: string;
  description: string | null;
  objectives: string[];
  estimatedMinutes: number | null;
  isFreePreview: boolean;
  downloadsAllowed: boolean;
  course: { id: string; title: string; lang: string; dir: 'ltr' | 'rtl' };
  unit: { id: string; title: string };
  blocks: LessonViewBlock[];
}

/**
 * The one render model for a lesson. Teachers' previews use it today; students and free-preview
 * visitors use the very same one later, so what the teacher previews is what students see (M3 goal).
 * Callers must have run the access check first.
 */
@Injectable()
export class LessonViewService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VIDEO_PROVIDER) private readonly videoProvider: VideoProvider,
  ) {}

  async build(lessonId: string): Promise<LessonViewModel> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        unit: { select: { id: true, title: true } },
        course: {
          select: {
            id: true,
            title: true,
            language: { select: { code: true, direction: true } },
          },
        },
        blocks: {
          orderBy: { position: 'asc' },
          include: { file: true, video: true, slides: { orderBy: { position: 'asc' } } },
        },
      },
    });
    if (!lesson) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);

    const blocks: LessonViewBlock[] = [];
    for (const block of lesson.blocks) {
      const stage = block.stage;
      switch (block.type) {
        case 'TEXT':
          blocks.push({ stage, id: block.id, type: 'TEXT', html: renderRichText(block.textJson) });
          break;
        case 'IMAGE':
          if (block.file) {
            blocks.push({
              stage,
              id: block.id,
              type: 'IMAGE',
              url: `/api/v1/files/${block.file.id}`,
              caption: block.caption,
            });
          }
          break;
        case 'PDF':
        case 'AUDIO':
          if (block.file) {
            blocks.push({
              stage,
              id: block.id,
              type: block.type,
              url: `/api/v1/files/${block.file.id}`,
              name: block.file.originalName,
              sizeBytes: block.file.sizeBytes,
              caption: block.caption,
              downloadUrl: lesson.downloadsAllowed
                ? `/api/v1/files/${block.file.id}?download=1`
                : null,
            });
          }
          break;
        case 'FILE':
          if (block.file) {
            blocks.push({
              stage,
              id: block.id,
              type: 'FILE',
              url: `/api/v1/files/${block.file.id}`,
              name: block.file.originalName,
              sizeBytes: block.file.sizeBytes,
              caption: block.caption,
            });
          }
          break;
        case 'SLIDES':
          blocks.push({
            stage,
            id: block.id,
            type: 'SLIDES',
            slides: block.slides.map((sl) => ({
              id: sl.id,
              title: sl.title,
              body: sl.body,
              keywords: sl.keywords,
              imageUrl: sl.imageFileId ? `/api/v1/files/${sl.imageFileId}` : null,
            })),
          });
          break;
        case 'VIDEO':
          if (block.video) {
            blocks.push({
              stage,
              id: block.id,
              type: 'VIDEO',
              videoId: block.video.id,
              title: block.video.title,
              status: block.video.status,
              durationSec: block.video.durationSec,
              posterUrl: videoPosterUrl(block.video, this.videoProvider),
              caption: block.caption,
            });
          }
          break;
      }
    }

    return {
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      objectives: lesson.objectives,
      estimatedMinutes: lesson.estimatedMinutes,
      isFreePreview: lesson.isFreePreview,
      downloadsAllowed: lesson.downloadsAllowed,
      course: {
        id: lesson.course.id,
        title: lesson.course.title,
        lang: lesson.course.language.code,
        dir: lesson.course.language.direction === 'RTL' ? 'rtl' : 'ltr',
      },
      unit: lesson.unit,
      blocks,
    };
  }
}
