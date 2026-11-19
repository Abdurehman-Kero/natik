import { HttpStatus, Injectable } from '@nestjs/common';
import { bytesToMb } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { createId } from '../../common/security/ids';
import { ImageService } from '../../common/storage/image.service';
import { StorageService } from '../../common/storage/storage.service';
import type { ChatMessageKind, ConversationKind } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';
import { detectFile } from '../content/file-types';
import { displayName } from '../content/uploads.service';
import { canOpenConversation } from './chat-access';

const MB = 1024 * 1024;
const FILE_LIMIT = 20 * MB;
const VOICE_LIMIT = 10 * MB;
const MAX_VOICE_SECONDS = 15 * 60;
const MAX_TEXT = 2000;
/** Enrolments that still make a student and a course's teacher able to chat. */
const CHAT_ENROLMENTS = ['ACTIVE', 'COMPLETED', 'EXPIRED'] as const;

const OFFICE: Record<string, { mime: string; magic: 'zip' | 'ole' }> = {
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    magic: 'zip',
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    magic: 'zip',
  },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    magic: 'zip',
  },
  doc: { mime: 'application/msword', magic: 'ole' },
  xls: { mime: 'application/vnd.ms-excel', magic: 'ole' },
  ppt: { mime: 'application/vnd.ms-powerpoint', magic: 'ole' },
};

export interface ChatFileView {
  url: string;
  name: string;
  mime: string;
  sizeBytes: number;
}
export interface ChatMessageView {
  id: string;
  kind: ChatMessageKind;
  body: string | null;
  mine: boolean;
  senderName: string;
  createdAt: string;
  durationSec: number | null;
  file: ChatFileView | null;
}

const PERSON = { id: true, fullName: true, role: true, photoFileId: true } as const;

function preview(kind: ChatMessageKind, body: string | null, name?: string): string {
  if (kind === 'IMAGE') return body ? `Photo: ${body}` : 'Photo';
  if (kind === 'VOICE') return 'Voice message';
  if (kind === 'FILE') return name ? `File: ${name}` : 'File';
  return (body ?? '').slice(0, 120);
}

const avatar = (photoFileId: string | null) =>
  photoFileId ? `/api/v1/files/${photoFileId}` : null;
const roleLabel = (role: string) => (role === 'TEACHER' ? 'Teacher' : 'Student');

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  /** Unread messages per conversation (admins share one read marker, as the Natik team). */
  private async unreadByConversation(viewer: SessionUser): Promise<Map<string, number>> {
    const rows =
      viewer.role === 'ADMIN'
        ? await this.prisma.$queryRaw<{ id: string; n: number }[]>`
            SELECT c.id, count(*)::int AS n FROM "ChatMessage" m
            JOIN "Conversation" c ON c.id = m."conversationId"
            WHERE c.kind IN ('STUDENT_ADMIN', 'TEACHER_ADMIN') AND m."fromAdmin" = false
              AND m."createdAt" > c."adminReadAt"
              AND (c."adminClearedAt" IS NULL OR m."createdAt" > c."adminClearedAt")
            GROUP BY c.id`
        : await this.prisma.$queryRaw<{ id: string; n: number }[]>`
            SELECT c.id, count(*)::int AS n FROM "ChatMessage" m
            JOIN "Conversation" c ON c.id = m."conversationId"
            WHERE m."senderId" <> ${viewer.id}
              AND ((c."ownerId" = ${viewer.id} AND m."createdAt" > c."ownerReadAt"
                    AND (c."ownerClearedAt" IS NULL OR m."createdAt" > c."ownerClearedAt"))
                OR (c."peerId" = ${viewer.id} AND m."createdAt" > c."peerReadAt"
                    AND (c."peerClearedAt" IS NULL OR m."createdAt" > c."peerClearedAt")))
            GROUP BY c.id`;
    return new Map(rows.map((r) => [r.id, r.n]));
  }

  async unreadCount(viewer: SessionUser): Promise<number> {
    let total = 0;
    for (const n of (await this.unreadByConversation(viewer)).values()) total += n;
    return total;
  }

  /** When this viewer last cleared the chat (older messages are hidden for them only). */
  private clearedAt(
    viewer: SessionUser,
    c: {
      ownerId: string;
      ownerClearedAt: Date | null;
      peerClearedAt: Date | null;
      adminClearedAt: Date | null;
    },
  ): Date | null {
    if (viewer.role === 'ADMIN') return c.adminClearedAt;
    return c.ownerId === viewer.id ? c.ownerClearedAt : c.peerClearedAt;
  }

  /** The person shown as "the other side" of a chat, or null when the other side is the Natik team. */
  private counterpart<
    T extends { ownerId: string; kind: ConversationKind; owner: P; peer: P | null },
    P extends { id: string; fullName: string; role: string; photoFileId: string | null },
  >(viewer: SessionUser, c: T): P | null {
    if (viewer.role === 'ADMIN' || c.ownerId !== viewer.id) return c.owner;
    return c.kind === 'STUDENT_TEACHER' ? c.peer : null;
  }

  async list(viewer: SessionUser) {
    const where =
      viewer.role === 'ADMIN'
        ? { kind: { in: ['STUDENT_ADMIN', 'TEACHER_ADMIN'] as ConversationKind[] } }
        : { OR: [{ ownerId: viewer.id }, { peerId: viewer.id }] };
    const [rows, unread] = await Promise.all([
      this.prisma.conversation.findMany({
        where: { ...where, lastMessageText: { not: null } },
        orderBy: { lastMessageAt: 'desc' },
        take: 100,
        include: { owner: { select: PERSON }, peer: { select: PERSON } },
      }),
      this.unreadByConversation(viewer),
    ]);
    return {
      items: rows
        .filter((c) => {
          const cleared = this.clearedAt(viewer, c);
          return !cleared || c.lastMessageAt > cleared;
        })
        .map((c) => {
          const other = this.counterpart(viewer, c);
          return {
            id: c.id,
            kind: c.kind,
            personId: other ? other.id : null,
            title: other ? other.fullName : 'Natik team',
            subtitle: other ? roleLabel(other.role) : 'Natik Language Centre',
            avatarUrl: other ? avatar(other.photoFileId) : null,
            team: !other,
            lastMessageText: c.lastMessageText,
            lastMessageAt: c.lastMessageAt.toISOString(),
            unread: unread.get(c.id) ?? 0,
          };
        }),
    };
  }

  /** People this viewer can start a chat with. Admins search; everyone else sees a short list. */
  async contacts(viewer: SessionUser, q: string) {
    const term = q.trim();
    const matches = term ? { fullName: { contains: term, mode: 'insensitive' as const } } : {};
    const view = (u: {
      id: string;
      fullName: string;
      role: string;
      photoFileId: string | null;
    }) => ({
      id: u.id,
      name: u.fullName,
      subtitle: roleLabel(u.role),
      avatarUrl: avatar(u.photoFileId),
    });

    if (viewer.role === 'ADMIN') {
      if (term.length < 2) return { items: [] };
      const users = await this.prisma.user.findMany({
        where: { role: { in: ['STUDENT', 'TEACHER'] }, status: 'ACTIVE', ...matches },
        orderBy: { fullName: 'asc' },
        take: 20,
        select: PERSON,
      });
      return { items: users.map(view) };
    }

    const studentSide =
      viewer.role === 'STUDENT'
        ? {
            role: 'TEACHER' as const,
            teachingCourses: {
              some: {
                course: {
                  enrolments: {
                    some: { studentId: viewer.id, status: { in: [...CHAT_ENROLMENTS] } },
                  },
                },
              },
            },
          }
        : {
            role: 'STUDENT' as const,
            enrolments: {
              some: {
                status: { in: [...CHAT_ENROLMENTS] },
                course: { teachers: { some: { teacherId: viewer.id } } },
              },
            },
          };
    const people = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', ...matches, ...studentSide },
      orderBy: { fullName: 'asc' },
      take: 30,
      select: PERSON,
    });
    const team = {
      id: 'TEAM',
      name: 'Natik team',
      subtitle: 'Natik Language Centre',
      avatarUrl: null,
    };
    return { items: term ? people.map(view) : [team, ...people.map(view)] };
  }

  /** Finds the chat with this person (or the team), creating it the first time. */
  async open(viewer: SessionUser, withId: string): Promise<{ id: string }> {
    let kind: ConversationKind;
    let ownerId: string;
    let peerId: string | null = null;

    if (withId === 'TEAM') {
      if (viewer.role === 'ADMIN') {
        throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);
      }
      kind = viewer.role === 'STUDENT' ? 'STUDENT_ADMIN' : 'TEACHER_ADMIN';
      ownerId = viewer.id;
    } else {
      const other = await this.prisma.user.findUnique({
        where: { id: withId },
        select: { id: true, role: true, status: true },
      });
      if (!other || other.status !== 'ACTIVE' || other.id === viewer.id) {
        throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
      }
      if (viewer.role === 'ADMIN') {
        if (other.role === 'STUDENT') kind = 'STUDENT_ADMIN';
        else if (other.role === 'TEACHER') kind = 'TEACHER_ADMIN';
        else throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
        ownerId = other.id;
      } else {
        const pairOk =
          (viewer.role === 'STUDENT' && other.role === 'TEACHER') ||
          (viewer.role === 'TEACHER' && other.role === 'STUDENT');
        if (!pairOk) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
        const studentId = viewer.role === 'STUDENT' ? viewer.id : other.id;
        const teacherId = viewer.role === 'TEACHER' ? viewer.id : other.id;
        const related = await this.prisma.enrolment.findFirst({
          where: {
            studentId,
            status: { in: [...CHAT_ENROLMENTS] },
            course: { teachers: { some: { teacherId } } },
          },
          select: { id: true },
        });
        if (!related) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
        kind = 'STUDENT_TEACHER';
        ownerId = studentId;
        peerId = teacherId;
      }
    }

    const find = () =>
      this.prisma.conversation.findFirst({
        where: { kind, ownerId, peerId },
        select: { id: true },
      });
    const existing = await find();
    if (existing) return existing;
    try {
      return await this.prisma.conversation.create({
        data: { kind, ownerId, peerId },
        select: { id: true },
      });
    } catch (error) {
      // Two taps at once: the other request created it first.
      const again = await find();
      if (again) return again;
      throw error;
    }
  }

  private async load(viewer: SessionUser, id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: { owner: { select: PERSON }, peer: { select: PERSON } },
    });
    // Someone else's chat looks exactly like a chat that does not exist.
    if (!conversation || !canOpenConversation(viewer, conversation)) {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return conversation;
  }

  private view(
    row: {
      id: string;
      kind: ChatMessageKind;
      body: string | null;
      senderId: string;
      fromAdmin: boolean;
      createdAt: Date;
      durationSec: number | null;
      sender: { fullName: string };
      file: { id: string; originalName: string; mime: string; sizeBytes: number } | null;
    },
    viewer: SessionUser,
  ): ChatMessageView {
    const isAdmin = viewer.role === 'ADMIN';
    return {
      id: row.id,
      kind: row.kind,
      body: row.body,
      mine: isAdmin ? row.fromAdmin : row.senderId === viewer.id,
      senderName: row.fromAdmin && !isAdmin ? 'Natik team' : row.sender.fullName,
      createdAt: row.createdAt.toISOString(),
      durationSec: row.durationSec,
      file: row.file
        ? {
            url: `/api/v1/files/${row.file.id}`,
            name: row.file.originalName,
            mime: row.file.mime,
            sizeBytes: row.file.sizeBytes,
          }
        : null,
    };
  }

  /** The latest 80 messages, or only the ones after `after` when polling for new ones. */
  async messages(viewer: SessionUser, id: string, after?: string) {
    const conversation = await this.load(viewer, id);
    let since: Date | undefined;
    if (after) {
      const marker = await this.prisma.chatMessage.findFirst({
        where: { id: after, conversationId: id },
        select: { createdAt: true },
      });
      since = marker?.createdAt;
    }
    const cleared = this.clearedAt(viewer, conversation);
    const rows = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: id,
        ...(since || cleared
          ? {
              createdAt: {
                ...(since ? { gt: since } : {}),
                ...(cleared ? { gt: since && since > cleared ? since : cleared } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: since ? 'asc' : 'desc' },
      take: 80,
      include: {
        sender: { select: { fullName: true } },
        file: { select: { id: true, originalName: true, mime: true, sizeBytes: true } },
      },
    });
    if (!since) rows.reverse();

    const other = this.counterpart(viewer, conversation);
    const viewerIsOwner = conversation.ownerId === viewer.id && viewer.role !== 'ADMIN';
    // When the other side last opened the chat, for the "seen" ticks.
    const seenAt = !viewerIsOwner
      ? conversation.ownerReadAt
      : conversation.kind === 'STUDENT_TEACHER'
        ? conversation.peerReadAt
        : conversation.adminReadAt;
    return {
      conversation: {
        id: conversation.id,
        personId: other ? other.id : null,
        title: other ? other.fullName : 'Natik team',
        subtitle: other ? roleLabel(other.role) : 'Natik Language Centre',
        avatarUrl: other ? avatar(other.photoFileId) : null,
        team: !other,
      },
      seenAt: seenAt.toISOString(),
      revision: conversation.revision,
      items: rows.map((r) => this.view(r, viewer)),
    };
  }

  async markRead(viewer: SessionUser, id: string): Promise<void> {
    const conversation = await this.load(viewer, id);
    const field =
      viewer.role === 'ADMIN'
        ? 'adminReadAt'
        : conversation.ownerId === viewer.id
          ? 'ownerReadAt'
          : 'peerReadAt';
    await this.prisma.conversation.update({ where: { id }, data: { [field]: new Date() } });
  }

  /** "Clear history" and "Delete chat": hides what is there now for this side only. */
  async clear(viewer: SessionUser, id: string): Promise<void> {
    const conversation = await this.load(viewer, id);
    const field =
      viewer.role === 'ADMIN'
        ? 'adminClearedAt'
        : conversation.ownerId === viewer.id
          ? 'ownerClearedAt'
          : 'peerClearedAt';
    const now = new Date();
    // The viewer has also read everything that is now hidden.
    const read =
      viewer.role === 'ADMIN'
        ? 'adminReadAt'
        : conversation.ownerId === viewer.id
          ? 'ownerReadAt'
          : 'peerReadAt';
    await this.prisma.conversation.update({
      where: { id },
      data: { [field]: now, [read]: now, revision: { increment: 1 } },
    });
  }

  /**
   * Deletes one message for everyone, with its file. You can delete your own messages; admins can delete
   * what the Natik team wrote, whichever admin wrote it.
   */
  async deleteMessage(viewer: SessionUser, messageId: string): Promise<void> {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { file: { select: { id: true, storageKey: true } } },
    });
    if (!message) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const conversation = await this.load(viewer, message.conversationId);
    const mine = viewer.role === 'ADMIN' ? message.fromAdmin : message.senderId === viewer.id;
    if (!mine) throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);

    await this.prisma.chatMessage.delete({ where: { id: messageId } });
    if (message.file) {
      await this.prisma.fileAsset.delete({ where: { id: message.file.id } }).catch(() => undefined);
      await this.storage.remove(message.file.storageKey).catch(() => undefined);
    }
    // The chat list shows the newest message that is left.
    const latest = await this.prisma.chatMessage.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      include: { file: { select: { originalName: true } } },
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageText: latest
          ? preview(latest.kind, latest.body, latest.file?.originalName)
          : null,
        ...(latest ? { lastMessageAt: latest.createdAt } : {}),
        revision: { increment: 1 },
      },
    });
  }

  /** Reads the real type from the first bytes, re-encodes pictures, and stores the file privately. */
  private async storeAttachment(
    viewer: SessionUser,
    conversationId: string,
    file: { buffer: Buffer; originalname: string },
    voice: boolean,
  ): Promise<{ id: string; kind: ChatMessageKind; name: string }> {
    const limit = voice ? VOICE_LIMIT : FILE_LIMIT;
    if (file.buffer.length > limit) {
      throw new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, {
        message: `This file is ${bytesToMb(file.buffer.length)} MB. The maximum is ${bytesToMb(limit)} MB.`,
        params: { size: bytesToMb(file.buffer.length), max: bytesToMb(limit) },
      });
    }
    const detected = detectFile(file.buffer);
    const original = displayName(file.originalname);
    const ext = original.split('.').pop()?.toLowerCase() ?? '';
    let bytes = file.buffer;
    let kind: ChatMessageKind;
    let mime: string;
    let extension: string;
    let name = original;

    if (voice) {
      // Browsers record voice as WebM (Chrome, Firefox) or MP4 (Safari); their headers read as "video".
      if (!detected || (detected.kind !== 'audio' && detected.kind !== 'video')) {
        throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      }
      kind = 'VOICE';
      mime = detected.mime.replace('video/', 'audio/');
      extension = detected.ext;
      name = `Voice message.${extension}`;
    } else if (detected?.kind === 'image') {
      kind = 'IMAGE';
      bytes = await this.images.toLessonImage(file.buffer, FILE_LIMIT);
      mime = 'image/webp';
      extension = 'webp';
      name = original.replace(/\.[^.]+$/, '') + '.webp';
    } else if (detected) {
      kind = 'FILE';
      mime = detected.mime;
      extension = detected.ext;
    } else {
      const office = OFFICE[ext];
      const b = file.buffer;
      const magicOk =
        !!office &&
        (office.magic === 'zip'
          ? b[0] === 0x50 && b[1] === 0x4b
          : b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0);
      if (!office || !magicOk) {
        throw new AppException('FILE_TYPE_NOT_ALLOWED', HttpStatus.UNSUPPORTED_MEDIA_TYPE);
      }
      kind = 'FILE';
      mime = office.mime;
      extension = ext;
    }

    const key = `chat/${conversationId}/${createId()}.${extension}`;
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
    id: string,
    input: { body?: string; voice?: boolean; durationSec?: number },
    file?: { buffer: Buffer; originalname: string },
  ): Promise<ChatMessageView> {
    const conversation = await this.load(viewer, id);
    const body = input.body?.trim().slice(0, MAX_TEXT) || null;
    if (!body && !file) throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST);

    const recent = await this.prisma.chatMessage.count({
      where: { senderId: viewer.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent >= 40) throw new AppException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);

    let kind: ChatMessageKind = 'TEXT';
    let fileId: string | null = null;
    let fileName: string | undefined;
    let durationSec: number | null = null;
    if (file) {
      const stored = await this.storeAttachment(viewer, id, file, input.voice === true);
      kind = stored.kind;
      fileId = stored.id;
      fileName = stored.name;
      if (kind === 'VOICE') {
        durationSec = Math.min(MAX_VOICE_SECONDS, Math.max(1, Math.round(input.durationSec ?? 1)));
      }
    }

    const now = new Date();
    const isAdmin = viewer.role === 'ADMIN';
    const mineField = isAdmin
      ? 'adminReadAt'
      : conversation.ownerId === viewer.id
        ? 'ownerReadAt'
        : 'peerReadAt';
    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: {
          conversationId: id,
          senderId: viewer.id,
          fromAdmin: isAdmin,
          kind,
          body,
          fileId,
          durationSec,
          createdAt: now,
        },
        include: {
          sender: { select: { fullName: true } },
          file: { select: { id: true, originalName: true, mime: true, sizeBytes: true } },
        },
      }),
      this.prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: now,
          lastMessageText: preview(kind, body, fileName),
          [mineField]: now,
        },
      }),
    ]);
    return this.view(message, viewer);
  }
}
