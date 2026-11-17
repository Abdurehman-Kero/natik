import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Inject } from '@nestjs/common';
import { MAX_SLIDES_PER_BLOCK, publishCheckMessages } from '@natik/shared';
import type { Queue } from 'bullmq';
import { AccessPolicy, type Actor } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { QUEUES } from '../../jobs/queues';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isValidRichText, richTextToPlain } from './rich-text';
import { videoPosterUrl } from './video/video-poster';
import { VIDEO_PROVIDER, type VideoProvider } from './video/video-provider';

const MAX_BLOCKS_PER_LESSON = 50;
const EMPTY_DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

type Stage = 'PREPARE' | 'WATCH' | 'REVISE' | 'EXAMPLES';

export interface SlideInput {
  title: string;
  body?: string | null;
  imageFileId?: string | null;
  keywords?: string[];
}

interface BlockCreate {
  type: 'TEXT' | 'VIDEO' | 'PDF' | 'AUDIO' | 'IMAGE' | 'SLIDES';
  stage?: Stage | null;
  textJson?: unknown;
  fileId?: string;
  videoId?: string;
  caption?: string;
}

const FILE_PURPOSE_FOR_BLOCK = {
  PDF: 'LESSON_PDF',
  AUDIO: 'LESSON_AUDIO',
  IMAGE: 'LESSON_IMAGE',
} as const;

/** Units, lessons and blocks: what teachers build (FR-TEACH-002/003/004/008, FR-LEARN-006…011). */
@Injectable()
export class ContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    private readonly audit: AuditService,
    @InjectQueue(QUEUES.PROGRESS) private readonly progressQueue: Queue,
    @Inject(VIDEO_PROVIDER) private readonly videoProvider: VideoProvider,
  ) {}

  // ── Which courses can I work on? ───────────────────────────────────────

  /** Assigned courses for a teacher; every course for an admin. */
  async myCourses(actor: Actor) {
    const where: Prisma.CourseWhereInput =
      actor.role === 'ADMIN' ? {} : { teachers: { some: { teacherId: actor.id } } };
    const courses = await this.prisma.course.findMany({
      where,
      orderBy: [{ title: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        imageFileId: true,
        language: { select: { name: true } },
        level: { select: { name: true } },
        _count: {
          select: { units: true, lessons: true, enrolments: { where: { status: 'ACTIVE' } } },
        },
        lessons: { where: { status: 'PUBLISHED' }, select: { id: true } },
      },
    });
    return {
      items: courses.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        imageUrl: c.imageFileId ? `/api/v1/files/${c.imageFileId}` : null,
        language: c.language.name,
        level: c.level.name,
        unitCount: c._count.units,
        lessonCount: c._count.lessons,
        publishedLessonCount: c.lessons.length,
        studentCount: c._count.enrolments,
      })),
    };
  }

  /** The units and lessons tree. Course settings come back read-only (FR-TEACH-007). */
  async outline(actor: Actor, courseId: string) {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        status: true,
        access: true,
        priceSantim: true,
        accessDays: true,
        featured: true,
        language: { select: { name: true, code: true, direction: true } },
        level: { select: { name: true } },
        units: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            title: true,
            status: true,
            position: true,
            lessons: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                title: true,
                status: true,
                position: true,
                isFreePreview: true,
                blocks: { orderBy: { position: 'asc' }, select: { type: true } },
              },
            },
          },
        },
      },
    });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return {
      course: {
        id: course.id,
        title: course.title,
        status: course.status,
        access: course.access,
        priceSantim: course.priceSantim,
        accessDays: course.accessDays,
        language: course.language,
        level: course.level.name,
        canEditSettings: this.access.canEditCourseSettings(actor),
      },
      units: course.units.map((u) => ({
        id: u.id,
        title: u.title,
        status: u.status,
        lessons: u.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          status: l.status,
          isFreePreview: l.isFreePreview,
          blockTypes: l.blocks.map((b) => b.type),
        })),
      })),
    };
  }

  /** Teachers preview a lesson with the same render model students get; only people who can edit the course may. */
  async assertCanPreview(actor: Actor, lessonId: string): Promise<void> {
    const lesson = await this.lessonOf(lessonId);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
  }

  // ── Units ──────────────────────────────────────────────────────────────

  private async unitOf(id: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id }, include: { lessons: true } });
    if (!unit) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return unit;
  }

  async createUnit(actor: Actor, courseId: string, title: string) {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const max = await this.prisma.unit.aggregate({ where: { courseId }, _max: { position: true } });
    const unit = await this.prisma.unit.create({
      data: { courseId, title, position: (max._max.position ?? 0) + 1 },
    });
    return { id: unit.id, title: unit.title, status: unit.status, lessons: [] };
  }

  async renameUnit(actor: Actor, unitId: string, title: string) {
    const unit = await this.unitOf(unitId);
    await this.access.assertCanEditCourseContent(actor, unit.courseId);
    const updated = await this.prisma.unit.update({ where: { id: unitId }, data: { title } });
    return { id: updated.id, title: updated.title, status: updated.status };
  }

  async setUnitStatus(actor: Actor, unitId: string, to: 'PUBLISHED' | 'HIDDEN') {
    const unit = await this.unitOf(unitId);
    await this.access.assertCanEditCourseContent(actor, unit.courseId);
    if (to === 'HIDDEN' && unit.status === 'DRAFT') {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'This unit has not been published yet, so there is nothing to hide.',
      });
    }
    if (unit.status !== to) {
      await this.prisma.unit.update({ where: { id: unitId }, data: { status: to } });
      await this.afterVisibilityChange(actor, unit.courseId, 'Unit', unitId, to);
    }
    return { id: unitId, status: to };
  }

  /** Only a unit that was never published can be deleted (FR-TEACH-008). */
  async deleteUnit(actor: Actor, unitId: string) {
    const unit = await this.unitOf(unitId);
    await this.access.assertCanEditCourseContent(actor, unit.courseId);
    const everLive =
      unit.status !== 'DRAFT' || unit.lessons.some((l) => l.status !== 'DRAFT' || l.publishedAt);
    if (everLive) throw new AppException('CANNOT_DELETE_PUBLISHED', HttpStatus.CONFLICT);
    await this.prisma.$transaction([
      this.prisma.lessonBlock.deleteMany({ where: { lesson: { unitId } } }),
      this.prisma.lesson.deleteMany({ where: { unitId } }),
      this.prisma.unit.delete({ where: { id: unitId } }),
    ]);
  }

  async reorderUnits(actor: Actor, courseId: string, ids: string[]) {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const units = await this.prisma.unit.findMany({ where: { courseId }, select: { id: true } });
    this.assertSameSet(
      ids,
      units.map((u) => u.id),
    );
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.unit.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return { ok: true };
  }

  // ── Lessons ────────────────────────────────────────────────────────────

  private async lessonOf(id: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return lesson;
  }

  async createLesson(actor: Actor, unitId: string, title: string) {
    const unit = await this.unitOf(unitId);
    await this.access.assertCanEditCourseContent(actor, unit.courseId);
    const max = await this.prisma.lesson.aggregate({ where: { unitId }, _max: { position: true } });
    const lesson = await this.prisma.lesson.create({
      data: { unitId, courseId: unit.courseId, title, position: (max._max.position ?? 0) + 1 },
    });
    return this.getLesson(actor, lesson.id);
  }

  /** A lesson for the editor: settings plus its blocks (files and videos described). */
  async getLesson(actor: Actor, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        unit: { select: { id: true, title: true } },
        course: {
          select: { id: true, title: true, language: { select: { code: true, direction: true } } },
        },
        blocks: {
          orderBy: { position: 'asc' },
          include: {
            file: true,
            video: true,
            slides: { orderBy: { position: 'asc' } },
          },
        },
        quiz: {
          select: {
            id: true,
            title: true,
            status: true,
            isFinal: true,
            _count: { select: { questions: true } },
          },
        },
      },
    });
    if (!lesson) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
    return {
      id: lesson.id,
      title: lesson.title,
      status: lesson.status,
      quiz: lesson.quiz
        ? {
            id: lesson.quiz.id,
            title: lesson.quiz.title,
            status: lesson.quiz.status,
            isFinal: lesson.quiz.isFinal,
            questionCount: lesson.quiz._count.questions,
          }
        : null,
      isFreePreview: lesson.isFreePreview,
      downloadsAllowed: lesson.downloadsAllowed,
      description: lesson.description,
      objectives: lesson.objectives,
      estimatedMinutes: lesson.estimatedMinutes,
      alwaysOpen: lesson.alwaysOpen,
      unit: lesson.unit,
      course: {
        id: lesson.course.id,
        title: lesson.course.title,
        lang: lesson.course.language.code,
        dir: lesson.course.language.direction === 'RTL' ? 'rtl' : 'ltr',
      },
      blocks: lesson.blocks.map((b) => ({
        id: b.id,
        type: b.type,
        stage: b.stage,
        textJson: b.textJson,
        caption: b.caption,
        slides: b.slides.map((sl) => ({
          id: sl.id,
          title: sl.title,
          body: sl.body,
          keywords: sl.keywords,
          imageUrl: sl.imageFileId ? `/api/v1/files/${sl.imageFileId}` : null,
          imageFileId: sl.imageFileId,
        })),
        file: b.file
          ? {
              id: b.file.id,
              url: `/api/v1/files/${b.file.id}`,
              name: b.file.originalName,
              sizeBytes: b.file.sizeBytes,
            }
          : null,
        video: b.video
          ? {
              id: b.video.id,
              title: b.video.title,
              status: b.video.status,
              durationSec: b.video.durationSec,
              external: b.video.provider === 'external',
              hasCaptions: b.video.captionFileId !== null,
              posterUrl: videoPosterUrl(b.video, this.videoProvider),
            }
          : null,
      })),
    };
  }

  async updateLesson(
    actor: Actor,
    lessonId: string,
    input: {
      title?: string;
      isFreePreview?: boolean;
      downloadsAllowed?: boolean;
      description?: string | null;
      objectives?: string[];
      estimatedMinutes?: number | null;
      alwaysOpen?: boolean;
    },
  ) {
    const lesson = await this.lessonOf(lessonId);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.isFreePreview === undefined ? {} : { isFreePreview: input.isFreePreview }),
        ...(input.downloadsAllowed === undefined
          ? {}
          : { downloadsAllowed: input.downloadsAllowed }),
        ...(input.description === undefined ? {} : { description: input.description || null }),
        ...(input.objectives === undefined ? {} : { objectives: input.objectives }),
        ...(input.estimatedMinutes === undefined
          ? {}
          : { estimatedMinutes: input.estimatedMinutes }),
        ...(input.alwaysOpen === undefined ? {} : { alwaysOpen: input.alwaysOpen }),
      },
    });
    return this.getLesson(actor, lessonId);
  }

  /** Checks the basics and says what is missing (inline in the editor). */
  private async publishProblems(lessonId: string): Promise<Record<string, string[]>> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { blocks: { include: { _count: { select: { slides: true } } } } },
    });
    const problems: Record<string, string[]> = {};
    if (!lesson?.title.trim()) problems.title = [publishCheckMessages.title];
    const meaningful = (lesson?.blocks ?? []).filter((b) =>
      b.type === 'TEXT'
        ? richTextToPlain(b.textJson).length > 0
        : b.type === 'SLIDES'
          ? b._count.slides > 0
          : true,
    );
    if (meaningful.length === 0) problems.blocks = [publishCheckMessages.blocks];
    return problems;
  }

  async setLessonStatus(actor: Actor, lessonId: string, to: 'PUBLISHED' | 'HIDDEN') {
    const lesson = await this.lessonOf(lessonId);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
    if (to === 'PUBLISHED') {
      const problems = await this.publishProblems(lessonId);
      if (Object.keys(problems).length > 0) {
        throw new AppException('NOT_READY_TO_PUBLISH', HttpStatus.UNPROCESSABLE_ENTITY, {
          fields: problems,
          message: Object.values(problems).flat().join(' '),
        });
      }
    } else if (lesson.status === 'DRAFT') {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'This lesson has not been published yet, so there is nothing to hide.',
      });
    }
    if (lesson.status !== to) {
      await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          status: to,
          ...(to === 'PUBLISHED' ? { publishedAt: lesson.publishedAt ?? new Date() } : {}),
        },
      });
      await this.afterVisibilityChange(actor, lesson.courseId, 'Lesson', lessonId, to);
    }
    // A lesson is only seen inside a published unit. Publishing the first lesson of a brand-new unit
    // publishes the unit too, so "This lesson is live" is true. A unit the teacher hid stays hidden.
    if (to === 'PUBLISHED') {
      const unit = await this.prisma.unit.findUnique({
        where: { id: lesson.unitId },
        select: { status: true },
      });
      if (unit?.status === 'DRAFT') {
        await this.prisma.unit.update({
          where: { id: lesson.unitId },
          data: { status: 'PUBLISHED' },
        });
        await this.afterVisibilityChange(
          actor,
          lesson.courseId,
          'Unit',
          lesson.unitId,
          'PUBLISHED',
        );
      }
    }
    return this.getLesson(actor, lessonId);
  }

  /** Only a lesson that was never published can be deleted; otherwise it is hidden (FR-TEACH-008). */
  async deleteLesson(actor: Actor, lessonId: string) {
    const lesson = await this.lessonOf(lessonId);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
    if (lesson.status !== 'DRAFT' || lesson.publishedAt) {
      throw new AppException('CANNOT_DELETE_PUBLISHED', HttpStatus.CONFLICT);
    }
    await this.prisma.$transaction([
      this.prisma.lessonBlock.deleteMany({ where: { lessonId } }),
      this.prisma.lesson.delete({ where: { id: lessonId } }),
    ]);
  }

  /**
   * Saves the order of lessons, including moves between units. `units` lists every unit that
   * changed with its lessons in the new order.
   */
  async reorderLessons(
    actor: Actor,
    courseId: string,
    units: { unitId: string; lessonIds: string[] }[],
  ) {
    await this.access.assertCanEditCourseContent(actor, courseId);
    const courseUnits = await this.prisma.unit.findMany({
      where: { courseId },
      select: { id: true },
    });
    const unitIds = new Set(courseUnits.map((u) => u.id));
    if (!units.every((u) => unitIds.has(u.unitId))) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);
    }
    const moved = units.flatMap((u) => u.lessonIds);
    if (new Set(moved).size !== moved.length)
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId, id: { in: moved } },
      select: { id: true },
    });
    if (lessons.length !== moved.length)
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);

    await this.prisma.$transaction(
      units.flatMap((u) =>
        u.lessonIds.map((id, index) =>
          this.prisma.lesson.update({
            where: { id },
            data: { unitId: u.unitId, position: index + 1 },
          }),
        ),
      ),
    );
    return { ok: true };
  }

  // ── Blocks ─────────────────────────────────────────────────────────────

  private async blockOf(id: string) {
    const block = await this.prisma.lessonBlock.findUnique({
      where: { id },
      include: { lesson: { select: { courseId: true } } },
    });
    if (!block) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return block;
  }

  async createBlock(actor: Actor, lessonId: string, input: BlockCreate) {
    const lesson = await this.lessonOf(lessonId);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
    const count = await this.prisma.lessonBlock.count({ where: { lessonId } });
    if (count >= MAX_BLOCKS_PER_LESSON) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: `A lesson can have up to ${MAX_BLOCKS_PER_LESSON} blocks. Split this into a new lesson.`,
      });
    }

    const data: Prisma.LessonBlockUncheckedCreateInput = {
      lessonId,
      type: input.type,
      position: count === 0 ? 1 : ((await this.maxBlockPosition(lessonId)) ?? 0) + 1,
      caption: input.caption ?? null,
      stage: input.stage ?? null,
    };

    if (input.type === 'TEXT') {
      const doc = input.textJson ?? EMPTY_DOC;
      if (!isValidRichText(doc))
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
      data.textJson = doc as Prisma.InputJsonValue;
    } else if (input.type === 'VIDEO') {
      if (!input.videoId) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
      const video = await this.prisma.videoAsset.findUnique({ where: { id: input.videoId } });
      if (!video || (actor.role !== 'ADMIN' && video.createdById !== actor.id)) {
        throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
      }
      data.videoId = video.id;
    } else if (input.type === 'SLIDES') {
      // A deck starts empty; slides are added one by one.
    } else {
      if (!input.fileId) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
      const file = await this.prisma.fileAsset.findUnique({ where: { id: input.fileId } });
      const wanted = FILE_PURPOSE_FOR_BLOCK[input.type as 'PDF' | 'AUDIO' | 'IMAGE'];
      // A file can only be attached to a lesson of the course it was uploaded for.
      const belongsHere = file?.storageKey.startsWith(`lessons/${lesson.courseId}/`);
      if (!file || file.purpose !== wanted || !belongsHere) {
        throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      }
      data.fileId = file.id;
    }

    const block = await this.prisma.lessonBlock.create({ data });
    return { id: block.id };
  }

  private async maxBlockPosition(lessonId: string): Promise<number | null> {
    const max = await this.prisma.lessonBlock.aggregate({
      where: { lessonId },
      _max: { position: true },
    });
    return max._max.position;
  }

  async updateBlock(
    actor: Actor,
    blockId: string,
    input: { textJson?: unknown; caption?: string | null; stage?: Stage | null },
  ) {
    const block = await this.blockOf(blockId);
    await this.access.assertCanEditCourseContent(actor, block.lesson.courseId);
    const data: Prisma.LessonBlockUpdateInput = {};
    if (input.textJson !== undefined) {
      if (block.type !== 'TEXT' || !isValidRichText(input.textJson)) {
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
      }
      data.textJson = input.textJson as Prisma.InputJsonValue;
    }
    if (input.caption !== undefined) data.caption = input.caption;
    if (input.stage !== undefined) data.stage = input.stage;
    await this.prisma.lessonBlock.update({ where: { id: blockId }, data });
    return { id: blockId };
  }

  async deleteBlock(actor: Actor, blockId: string) {
    const block = await this.blockOf(blockId);
    await this.access.assertCanEditCourseContent(actor, block.lesson.courseId);
    await this.prisma.lessonBlock.delete({ where: { id: blockId } });
  }

  async reorderBlocks(actor: Actor, lessonId: string, ids: string[]) {
    const lesson = await this.lessonOf(lessonId);
    await this.access.assertCanEditCourseContent(actor, lesson.courseId);
    const blocks = await this.prisma.lessonBlock.findMany({
      where: { lessonId },
      select: { id: true },
    });
    this.assertSameSet(
      ids,
      blocks.map((b) => b.id),
    );
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.lessonBlock.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return { ok: true };
  }

  // ── Slides ─────────────────────────────────────────────────────────────

  private async slideBlock(blockId: string) {
    const block = await this.blockOf(blockId);
    if (block.type !== 'SLIDES') {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
    }
    return block;
  }

  /** A slide picture must be a lesson picture uploaded for this very course. */
  private async checkSlideImage(courseId: string, fileId: string | null | undefined) {
    if (!fileId) return;
    const file = await this.prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (
      !file ||
      file.purpose !== 'LESSON_IMAGE' ||
      !file.storageKey.startsWith(`lessons/${courseId}/`)
    ) {
      throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
  }

  async createSlide(actor: Actor, blockId: string, input: SlideInput) {
    const block = await this.slideBlock(blockId);
    await this.access.assertCanEditCourseContent(actor, block.lesson.courseId);
    await this.checkSlideImage(block.lesson.courseId, input.imageFileId);
    const count = await this.prisma.lessonSlide.count({ where: { blockId } });
    if (count >= MAX_SLIDES_PER_BLOCK) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: `A deck can have up to ${MAX_SLIDES_PER_BLOCK} slides. Start a second deck.`,
      });
    }
    const max = await this.prisma.lessonSlide.aggregate({
      where: { blockId },
      _max: { position: true },
    });
    const slide = await this.prisma.lessonSlide.create({
      data: {
        blockId,
        position: (max._max.position ?? 0) + 1,
        title: input.title,
        body: input.body || null,
        imageFileId: input.imageFileId ?? null,
        keywords: input.keywords ?? [],
      },
    });
    return { id: slide.id };
  }

  private async slideOf(id: string) {
    const slide = await this.prisma.lessonSlide.findUnique({
      where: { id },
      include: { block: { include: { lesson: { select: { courseId: true } } } } },
    });
    if (!slide) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return slide;
  }

  async updateSlide(actor: Actor, slideId: string, input: Partial<SlideInput>) {
    const slide = await this.slideOf(slideId);
    await this.access.assertCanEditCourseContent(actor, slide.block.lesson.courseId);
    await this.checkSlideImage(slide.block.lesson.courseId, input.imageFileId);
    await this.prisma.lessonSlide.update({
      where: { id: slideId },
      data: {
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.body === undefined ? {} : { body: input.body || null }),
        ...(input.imageFileId === undefined ? {} : { imageFileId: input.imageFileId }),
        ...(input.keywords === undefined ? {} : { keywords: input.keywords }),
      },
    });
    return { id: slideId };
  }

  async deleteSlide(actor: Actor, slideId: string) {
    const slide = await this.slideOf(slideId);
    await this.access.assertCanEditCourseContent(actor, slide.block.lesson.courseId);
    await this.prisma.lessonSlide.delete({ where: { id: slideId } });
  }

  async reorderSlides(actor: Actor, blockId: string, ids: string[]) {
    const block = await this.slideBlock(blockId);
    await this.access.assertCanEditCourseContent(actor, block.lesson.courseId);
    const slides = await this.prisma.lessonSlide.findMany({
      where: { blockId },
      select: { id: true },
    });
    this.assertSameSet(
      ids,
      slides.map((s) => s.id),
    );
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.lessonSlide.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return { ok: true };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private assertSameSet(given: string[], actual: string[]) {
    const set = new Set(actual);
    if (
      given.length !== set.size ||
      new Set(given).size !== given.length ||
      !given.every((id) => set.has(id))
    ) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'The list changed while you were editing. Refresh and try again.',
      });
    }
  }

  /** Logs the change and asks the worker to refresh students' progress (used from M5). */
  private async afterVisibilityChange(
    actor: Actor,
    courseId: string,
    entityType: 'Unit' | 'Lesson',
    entityId: string,
    to: 'PUBLISHED' | 'HIDDEN',
  ) {
    await this.audit.record({
      actorId: actor.id,
      action: `${entityType.toUpperCase()}_${to}`,
      entityType,
      entityId,
      details: { courseId },
    });
    await this.progressQueue.add(
      'recalc',
      { courseId },
      { jobId: `recalc-${courseId}-${Date.now()}` },
    );
  }
}
