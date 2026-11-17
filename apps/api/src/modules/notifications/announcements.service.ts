import { HttpStatus, Injectable } from '@nestjs/common';
import type { AnnouncementInput } from '@natik/shared';
import { AccessPolicy } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';

/** Plain text (paragraphs separated by blank lines) → a rich-text document. */
export function textToDoc(text: string): Prisma.InputJsonObject {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    type: 'doc',
    content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
  };
}

/** A rich-text document → plain text with blank lines between paragraphs. */
export function docToText(doc: unknown): string {
  const lines: string[] = [];
  const inline = (node: unknown): string => {
    if (!node || typeof node !== 'object') return '';
    const n = node as { text?: string; content?: unknown[] };
    return (typeof n.text === 'string' ? n.text : '') + (n.content ?? []).map(inline).join('');
  };
  const root = doc as { content?: unknown[] } | null;
  for (const block of root?.content ?? []) lines.push(inline(block));
  return lines.filter(Boolean).join('\n\n');
}

/**
 * Announcements (FR-NOTIF-001). Admins post to everyone, to all students, or to one course.
 * Teachers post only to their own courses (SRS §3). Public ones show on the website.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicy,
    private readonly audit: AuditService,
  ) {}

  private async assignedCourseIds(actor: SessionUser): Promise<string[] | null> {
    if (actor.role === 'ADMIN') return null;
    const links = await this.prisma.courseTeacher.findMany({
      where: { teacherId: actor.id },
      select: { courseId: true },
    });
    return links.map((l) => l.courseId);
  }

  /** The announcements this person manages, plus the courses they can post to. */
  async list(actor: SessionUser) {
    const courseIds = await this.assignedCourseIds(actor);
    const where: Prisma.AnnouncementWhereInput =
      courseIds === null ? {} : { audience: 'COURSE', courseId: { in: courseIds } };
    const [rows, courses] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { publishAt: 'desc' },
        take: 100,
        include: {
          course: { select: { id: true, title: true } },
          author: { select: { fullName: true } },
        },
      }),
      this.prisma.course.findMany({
        where: courseIds === null ? {} : { id: { in: courseIds } },
        orderBy: { title: 'asc' },
        select: { id: true, title: true },
      }),
    ]);
    return {
      items: rows.map((a) => ({
        id: a.id,
        title: a.title,
        text: docToText(a.body),
        audience: a.audience,
        course: a.course,
        author: a.author.fullName,
        publishAt: a.publishAt,
        scheduled: a.publishAt > new Date(),
      })),
      courses,
    };
  }

  private async check(actor: SessionUser, input: AnnouncementInput): Promise<string | null> {
    if (input.audience === 'COURSE') {
      if (!input.courseId) {
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
          fields: { courseId: ['Choose a course.'] },
        });
      }
      const course = await this.prisma.course.findUnique({
        where: { id: input.courseId },
        select: { id: true },
      });
      if (!course) {
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
          fields: { courseId: ['Choose a course.'] },
        });
      }
      await this.access.assertCanEditCourseContent(actor, input.courseId);
      return input.courseId;
    }
    // Everyone-wide announcements are for admins only.
    if (actor.role !== 'ADMIN') throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    return null;
  }

  async create(actor: SessionUser, input: AnnouncementInput) {
    const courseId = await this.check(actor, input);
    const branch = await this.prisma.branch.findFirstOrThrow();
    const created = await this.prisma.announcement.create({
      data: {
        branchId: branch.id,
        title: input.title,
        body: textToDoc(input.text),
        audience: input.audience,
        courseId,
        authorId: actor.id,
        publishAt: input.publishAt ? new Date(input.publishAt) : new Date(),
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'ANNOUNCEMENT_POSTED',
      entityType: 'Announcement',
      entityId: created.id,
      details: { audience: input.audience, courseId },
    });
    return { id: created.id };
  }

  private async load(actor: SessionUser, id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    // A teacher may only touch announcements for courses they teach.
    if (actor.role !== 'ADMIN') {
      if (existing.audience !== 'COURSE' || !existing.courseId) {
        throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
      }
      await this.access.assertCanEditCourseContent(actor, existing.courseId);
    }
    return existing;
  }

  async update(actor: SessionUser, id: string, input: AnnouncementInput) {
    await this.load(actor, id);
    const courseId = await this.check(actor, input);
    await this.prisma.announcement.update({
      where: { id },
      data: {
        title: input.title,
        body: textToDoc(input.text),
        audience: input.audience,
        courseId,
        ...(input.publishAt ? { publishAt: new Date(input.publishAt) } : {}),
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'ANNOUNCEMENT_UPDATED',
      entityType: 'Announcement',
      entityId: id,
    });
    return { id };
  }

  async remove(actor: SessionUser, id: string) {
    await this.load(actor, id);
    await this.prisma.announcementRead.deleteMany({ where: { announcementId: id } });
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.record({
      actorId: actor.id,
      action: 'ANNOUNCEMENT_DELETED',
      entityType: 'Announcement',
      entityId: id,
    });
  }

  // ── Student feed (FR-NOTIF-002) ─────────────────────────────────────────

  /** Announcements a student may read: public, all students, and their own courses. Already published only. */
  private async visibleToStudent(studentId: string): Promise<Prisma.AnnouncementWhereInput> {
    const enrolled = await this.prisma.enrolment.findMany({
      where: { studentId, status: { notIn: ['CANCELLED'] } },
      select: { courseId: true },
    });
    return {
      publishAt: { lte: new Date() },
      OR: [
        { audience: 'PUBLIC' },
        { audience: 'ALL_STUDENTS' },
        { audience: 'COURSE', courseId: { in: enrolled.map((e) => e.courseId) } },
      ],
    };
  }

  async studentFeed(studentId: string) {
    const rows = await this.prisma.announcement.findMany({
      where: await this.visibleToStudent(studentId),
      orderBy: { publishAt: 'desc' },
      take: 50,
      include: {
        course: { select: { title: true } },
        reads: { where: { userId: studentId }, select: { readAt: true } },
      },
    });
    const items = rows.map((a) => ({
      id: a.id,
      title: a.title,
      text: docToText(a.body),
      audience: a.audience,
      courseTitle: a.course?.title ?? null,
      publishAt: a.publishAt,
      read: a.reads.length > 0,
    }));
    return { items, unread: items.filter((i) => !i.read).length };
  }

  async unreadCount(studentId: string): Promise<{ count: number }> {
    const count = await this.prisma.announcement.count({
      where: {
        AND: [await this.visibleToStudent(studentId), { reads: { none: { userId: studentId } } }],
      },
    });
    return { count };
  }

  /** The dashboard's "News" block: how many are new, and the latest three. */
  async studentSummary(studentId: string) {
    const feed = await this.studentFeed(studentId);
    return { unread: feed.unread, latest: feed.items.slice(0, 3) };
  }

  /** Marks one announcement read, but only if this student is allowed to see it. */
  async markRead(studentId: string, announcementId: string): Promise<{ ok: true }> {
    const visible = await this.prisma.announcement.findFirst({
      where: { AND: [{ id: announcementId }, await this.visibleToStudent(studentId)] },
      select: { id: true },
    });
    if (!visible) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.prisma.announcementRead.upsert({
      where: { userId_announcementId: { userId: studentId, announcementId } },
      create: { userId: studentId, announcementId },
      update: {},
    });
    return { ok: true };
  }

  async markAllRead(studentId: string): Promise<{ ok: true }> {
    const unread = await this.prisma.announcement.findMany({
      where: {
        AND: [await this.visibleToStudent(studentId), { reads: { none: { userId: studentId } } }],
      },
      select: { id: true },
    });
    if (unread.length > 0) {
      await this.prisma.announcementRead.createMany({
        data: unread.map((a) => ({ userId: studentId, announcementId: a.id })),
        skipDuplicates: true,
      });
    }
    return { ok: true };
  }
}
