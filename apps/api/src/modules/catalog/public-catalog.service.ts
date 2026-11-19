import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { renderRichText } from '../content/rich-text';
import { parseExternalVideo } from '../content/video/external-video';

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
  ongoing: true,
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
  constructor(private readonly prisma: PrismaService) {}

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
              select: { id: true, title: true, sessionDate: true },
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
      // Introduction only: the outline lists weeks and session titles, never their content.
      outline: units.map((u) => ({
        id: u.id,
        title: u.title,
        lessons: u.lessons.map((l) => ({ id: l.id, title: l.title, sessionDate: l.sessionDate })),
      })),
      ongoing: rest.ongoing,
    };
  }
}
