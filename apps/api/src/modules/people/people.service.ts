import { HttpStatus, Injectable } from '@nestjs/common';
import { formatPhone } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { SessionUser } from '../auth/decorators';

/** Enrolments that put a student inside a course (and its group chat). */
const IN_COURSE = ['ACTIVE', 'COMPLETED'] as const;
/** Enrolments that still let a student and one of the course's teachers write to each other. */
const CAN_CHAT = ['ACTIVE', 'COMPLETED', 'EXPIRED'] as const;

/** A course the person takes part in, either as its teacher or as an accepted student. */
function takesPart(userId: string): Prisma.CourseWhereInput {
  const now = new Date();
  return {
    OR: [
      { teachers: { some: { teacherId: userId } } },
      {
        enrolments: {
          some: {
            studentId: userId,
            status: { in: [...IN_COURSE] },
            OR: [{ endAt: null }, { endAt: { gte: now } }],
          },
        },
      },
    ],
  };
}

const avatar = (photoFileId: string | null) =>
  photoFileId ? `/api/v1/files/${photoFileId}` : null;

/**
 * The profile card you see when you tap a person in a chat or a course group (like Telegram). You may
 * open it only for someone you really share something with: a chat, or a course. Anyone else looks
 * exactly like a person who does not exist, so ids cannot be used to look people up.
 */
@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async card(viewer: SessionUser, id: string) {
    const person = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        role: true,
        status: true,
        photoFileId: true,
        bio: true,
        phone: true,
        email: true,
        country: true,
        city: true,
        createdAt: true,
      },
    });
    const notFound = () => new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    if (!person) throw notFound();
    const isMe = person.id === viewer.id;
    const staffViewer = viewer.role === 'ADMIN';
    if (person.status !== 'ACTIVE' && !staffViewer) throw notFound();

    const shared = await this.prisma.course.findMany({
      where: {
        AND: [takesPart(viewer.id), takesPart(person.id)],
        ...(staffViewer ? {} : { status: 'PUBLISHED' as const }),
      },
      select: { id: true, title: true, slug: true },
      orderBy: { title: 'asc' },
      take: 6,
    });
    const talked =
      shared.length === 0 && !isMe && !staffViewer && person.role !== 'ADMIN'
        ? await this.prisma.conversation.findFirst({
            where: {
              OR: [
                { ownerId: viewer.id, peerId: person.id },
                { ownerId: person.id, peerId: viewer.id },
              ],
            },
            select: { id: true },
          })
        : null;
    // The Natik team (admins) can be seen by everyone who is signed in.
    const allowed =
      isMe || staffViewer || person.role === 'ADMIN' || shared.length > 0 || talked !== null;
    if (!allowed) throw notFound();

    const teaches =
      person.role === 'TEACHER'
        ? await this.prisma.course.findMany({
            where: { status: 'PUBLISHED', teachers: { some: { teacherId: person.id } } },
            select: { title: true, slug: true, language: { select: { name: true } } },
            orderBy: { title: 'asc' },
            take: 8,
          })
        : [];

    return {
      id: person.id,
      name: person.fullName,
      role: person.role,
      avatarUrl: avatar(person.photoFileId),
      isMe,
      bio: person.role === 'STUDENT' ? null : person.bio,
      memberSince: person.createdAt.toISOString(),
      teaches: teaches.map((c) => ({
        title: c.title,
        slug: c.slug,
        language: c.language.name,
      })),
      sharedCourses: shared,
      // Where a student is from: teachers and the team can see it, other students cannot.
      location:
        viewer.role !== 'STUDENT' && (person.country || person.city)
          ? { country: person.country, city: person.city }
          : null,
      // Phone and email: only the Natik team.
      contact: staffViewer
        ? { phone: person.phone ? formatPhone(person.phone) : null, email: person.email }
        : null,
      messageWith: isMe ? null : await this.messageWith(viewer, person),
    };
  }

  /** What to pass to "open a chat" to write to this person, or null when the rules do not allow it. */
  private async messageWith(
    viewer: SessionUser,
    person: { id: string; role: string; status: string },
  ): Promise<string | null> {
    if (person.status !== 'ACTIVE') return null;
    if (viewer.role === 'ADMIN') {
      return person.role === 'STUDENT' || person.role === 'TEACHER' ? person.id : null;
    }
    if (person.role === 'ADMIN') return 'TEAM';
    if (viewer.role === person.role) return null;
    const studentId = viewer.role === 'STUDENT' ? viewer.id : person.id;
    const teacherId = viewer.role === 'TEACHER' ? viewer.id : person.id;
    const related = await this.prisma.enrolment.findFirst({
      where: {
        studentId,
        status: { in: [...CAN_CHAT] },
        course: { teachers: { some: { teacherId } } },
      },
      select: { id: true },
    });
    return related ? person.id : null;
  }
}
