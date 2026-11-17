import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { VideoStatus } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LessonViewService } from '../content/lesson-view.service';
import { renderRichText } from '../content/rich-text';
import { parseExternalVideo } from '../content/video/external-video';
import { videoPosterUrl } from '../content/video/video-poster';
import { VIDEO_PROVIDER, type VideoProvider } from '../content/video/video-provider';

const courseSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  durationText: true,
  access: true,
  priceSantim: true,
  accessDays: true,
  outcomes: true,
  featured: true,
  imageFileId: true,
  lessonOrder: true,
  showPrice: true,
  trailerUrl: true,
  language: { select: { name: true, code: true, direction: true } },
  level: { select: { name: true } },
} satisfies Prisma.CourseSelect;

/** Adds the public picture URL and hides the internal file id. */
function withImage<
  T extends {
    imageFileId: string | null;
    access: string;
    showPrice: boolean;
    priceSantim: number | null;
  },
>(course: T, allPrices = false) {
  const { imageFileId, ...rest } = course;
  return {
    ...rest,
    // A paid course can keep its price off the public site: people ask Natik support instead.
    priceSantim: !allPrices && rest.access === 'PAID' && !rest.showPrice ? null : rest.priceSantim,
    imageUrl: imageFileId ? `/api/v1/files/${imageFileId}` : null,
  };
}

/** Everything here is public, so only published content is ever returned (FR-WEB-006). */
@Injectable()
export class PublicCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lessonViews: LessonViewService,
    @Inject(VIDEO_PROVIDER) private readonly videoProvider: VideoProvider,
  ) {}

  async filters() {
    const [languages, levels, counts] = await Promise.all([
      this.prisma.language.findMany({
        where: { active: true },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, code: true, direction: true },
      }),
      this.prisma.level.findMany({
        where: { active: true },
        orderBy: { position: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.course.groupBy({
        by: ['languageId'],
        where: { status: 'PUBLISHED' },
        _count: { _all: true },
      }),
    ]);
    const byLanguage = new Map(counts.map((c) => [c.languageId, c._count._all]));
    return {
      languages: languages.map((l) => ({ ...l, courseCount: byLanguage.get(l.id) ?? 0 })),
      levels,
    };
  }

  async list(query: {
    language?: string;
    level?: string;
    featured?: boolean;
    /** Admins only: keep every price, even where the public site hides it. */
    allPrices?: boolean;
  }) {
    const where: Prisma.CourseWhereInput = { status: 'PUBLISHED' };
    if (query.language) where.language = { code: query.language };
    if (query.level) where.level = { name: { equals: query.level, mode: 'insensitive' } };
    if (query.featured) where.featured = true;
    const items = await this.prisma.course.findMany({
      where,
      select: courseSelect,
      orderBy: query.featured
        ? [{ featuredPosition: 'asc' }, { publishedAt: 'desc' }]
        : [{ language: { position: 'asc' } }, { level: { position: 'asc' } }, { title: 'asc' }],
      // A language centre has dozens of courses, not thousands: one page shows them all.
      take: 200,
    });
    return { items: items.map((c) => withImage(c, query.allPrices)) };
  }

  async detail(slug: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        ...courseSelect,
        description: true,
        teachers: {
          select: { teacher: { select: { fullName: true, bio: true } } },
          where: { teacher: { status: 'ACTIVE' } },
        },
        units: {
          where: { status: 'PUBLISHED' },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            lessons: {
              where: { status: 'PUBLISHED' },
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                isFreePreview: true,
                blocks: {
                  where: { type: 'VIDEO', video: { status: 'READY' } },
                  orderBy: { position: 'asc' },
                  take: 1,
                  select: {
                    video: {
                      select: {
                        id: true,
                        title: true,
                        status: true,
                        durationSec: true,
                        provider: true,
                        providerVideoId: true,
                        externalUrl: true,
                        posterFileId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const { teachers, units, description, trailerUrl, ...rest } = course;
    return {
      ...withImage(rest),
      trailerEmbedUrl: trailerUrl ? (parseExternalVideo(trailerUrl)?.embedUrl ?? null) : null,
      descriptionHtml: renderRichText(description),
      teachers: teachers.map((t) => ({ name: t.teacher.fullName, bio: t.teacher.bio })),
      outline: units.map((u) => ({
        id: u.id,
        title: u.title,
        lessons: u.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          isFreePreview: l.isFreePreview,
        })),
      })),
      previewVideo: this.previewVideo(units),
    };
  }

  /** The first video of the course's first free lesson: visitors can watch it on the course page. */
  private previewVideo(
    units: {
      lessons: {
        id: string;
        isFreePreview: boolean;
        blocks: {
          video: {
            id: string;
            title: string;
            status: VideoStatus;
            durationSec: number | null;
            provider: string;
            providerVideoId: string;
            externalUrl: string | null;
            posterFileId: string | null;
          } | null;
        }[];
      }[];
    }[],
  ) {
    for (const unit of units) {
      for (const lesson of unit.lessons) {
        const video = lesson.isFreePreview ? lesson.blocks[0]?.video : null;
        if (video) {
          return {
            lessonId: lesson.id,
            videoId: video.id,
            title: video.title,
            status: video.status,
            durationSec: video.durationSec,
            posterUrl: videoPosterUrl(video, this.videoProvider),
          };
        }
      }
    }
    return null;
  }

  private firstVideo(
    blocks: {
      video: {
        status: VideoStatus;
        durationSec: number | null;
        provider: string;
        providerVideoId: string;
        externalUrl: string | null;
        posterFileId: string | null;
      } | null;
    }[],
  ) {
    const video = blocks.find((b) => b.video?.status === 'READY')?.video;
    return {
      posterUrl: video ? videoPosterUrl(video, this.videoProvider) : null,
      durationSec: video?.durationSec ?? null,
    };
  }

  /** Every lesson a teacher marked as a free preview, in a published unit of a published course (FR-CAT-005). */
  async freeLessons() {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        isFreePreview: true,
        status: 'PUBLISHED',
        unit: { status: 'PUBLISHED' },
        course: { status: 'PUBLISHED' },
      },
      orderBy: [{ course: { publishedAt: 'desc' } }, { position: 'asc' }],
      take: 60,
      select: {
        id: true,
        title: true,
        blocks: {
          orderBy: { position: 'asc' },
          select: {
            type: true,
            video: {
              select: {
                id: true,
                title: true,
                status: true,
                durationSec: true,
                provider: true,
                providerVideoId: true,
                externalUrl: true,
                posterFileId: true,
              },
            },
          },
        },
        course: {
          select: {
            slug: true,
            title: true,
            imageFileId: true,
            language: { select: { name: true, code: true, direction: true } },
            level: { select: { name: true } },
          },
        },
      },
    });
    return {
      items: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        blockTypes: [...new Set(l.blocks.map((b) => b.type))],
        // The lesson's first ready video: its still picture is shown on the card.
        ...this.firstVideo(l.blocks),
        course: {
          slug: l.course.slug,
          title: l.course.title,
          imageUrl: l.course.imageFileId ? `/api/v1/files/${l.course.imageFileId}` : null,
          language: l.course.language,
          level: l.course.level.name,
        },
      })),
    };
  }

  /**
   * One free-preview lesson for anyone. Anything else (paid, draft, hidden, unknown) answers
   * "not found" with no hint that it exists (FR-WEB-006).
   */
  async freeLesson(id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id,
        isFreePreview: true,
        status: 'PUBLISHED',
        unit: { status: 'PUBLISHED' },
        course: { status: 'PUBLISHED' },
      },
      select: {
        id: true,
        course: { select: { slug: true, title: true, access: true, priceSantim: true } },
      },
    });
    if (!lesson) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return { lesson: await this.lessonViews.build(lesson.id), course: lesson.course };
  }
}
