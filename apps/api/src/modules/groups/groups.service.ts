import { HttpStatus, Injectable } from '@nestjs/common';
import { bytesToMb } from '@natik/shared';
import { AccessPolicy } from '../../common/access/access-policy';
import { AppException } from '../../common/errors/app.exception';
import { createId } from '../../common/security/ids';
import { ImageService } from '../../common/storage/image.service';
import { StorageService } from '../../common/storage/storage.service';
import type { GroupMessageKind } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';
import { detectFile } from '../content/file-types';
import { displayName } from '../content/uploads.service';

const MB = 1024 * 1024;
const FILE_LIMIT = 20 * MB;
const VIDEO_LIMIT = 60 * MB;
const VOICE_LIMIT = 10 * MB;
const MAX_TEXT = 2000;
/** How long people can still change what they wrote. */
const EDIT_WINDOW_MS = 48 * 3600_000;

const OFFICE: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
};

export interface GroupFileView {
  url: string;
  name: string;
  mime: string;
  sizeBytes: number;
}

export interface GroupMessageView {
  id: string;
  kind: GroupMessageKind;
  body: string | null;
  mine: boolean;
  deleted: boolean;
  edited: boolean;
  pinned: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    role: 'ADMIN' | 'TEACHER' | 'STUDENT';
    avatarUrl: string | null;
  };
  durationSec: number | null;
  file: GroupFileView | null;
  replyTo: { id: string; senderName: string; text: string } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
}

const PERSON = { id: true, fullName: true, role: true, photoFileId: true } as const;

function preview(kind: GroupMessageKind, body: string | null, name?: string): string {
  if (kind === 'IMAGE') return body ? `Photo: ${body}` : 'Photo';
  if (kind === 'VIDEO') return body ? `Video: ${body}` : 'Video';
  if (kind === 'VOICE') return 'Voice message';
  if (kind === 'AUDIO') return name ? `Audio: ${name}` : 'Audio';
  if (kind === 'FILE') return name ? `File: ${name}` : 'File';
  return (body ?? '').slice(0, 120);
}

const avatar = (photoFileId: string | null) =>
  photoFileId ? `/api/v1/files/${photoFileId}` : null;

type Row = Awaited<ReturnType<GroupsService['query']>>[number];

/**
 * Course group chats: one per course, with everyone who takes part in it (accepted students, the
 * course's teachers, the admins). Text, pictures, video, audio, voice notes and files, replies,
 * reactions, pinned messages and unread counts, the way a Telegram group works.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
    private readonly access: AccessPolicy,
  ) {}

  /** The role of the viewer in this group, or 404 (a course that is not theirs looks like it is not there). */
  private async roleIn(viewer: SessionUser, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });
    const role = course ? await this.access.courseGroupRole(viewer, courseId) : null;
    // Students only chat in published courses; staff can reach drafts too.
    if (!course || !role || (role === 'STUDENT' && course.status !== 'PUBLISHED')) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return role;
  }

  // ── Lists and counts ──────────────────────────────────────────────────

  /** The course ids a person is in (admins: every course that is live or has talk). */
  private async courseIdsFor(viewer: SessionUser): Promise<string[]> {
    if (viewer.role === 'ADMIN') {
      const rows = await this.prisma.course.findMany({
        where: { OR: [{ status: 'PUBLISHED' }, { groupMessages: { some: {} } }] },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    }
    if (viewer.role === 'TEACHER') {
      const rows = await this.prisma.courseTeacher.findMany({
        where: { teacherId: viewer.id },
        select: { courseId: true },
      });
      return rows.map((r) => r.courseId);
    }
    const rows = await this.prisma.enrolment.findMany({
      where: {
        studentId: viewer.id,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        course: { status: 'PUBLISHED' },
        OR: [{ endAt: null }, { endAt: { gte: new Date() } }],
      },
      select: { courseId: true },
    });
    return [...new Set(rows.map((r) => r.courseId))];
  }

  private async unreadByCourse(viewerId: string, courseIds: string[]) {
    if (courseIds.length === 0) return new Map<string, number>();
    const rows = await this.prisma.$queryRaw<{ courseId: string; n: bigint }[]>`
      SELECT m."courseId", count(*) AS n
        FROM "GroupMessage" m
        JOIN "GroupRead" r ON r."courseId" = m."courseId" AND r."userId" = ${viewerId}
       WHERE m."courseId" = ANY(${courseIds})
         AND m."createdAt" > r."lastReadAt"
         AND m."senderId" <> ${viewerId}
         AND m."deletedAt" IS NULL
       GROUP BY m."courseId"`;
    return new Map(rows.map((r) => [r.courseId, Number(r.n)]));
  }

  /** The viewer's groups, busiest first. First time in a group, history counts as already read. */
  async list(viewer: SessionUser) {
    const ids = await this.courseIdsFor(viewer);
    if (ids.length === 0) return { items: [] };
    const reads = await this.prisma.groupRead.findMany({
      where: { userId: viewer.id, courseId: { in: ids } },
      select: { courseId: true },
    });
    const have = new Set(reads.map((r) => r.courseId));
    const missing = ids.filter((id) => !have.has(id));
    if (missing.length > 0) {
      await this.prisma.groupRead.createMany({
        data: missing.map((courseId) => ({ courseId, userId: viewer.id })),
        skipDuplicates: true,
      });
    }
    const [courses, unread, lasts] = await Promise.all([
      this.prisma.course.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          title: true,
          slug: true,
          imageFileId: true,
          language: { select: { name: true } },
        },
      }),
      this.unreadByCourse(viewer.id, ids),
      this.prisma.groupMessage.findMany({
        where: { courseId: { in: ids } },
        distinct: ['courseId'],
        orderBy: [{ courseId: 'asc' }, { createdAt: 'desc' }],
        select: {
          courseId: true,
          kind: true,
          body: true,
          createdAt: true,
          deletedAt: true,
          sender: { select: { fullName: true } },
          file: { select: { originalName: true } },
        },
      }),
    ]);
    const last = new Map(lasts.map((m) => [m.courseId, m]));
    const items = courses.map((c) => {
      const m = last.get(c.id);
      let lastMessageText: string | null = null;
      if (m) {
        const who = m.kind === 'SYSTEM' ? '' : `${m.sender.fullName.split(' ')[0]}: `;
        lastMessageText = m.deletedAt
          ? 'This message was deleted'
          : `${who}${preview(m.kind, m.body, m.file?.originalName)}`;
      }
      return {
        courseId: c.id,
        title: c.title,
        language: c.language.name,
        imageUrl: c.imageFileId ? `/api/v1/files/${c.imageFileId}` : null,
        lastMessageAt: m?.createdAt ?? null,
        lastMessageText,
        unread: unread.get(c.id) ?? 0,
      };
    });
    items.sort(
      (a, b) =>
        (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0) ||
        a.title.localeCompare(b.title),
    );
    return { items };
  }

  /** Unread messages across all of the viewer's groups (the menu badge). */
  async unreadCount(viewer: SessionUser): Promise<{ count: number }> {
    const ids = await this.courseIdsFor(viewer);
    const unread = await this.unreadByCourse(viewer.id, ids);
    let count = 0;
    for (const n of unread.values()) count += n;
    return { count };
  }

  // ── One group ─────────────────────────────────────────────────────────

  /** The group's header: the course, who is in it, and the pinned message. */
  async info(viewer: SessionUser, courseId: string) {
    const role = await this.roleIn(viewer, courseId);
    const [course, teachers, students, admins, pinned] = await Promise.all([
      this.prisma.course.findUniqueOrThrow({
        where: { id: courseId },
        select: { id: true, title: true, slug: true, imageFileId: true },
      }),
      this.prisma.courseTeacher.findMany({
        where: { courseId, teacher: { status: 'ACTIVE' } },
        select: { teacher: { select: PERSON } },
      }),
      this.prisma.enrolment.findMany({
        where: {
          courseId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          OR: [{ endAt: null }, { endAt: { gte: new Date() } }],
          student: { status: 'ACTIVE' },
        },
        distinct: ['studentId'],
        select: { student: { select: PERSON } },
      }),
      this.prisma.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: PERSON,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.groupMessage.findFirst({
        where: { courseId, pinnedAt: { not: null }, deletedAt: null },
        orderBy: { pinnedAt: 'desc' },
        select: { id: true, kind: true, body: true, file: { select: { originalName: true } } },
      }),
    ]);
    const person = (
      u: { id: string; fullName: string; photoFileId: string | null },
      as: 'ADMIN' | 'TEACHER' | 'STUDENT',
    ) => ({ id: u.id, name: u.fullName, role: as, avatarUrl: avatar(u.photoFileId) });
    const members = [
      ...teachers.map((t) => person(t.teacher, 'TEACHER')),
      ...admins.map((a) => person(a, 'ADMIN')),
      ...students.map((s) => person(s.student, 'STUDENT')),
    ];
    return {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        imageUrl: course.imageFileId ? `/api/v1/files/${course.imageFileId}` : null,
      },
      me: { role, canModerate: role !== 'STUDENT' },
      members,
      counts: {
        students: students.length,
        teachers: teachers.length,
        admins: admins.length,
        total: members.length,
      },
      pinned: pinned
        ? { id: pinned.id, text: preview(pinned.kind, pinned.body, pinned.file?.originalName) }
        : null,
    };
  }

  private reactionsOf(list: { emoji: string; userId: string }[], viewerId: string) {
    const by = new Map<string, { count: number; mine: boolean }>();
    for (const r of list) {
      const entry = by.get(r.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (r.userId === viewerId) entry.mine = true;
      by.set(r.emoji, entry);
    }
    return [...by.entries()].map(([emoji, v]) => ({ emoji, ...v }));
  }

  private view(viewer: SessionUser, rows: Row[]): GroupMessageView[] {
    return rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      body: m.deletedAt ? null : m.body,
      mine: m.senderId === viewer.id,
      deleted: m.deletedAt !== null,
      edited: m.editedAt !== null && m.deletedAt === null,
      pinned: m.pinnedAt !== null && m.deletedAt === null,
      createdAt: m.createdAt.toISOString(),
      sender: {
        id: m.sender.id,
        name: m.sender.fullName,
        role: m.sender.role as 'ADMIN' | 'TEACHER' | 'STUDENT',
        avatarUrl: avatar(m.sender.photoFileId),
      },
      durationSec: m.deletedAt ? null : m.durationSec,
      file:
        m.file && !m.deletedAt
          ? {
              url: `/api/v1/files/${m.file.id}`,
              name: m.file.originalName,
              mime: m.file.mime,
              sizeBytes: m.file.sizeBytes,
            }
          : null,
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            senderName: m.replyTo.sender.fullName,
            text: m.replyTo.deletedAt
              ? 'This message was deleted'
              : preview(m.replyTo.kind, m.replyTo.body, m.replyTo.file?.originalName),
          }
        : null,
      reactions: m.deletedAt ? [] : this.reactionsOf(m.reactions, viewer.id),
    }));
  }

  private query(where: object, take: number) {
    return this.prisma.groupMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        sender: { select: PERSON },
        file: { select: { id: true, originalName: true, mime: true, sizeBytes: true } },
        replyTo: {
          select: {
            id: true,
            kind: true,
            body: true,
            deletedAt: true,
            sender: { select: { fullName: true } },
            file: { select: { originalName: true } },
          },
        },
        reactions: { select: { emoji: true, userId: true } },
      },
    });
  }

  /** The newest messages (or the page before `before`), oldest first. */
  async messages(viewer: SessionUser, courseId: string, query: { before?: string; limit: number }) {
    await this.roleIn(viewer, courseId);
    let cursor: Date | undefined;
    if (query.before) {
      const anchor = await this.prisma.groupMessage.findFirst({
        where: { id: query.before, courseId },
        select: { createdAt: true },
      });
      if (!anchor) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      cursor = anchor.createdAt;
    }
    const rows = await this.query(
      { courseId, ...(cursor ? { createdAt: { lt: cursor } } : {}) },
      query.limit + 1,
    );
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit).reverse();
    return { hasMore, items: this.view(viewer, page) };
  }

  /** Marks the group read up to now. */
  async markRead(viewer: SessionUser, courseId: string): Promise<{ ok: true }> {
    await this.roleIn(viewer, courseId);
    await this.prisma.groupRead.upsert({
      where: { courseId_userId: { courseId, userId: viewer.id } },
      create: { courseId, userId: viewer.id },
      update: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  // ── Sending ───────────────────────────────────────────────────────────

  private tooLarge(size: number, max: number) {
    return new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, {
      message: `This file is ${bytesToMb(size)} MB. The maximum is ${bytesToMb(max)} MB.`,
      params: { size: bytesToMb(size), max: bytesToMb(max) },
    });
  }

  /** Reads the real type from the first bytes; pictures are re-encoded; stored privately. */
  private async storeAttachment(
    viewer: SessionUser,
    courseId: string,
    file: { buffer: Buffer; originalname: string },
    voice: boolean,
  ): Promise<{ id: string; kind: GroupMessageKind; name: string }> {
    const detected = detectFile(file.buffer);
    const original = displayName(file.originalname);
    const ext = original.split('.').pop()?.toLowerCase() ?? '';
    let bytes = file.buffer;
    let kind: GroupMessageKind;
    let mime: string;
    let extension: string;
    let name = original;
    const refused = () =>
      new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);

    if (voice) {
      if (file.buffer.length > VOICE_LIMIT) throw this.tooLarge(file.buffer.length, VOICE_LIMIT);
      // Browsers record voice as WebM or MP4; their headers read as "video".
      if (!detected || (detected.kind !== 'audio' && detected.kind !== 'video')) throw refused();
      kind = 'VOICE';
      mime = detected.mime.replace('video/', 'audio/');
      extension = detected.ext;
      name = `Voice message.${extension}`;
    } else if (detected?.kind === 'video') {
      if (file.buffer.length > VIDEO_LIMIT) throw this.tooLarge(file.buffer.length, VIDEO_LIMIT);
      kind = 'VIDEO';
      mime = detected.mime;
      extension = detected.ext;
    } else {
      if (file.buffer.length > FILE_LIMIT) throw this.tooLarge(file.buffer.length, FILE_LIMIT);
      if (detected?.kind === 'image') {
        kind = 'IMAGE';
        bytes = await this.images.toLessonImage(file.buffer, FILE_LIMIT);
        mime = 'image/webp';
        extension = 'webp';
        name = original.replace(/\.[^.]+$/, '') + '.webp';
      } else if (detected?.kind === 'audio') {
        kind = 'AUDIO';
        mime = detected.mime;
        extension = detected.ext;
      } else if (detected?.kind === 'pdf') {
        kind = 'FILE';
        mime = detected.mime;
        extension = detected.ext;
      } else if (detected?.kind === 'document') {
        kind = 'FILE';
        const old = detected.ext === 'ole';
        extension = old ? ext : detected.ext;
        mime = old ? (OFFICE[ext] ?? '') : detected.mime;
        if (!mime) throw refused();
      } else {
        throw refused();
      }
    }

    const key = `groups/${courseId}/${createId()}.${extension}`;
    await this.storage.put(key, bytes, mime);
    const asset = await this.prisma.fileAsset.create({
      data: {
        purpose: 'CHAT_ATTACHMENT',
        storageKey: key,
        mime,
        sizeBytes: bytes.length,
        originalName: name,
        uploadedById: viewer.id,
      },
    });
    return { id: asset.id, kind, name };
  }

  async send(
    viewer: SessionUser,
    courseId: string,
    input: { body?: string; replyToId?: string; voice?: boolean; durationSec?: number },
    file?: { buffer: Buffer; originalname: string },
  ): Promise<GroupMessageView> {
    await this.roleIn(viewer, courseId);
    const body = input.body?.trim().slice(0, MAX_TEXT) || null;
    if (!body && !file) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const recent = await this.prisma.groupMessage.count({
      where: { senderId: viewer.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 40) throw new AppException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);

    if (input.replyToId) {
      const target = await this.prisma.groupMessage.findFirst({
        where: { id: input.replyToId, courseId },
        select: { id: true },
      });
      if (!target) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    let kind: GroupMessageKind = 'TEXT';
    let fileId: string | null = null;
    let durationSec: number | null = null;
    if (file) {
      const stored = await this.storeAttachment(viewer, courseId, file, input.voice === true);
      kind = stored.kind;
      fileId = stored.id;
      if (kind === 'VOICE') {
        durationSec = Math.min(900, Math.max(1, Math.round(input.durationSec ?? 1)));
      }
    }
    const created = await this.prisma.groupMessage.create({
      data: {
        courseId,
        senderId: viewer.id,
        kind,
        body,
        fileId,
        durationSec,
        replyToId: input.replyToId ?? null,
      },
      select: { id: true },
    });
    // Sending means you have read everything up to now.
    await this.markRead(viewer, courseId);
    const [row] = await this.query({ id: created.id }, 1);
    return this.view(viewer, [row!])[0]!;
  }

  /** The platform announces something in the group, for example a new session. */
  async announce(courseId: string, senderId: string, text: string): Promise<void> {
    await this.prisma.groupMessage.create({
      data: { courseId, senderId, kind: 'SYSTEM', body: text.slice(0, MAX_TEXT) },
    });
  }

  // ── Changing a message ────────────────────────────────────────────────

  private async ownedMessage(viewer: SessionUser, messageId: string) {
    const message = await this.prisma.groupMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        courseId: true,
        senderId: true,
        kind: true,
        createdAt: true,
        deletedAt: true,
        fileId: true,
      },
    });
    if (!message) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const role = await this.roleIn(viewer, message.courseId);
    return { message, role };
  }

  async edit(viewer: SessionUser, messageId: string, body: string): Promise<GroupMessageView> {
    const { message } = await this.ownedMessage(viewer, messageId);
    if (message.senderId !== viewer.id || message.deletedAt || message.kind === 'SYSTEM') {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'Messages can be edited for 2 days after they are sent.',
      });
    }
    await this.prisma.groupMessage.update({
      where: { id: messageId },
      data: { body: body.trim().slice(0, MAX_TEXT), editedAt: new Date() },
    });
    const [row] = await this.query({ id: messageId }, 1);
    return this.view(viewer, [row!])[0]!;
  }

  /** People delete their own messages; teachers and admins can delete anyone's (moderation). */
  async remove(viewer: SessionUser, messageId: string): Promise<{ ok: true }> {
    const { message, role } = await this.ownedMessage(viewer, messageId);
    if (message.deletedAt) return { ok: true };
    if (message.senderId !== viewer.id && role === 'STUDENT') {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    await this.prisma.groupMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: null, pinnedAt: null, fileId: null },
    });
    if (message.fileId) {
      const file = await this.prisma.fileAsset.findUnique({ where: { id: message.fileId } });
      if (file) {
        await this.prisma.fileAsset.delete({ where: { id: file.id } }).catch(() => undefined);
        await this.storage.remove(file.storageKey).catch(() => undefined);
      }
    }
    return { ok: true };
  }

  async pin(viewer: SessionUser, messageId: string, pinned: boolean): Promise<{ ok: true }> {
    const { message, role } = await this.ownedMessage(viewer, messageId);
    if (role === 'STUDENT' || message.deletedAt) {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    await this.prisma.groupMessage.update({
      where: { id: messageId },
      data: { pinnedAt: pinned ? new Date() : null },
    });
    return { ok: true };
  }

  /** Reacting again with the same emoji takes the reaction back. */
  async react(viewer: SessionUser, messageId: string, emoji: string) {
    const { message } = await this.ownedMessage(viewer, messageId);
    if (message.deletedAt) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    const key = { messageId_userId_emoji: { messageId, userId: viewer.id, emoji } };
    const existing = await this.prisma.groupReaction.findUnique({ where: key });
    if (existing) await this.prisma.groupReaction.delete({ where: key });
    else await this.prisma.groupReaction.create({ data: { messageId, userId: viewer.id, emoji } });
    const list = await this.prisma.groupReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });
    return { reactions: this.reactionsOf(list, viewer.id) };
  }
}
