import { HttpStatus, Injectable } from '@nestjs/common';
import { CERTIFICATE_NUMBER, type ContactInput, normalizePhone } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { RateLimiter } from '../../common/security/rate-limiter';
import { PrismaService } from '../../prisma/prisma.service';

/** Forms filled in faster than this are bots. */
const MIN_FILL_MS = 3000;
const MAX_FILL_MS = 24 * 60 * 60_000;

/** Plain text from Tiptap/ProseMirror JSON (announcement previews). */
function plainText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { text?: string; content?: unknown[] };
  const own = typeof n.text === 'string' ? n.text : '';
  const children = Array.isArray(n.content) ? n.content.map(plainText).join(' ') : '';
  return `${own} ${children}`.replace(/\s+/g, ' ').trim();
}

@Injectable()
export class PublicSiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: RateLimiter,
  ) {}

  /**
   * Stores a contact message for the admin inbox. Bots (hidden field filled, or sent instantly)
   * get the same "thanks" without anything being stored.
   */
  async contact(input: ContactInput, ip: string | null): Promise<void> {
    await this.limiter.assert(`contact-ip:${ip}`, 5, 3600);
    const elapsed = input.openedAt ? Date.now() - input.openedAt : null;
    const looksLikeBot =
      Boolean(input.website) ||
      (elapsed !== null && (elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS));
    if (looksLikeBot) return;

    await this.prisma.inboxMessage.create({
      data: {
        type: 'CONTACT',
        name: input.name.trim(),
        phone: normalizePhone(input.phone),
        message: input.message.trim(),
      },
    });
  }

  /** Teachers who chose to appear on the About page. */
  async teachers() {
    const rows = await this.prisma.user.findMany({
      where: { role: 'TEACHER', status: 'ACTIVE', showOnWebsite: true },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, bio: true, photoFileId: true },
    });
    return {
      items: rows.map((t) => ({
        id: t.id,
        name: t.fullName,
        bio: t.bio,
        photoUrl: t.photoFileId ? `/api/v1/files/${t.photoFileId}` : null,
      })),
    };
  }

  /** Public announcements, newest first (FR-NOTIF-001). */
  async announcements(limit: number) {
    const rows = await this.prisma.announcement.findMany({
      where: { audience: 'PUBLIC', publishAt: { lte: new Date() } },
      orderBy: { publishAt: 'desc' },
      take: limit,
      select: { id: true, title: true, body: true, publishAt: true },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        text: plainText(row.body).slice(0, 600),
        publishedAt: row.publishAt,
      })),
    };
  }

  /** Shows only name, course and date for a valid number (FR-CERT-004). Rate-limited against guessing. */
  async verifyCertificate(number: string, ip: string | null) {
    await this.limiter.assert(`verify-cert-ip:${ip}`, 30, 3600);
    const normalized = number.trim().toUpperCase();
    if (!CERTIFICATE_NUMBER.test(normalized))
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const certificate = await this.prisma.certificate.findUnique({ where: { number: normalized } });
    if (!certificate) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (certificate.status === 'CANCELLED')
      return { status: 'CANCELLED' as const, number: normalized };
    return {
      status: 'VALID' as const,
      number: normalized,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      issuedAt: certificate.issuedAt,
    };
  }
}
