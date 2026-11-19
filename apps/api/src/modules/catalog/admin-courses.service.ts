import { parseExternalVideo } from '../content/video/external-video';
import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import { type CourseInput, slugify } from '@natik/shared';
import type { Queue } from 'bullmq';
import { AppException } from '../../common/errors/app.exception';
import { StorageService } from '../../common/storage/storage.service';
import { QUEUES } from '../../jobs/queues';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';
import { isValidRichText } from '../content/rich-text';

const listSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  access: true,
  priceSantim: true,
  featured: true,
  imageFileId: true,
  createdAt: true,
  language: { select: { id: true, name: true } },
  level: { select: { id: true, name: true } },
  teachers: { select: { teacher: { select: { id: true, fullName: true } } } },
  _count: { select: { enrolments: { where: { status: 'ACTIVE' as const } } } },
} satisfies Prisma.CourseSelect;

const imageUrl = (id: string | null) => (id ? `/api/v1/files/${id}` : null);

type ListRow = Prisma.CourseGetPayload<{ select: typeof listSelect }>;

function toListItem(row: ListRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    access: row.access,
    priceSantim: row.priceSantim,
    featured: row.featured,
    imageUrl: imageUrl(row.imageFileId),
    language: row.language,
    level: row.level,
    teachers: row.teachers.map((t) => t.teacher),
    studentCount: row._count.enrolments,
    createdAt: row.createdAt,
  };
}

/** Course management for admins (FR-ADMIN-003, FR-ADMIN-004, FR-ENR-001). */
@Injectable()
export class AdminCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    @InjectQueue(QUEUES.PROGRESS) private readonly progressQueue: Queue,
  ) {}

  async list(query: {
    q?: string;
    status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.CourseWhereInput = {};
    if (query.q) where.title = { contains: query.q, mode: 'insensitive' };
    if (query.status) where.status = query.status;
    const [rows, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        select: listSelect,
        orderBy: [{ createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.course.count({ where }),
    ]);
    return { items: rows.map(toListItem), total, page: query.page, pageSize: query.pageSize };
  }

  async get(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        language: { select: { id: true, name: true, code: true, direction: true } },
        level: { select: { id: true, name: true } },
        teachers: { select: { teacher: { select: { id: true, fullName: true } } } },
        _count: {
          select: { units: true, lessons: true, enrolments: { where: { status: 'ACTIVE' } } },
        },
      },
    });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const { imageFileId, teachers, _count, ...rest } = course;
    return {
      ...rest,
      imageFileId,
      imageUrl: imageUrl(imageFileId),
      teachers: teachers.map((t) => t.teacher),
      unitCount: _count.units,
      lessonCount: _count.lessons,
      studentCount: _count.enrolments,
    };
  }

  private async uniqueSlug(base: string, ignoreId?: string): Promise<string> {
    const root = base || 'course';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      const taken = await this.prisma.course.findFirst({
        where: { slug: candidate, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `${root}-${Date.now()}`;
  }

  private async checkReferences(input: CourseInput): Promise<void> {
    const [language, level] = await Promise.all([
      this.prisma.language.findUnique({ where: { id: input.languageId } }),
      this.prisma.level.findUnique({ where: { id: input.levelId } }),
    ]);
    const fields: Record<string, string[]> = {};
    if (!language) fields.languageId = ['Choose a language.'];
    if (!level) fields.levelId = ['Choose a level.'];
    if (input.trailerUrl?.trim() && !parseExternalVideo(input.trailerUrl)) {
      fields.trailerUrl = ['Use a YouTube or Vimeo link.'];
    }
    if (input.description && !isValidRichText(input.description)) {
      fields.description = ['This description could not be saved. Please edit it and try again.'];
    }
    if (Object.keys(fields).length > 0) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, { fields });
    }
    if (input.imageFileId) {
      const file = await this.prisma.fileAsset.findUnique({ where: { id: input.imageFileId } });
      if (!file || file.purpose !== 'COURSE_IMAGE') {
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
          fields: { imageFileId: ['Upload the picture again.'] },
        });
      }
    }
  }

  private data(input: CourseInput) {
    const paid = input.access === 'PAID';
    return {
      title: input.title,
      languageId: input.languageId,
      levelId: input.levelId,
      summary: input.summary,
      description: input.description
        ? (input.description as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      outcomes: input.outcomes,
      durationText: input.durationText?.trim() || null,
      access: input.access,
      priceSantim: paid ? (input.priceSantim ?? null) : null,
      accessDays: input.accessDays ?? null,
      featured: input.featured ?? false,
      imageFileId: input.imageFileId ?? null,
      ...(input.lessonOrder === undefined ? {} : { lessonOrder: input.lessonOrder }),
      ...(input.showPrice === undefined ? {} : { showPrice: input.showPrice }),
      ...(input.ongoing === undefined ? {} : { ongoing: input.ongoing }),
      ...(input.trailerUrl === undefined ? {} : { trailerUrl: input.trailerUrl?.trim() || null }),
    };
  }

  async create(actor: SessionUser, input: CourseInput) {
    await this.checkReferences(input);
    const branch = await this.prisma.branch.findFirstOrThrow();
    const slug = input.slug
      ? await this.assertSlugFree(input.slug)
      : await this.uniqueSlug(slugify(input.title));
    const course = await this.prisma.course.create({
      data: {
        // New courses run week by week: sessions keep being added until an admin says it is finished.
        ongoing: true,
        ...this.data(input),
        slug,
        branchId: branch.id,
        featuredPosition: input.featured ? await this.nextFeaturedPosition() : null,
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'COURSE_CREATED',
      entityType: 'Course',
      entityId: course.id,
      details: { title: course.title },
    });
    return this.get(course.id);
  }

  private async assertSlugFree(slug: string, ignoreId?: string): Promise<string> {
    const taken = await this.prisma.course.findFirst({
      where: { slug, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
      select: { id: true },
    });
    if (taken) {
      throw new AppException('SLUG_TAKEN', HttpStatus.CONFLICT, {
        fields: { slug: ['This web address is already used. Choose a different one.'] },
      });
    }
    return slug;
  }

  private async nextFeaturedPosition(): Promise<number> {
    const max = await this.prisma.course.aggregate({ _max: { featuredPosition: true } });
    return (max._max.featuredPosition ?? 0) + 1;
  }

  async update(actor: SessionUser, id: string, input: CourseInput) {
    const existing = await this.prisma.course.findUnique({ where: { id } });
    if (!existing) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.checkReferences(input);
    const slug =
      input.slug && input.slug !== existing.slug
        ? await this.assertSlugFree(input.slug, id)
        : existing.slug;

    // A published course must stay complete: it cannot lose its picture, or its price when paid.
    if (existing.status === 'PUBLISHED') {
      const problems = this.completenessProblems({
        ...this.data(input),
        imageFileId: input.imageFileId ?? null,
      });
      if (Object.keys(problems).length > 0) {
        throw new AppException('NOT_READY_TO_PUBLISH', HttpStatus.UNPROCESSABLE_ENTITY, {
          fields: problems,
        });
      }
    }

    const featured = input.featured ?? false;
    await this.prisma.course.update({
      where: { id },
      data: {
        ...this.data(input),
        slug,
        featuredPosition: featured
          ? (existing.featuredPosition ?? (await this.nextFeaturedPosition()))
          : null,
      },
    });
    if (existing.imageFileId && existing.imageFileId !== (input.imageFileId ?? null)) {
      await this.discardImage(existing.imageFileId);
    }
    await this.audit.record({
      actorId: actor.id,
      action: 'COURSE_UPDATED',
      entityType: 'Course',
      entityId: id,
      details: {
        access: input.access,
        priceSantim: input.priceSantim ?? null,
        accessDays: input.accessDays ?? null,
        featured,
      },
    });
    return this.get(id);
  }

  /** Removes a replaced picture, unless something else still uses it. */
  private async discardImage(fileId: string): Promise<void> {
    const stillUsed = await this.prisma.course.count({ where: { imageFileId: fileId } });
    if (stillUsed > 0) return;
    const file = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file) return;
    await this.prisma.fileAsset.delete({ where: { id: fileId } }).catch(() => undefined);
    await this.storage.remove(file.storageKey).catch(() => undefined);
  }

  private completenessProblems(c: {
    title: string;
    languageId: string;
    levelId: string;
    summary: string;
    imageFileId: string | null;
    access: 'FREE' | 'PAID';
    priceSantim: number | null;
  }): Record<string, string[]> {
    const problems: Record<string, string[]> = {};
    if (!c.title.trim()) problems.title = ['Add a title.'];
    if (!c.languageId) problems.languageId = ['Choose a language.'];
    if (!c.levelId) problems.levelId = ['Choose a level.'];
    if (!c.summary.trim()) problems.summary = ['Write a short summary.'];
    if (!c.imageFileId) problems.imageFileId = ['Add a course picture.'];
    if (c.access === 'PAID' && (c.priceSantim ?? 0) < 100) {
      problems.priceSantim = ['Enter the price for this paid course.'];
    }
    return problems;
  }

  /** Publishing needs the basics: title, language, level, summary, picture, and a price if paid. */
  async publish(actor: SessionUser, id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const problems = this.completenessProblems(course);
    if (Object.keys(problems).length > 0) {
      throw new AppException('NOT_READY_TO_PUBLISH', HttpStatus.UNPROCESSABLE_ENTITY, {
        fields: problems,
      });
    }
    if (course.status !== 'PUBLISHED') {
      await this.prisma.course.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: course.publishedAt ?? new Date() },
      });
      await this.afterVisibilityChange(actor, id, 'COURSE_PUBLISHED');
    }
    return this.get(id);
  }

  async hide(actor: SessionUser, id: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (course.status === 'DRAFT') {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'This course has not been published yet, so there is nothing to hide.',
      });
    }
    if (course.status !== 'HIDDEN') {
      await this.prisma.course.update({ where: { id }, data: { status: 'HIDDEN' } });
      await this.afterVisibilityChange(actor, id, 'COURSE_HIDDEN');
    }
    return this.get(id);
  }

  private async afterVisibilityChange(actor: SessionUser, courseId: string, action: string) {
    await this.audit.record({
      actorId: actor.id,
      action,
      entityType: 'Course',
      entityId: courseId,
    });
    await this.progressQueue.add(
      'recalc',
      { courseId },
      { jobId: `recalc-${courseId}-${Date.now()}` },
    );
  }

  /** Only a course that was never published can be deleted; otherwise it is hidden (FR-TEACH-008). */
  async remove(actor: SessionUser, id: string): Promise<void> {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (course.status !== 'DRAFT' || course.publishedAt) {
      throw new AppException('CANNOT_DELETE_PUBLISHED', HttpStatus.CONFLICT);
    }
    const hasEnrolments = await this.prisma.enrolment.count({ where: { courseId: id } });
    if (hasEnrolments > 0) throw new AppException('CANNOT_DELETE_PUBLISHED', HttpStatus.CONFLICT);

    await this.prisma.$transaction([
      this.prisma.lessonBlock.deleteMany({ where: { lesson: { courseId: id } } }),
      this.prisma.lesson.deleteMany({ where: { courseId: id } }),
      this.prisma.unit.deleteMany({ where: { courseId: id } }),
      this.prisma.courseTeacher.deleteMany({ where: { courseId: id } }),
      this.prisma.course.delete({ where: { id } }),
    ]);
    if (course.imageFileId) await this.discardImage(course.imageFileId);
    await this.audit.record({
      actorId: actor.id,
      action: 'COURSE_DELETED',
      entityType: 'Course',
      entityId: id,
      details: { title: course.title },
    });
  }

  /** Replaces the list of teachers assigned to a course (FR-ADMIN-004). */
  async setTeachers(actor: SessionUser, id: string, teacherIds: string[]) {
    const course = await this.prisma.course.findUnique({ where: { id }, select: { id: true } });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const unique = [...new Set(teacherIds)];
    const teachers = await this.prisma.user.findMany({
      where: { id: { in: unique }, role: 'TEACHER', status: 'ACTIVE' },
      select: { id: true },
    });
    if (teachers.length !== unique.length) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        fields: { teacherIds: ['Choose active teachers only.'] },
      });
    }
    const before = await this.prisma.courseTeacher.findMany({
      where: { courseId: id },
      select: { teacherId: true },
    });
    await this.prisma.$transaction([
      this.prisma.courseTeacher.deleteMany({ where: { courseId: id } }),
      this.prisma.courseTeacher.createMany({
        data: unique.map((teacherId) => ({ courseId: id, teacherId })),
      }),
    ]);
    await this.audit.record({
      actorId: actor.id,
      action: 'COURSE_TEACHERS_CHANGED',
      entityType: 'Course',
      entityId: id,
      details: { before: before.map((b) => b.teacherId), after: unique },
    });
    return this.get(id);
  }

  /** Active teachers an admin can assign. */
  async teacherChoices() {
    const teachers = await this.prisma.user.findMany({
      where: { role: 'TEACHER', status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    });
    return { items: teachers };
  }
}
