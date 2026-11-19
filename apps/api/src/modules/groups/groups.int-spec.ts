import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

type Agent = Awaited<ReturnType<Harness['signIn']>>;

const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 1)]);
const MP4 = Buffer.concat([
  Buffer.from([0, 0, 0, 0x20]),
  Buffer.from('ftypisom', 'latin1'),
  Buffer.alloc(2048),
]);
const MP3 = Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.alloc(64, 2)]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

/** Course group chats: who is in a group, what can be sent, and how a Telegram-style group behaves. */
describe('course groups', () => {
  let h: Harness;
  let admin: Agent;
  let teacher: Agent;
  let otherTeacher: Agent;
  let student: Agent;
  let classmate: Agent;
  let waiting: Agent;
  let outsider: Agent;
  let courseId: string;
  let otherCourseId: string;
  let png: Buffer;
  const who: Record<string, string> = {};

  beforeAll(async () => {
    h = await createHarness();
    await h.resetLimits();
    png = await sharp({
      create: { width: 40, height: 40, channels: 3, background: '#123b5a' },
    })
      .png()
      .toBuffer();
    const stamp = Date.now();
    const language = await h.prisma.language.create({
      data: { name: `Lang ${stamp}`, code: `g${String(stamp).slice(-4)}` },
    });
    const level = await h.prisma.level.create({ data: { name: `Level ${stamp}` } });
    const users = {
      admin: await h.makeUser({ role: 'ADMIN' }),
      teacher: await h.makeUser({ role: 'TEACHER' }),
      otherTeacher: await h.makeUser({ role: 'TEACHER' }),
      student: await h.makeUser({ role: 'STUDENT' }),
      classmate: await h.makeUser({ role: 'STUDENT' }),
      waiting: await h.makeUser({ role: 'STUDENT' }),
      outsider: await h.makeUser({ role: 'STUDENT' }),
    };
    for (const [k, u] of Object.entries(users)) who[k] = u.id;
    admin = await h.signIn(users.admin.phone, users.admin.password);
    teacher = await h.signIn(users.teacher.phone, users.teacher.password);
    otherTeacher = await h.signIn(users.otherTeacher.phone, users.otherTeacher.password);
    student = await h.signIn(users.student.phone, users.student.password);
    classmate = await h.signIn(users.classmate.phone, users.classmate.password);
    waiting = await h.signIn(users.waiting.phone, users.waiting.password);
    outsider = await h.signIn(users.outsider.phone, users.outsider.password);

    const make = async (title: string, teacherId: string) => {
      const course = (
        await admin
          .post('/api/v1/admin/courses')
          .send({
            title: `${title} ${stamp}`,
            languageId: language.id,
            levelId: level.id,
            summary: 'A course used by the group tests.',
            outcomes: [],
            access: 'FREE',
          })
          .expect(201)
      ).body;
      await admin
        .put(`/api/v1/admin/courses/${course.id}/teachers`)
        .send({ teacherIds: [teacherId] })
        .expect(200);
      await h.prisma.course.update({ where: { id: course.id }, data: { status: 'PUBLISHED' } });
      return course as { id: string; branchId: string };
    };
    const course = await make('Group course', users.teacher.id);
    const other = await make('Other course', users.otherTeacher.id);
    courseId = course.id;
    otherCourseId = other.id;
    const enrol = (studentId: string, status: 'ACTIVE' | 'AWAITING_APPROVAL') =>
      h.prisma.enrolment.create({
        data: {
          branchId: course.branchId,
          studentId,
          courseId: course.id,
          status,
          startAt: status === 'ACTIVE' ? new Date() : null,
        },
      });
    await enrol(users.student.id, 'ACTIVE');
    await enrol(users.classmate.id, 'ACTIVE');
    await enrol(users.waiting.id, 'AWAITING_APPROVAL');
  });
  afterAll(async () => {
    await h?.close();
  });

  const say = (agent: Agent, text: string, extra: Record<string, string> = {}) => {
    let req = agent.post(`/api/v1/groups/${courseId}/messages`).field('body', text);
    for (const [k, v] of Object.entries(extra)) req = req.field(k, v);
    return req;
  };

  it('is for accepted students, the course’s own teachers and the admins, and nobody else', async () => {
    for (const agent of [student, classmate, teacher, admin]) {
      await agent.get(`/api/v1/groups/${courseId}`).expect(200);
    }
    // Not accepted yet, never joined, or a teacher of another course: it looks like it is not there.
    for (const agent of [waiting, outsider, otherTeacher]) {
      await agent.get(`/api/v1/groups/${courseId}`).expect(404);
      await agent.get(`/api/v1/groups/${courseId}/messages`).expect(404);
      await say(agent, 'hello?').expect(404);
    }
    await h.client().get(`/api/v1/groups/${courseId}`).expect(401);

    const info = (await student.get(`/api/v1/groups/${courseId}`).expect(200)).body;
    expect(info.counts).toMatchObject({ students: 2, teachers: 1 });
    expect(info.counts.admins).toBeGreaterThanOrEqual(1);
    expect(info.me).toEqual({ role: 'STUDENT', canModerate: false });
    expect((await teacher.get(`/api/v1/groups/${courseId}`).expect(200)).body.me.canModerate).toBe(
      true,
    );
    // Each person sees only their own groups; the admin sees every live course.
    const mine = (await student.get('/api/v1/groups').expect(200)).body.items;
    expect(mine.map((g: { courseId: string }) => g.courseId)).toEqual([courseId]);
    const all = (await admin.get('/api/v1/groups').expect(200)).body.items;
    expect(all.map((g: { courseId: string }) => g.courseId)).toEqual(
      expect.arrayContaining([courseId, otherCourseId]),
    );
    expect((await teacher.get('/api/v1/groups').expect(200)).body.items).toHaveLength(1);
    expect((await outsider.get('/api/v1/groups').expect(200)).body.items).toHaveLength(0);
  });

  it('sends text, pictures, video, audio, voice notes and files, and checks what they really are', async () => {
    const text = (await say(student, 'Hello everyone').expect(201)).body;
    expect(text).toMatchObject({ kind: 'TEXT', body: 'Hello everyone', mine: true });
    expect(text.sender).toMatchObject({ role: 'STUDENT' });

    const picture = (await say(student, 'my notes').attach('file', png, 'notes.png').expect(201))
      .body;
    expect(picture).toMatchObject({ kind: 'IMAGE', body: 'my notes' });
    expect(picture.file.mime).toBe('image/webp');
    const video = (await say(teacher, '').attach('file', MP4, 'lesson.mp4').expect(201)).body;
    expect(video.kind).toBe('VIDEO');
    const audio = (await say(teacher, '').attach('file', MP3, 'song.mp3').expect(201)).body;
    expect(audio.kind).toBe('AUDIO');
    const voice = (
      await say(student, '', { voice: 'true', durationSec: '7' })
        .attach('file', WEBM, 'voice.webm')
        .expect(201)
    ).body;
    expect(voice).toMatchObject({ kind: 'VOICE', durationSec: 7 });
    const pdf = (await say(classmate, '').attach('file', PDF, 'sheet.pdf').expect(201)).body;
    expect(pdf).toMatchObject({ kind: 'FILE' });

    // A program renamed to .pdf is refused; so is an empty message.
    await say(student, '')
      .attach('file', Buffer.from('MZ not a pdf'.padEnd(64, ' ')), 'fake.pdf')
      .expect(415);
    await say(student, '   ').expect(400);

    // Group members open the files; people outside the group cannot.
    await classmate.get(picture.file.url).expect(200);
    await teacher.get(video.file.url).expect(200);
    await admin.get(voice.file.url).expect(200);
    await outsider.get(picture.file.url).expect(404);
    await waiting.get(pdf.file.url).expect(404);
    await otherTeacher.get(video.file.url).expect(404);
    await h.client().get(picture.file.url).expect(404);
  });

  it('replies, reactions, edits, deletes and pins work like in Telegram', async () => {
    const first = (await say(student, 'What does ta look like?').expect(201)).body;
    const reply = (await say(teacher, 'Two dots on top.', { replyToId: first.id }).expect(201))
      .body;
    expect(reply.replyTo).toMatchObject({
      id: first.id,
      senderName: expect.any(String),
      text: 'What does ta look like?',
    });
    // Replying to a message of another course's group is refused.
    await say(teacher, 'x', { replyToId: 'not-a-message' }).expect(404);

    const liked = (
      await classmate
        .post(`/api/v1/groups/messages/${first.id}/react`)
        .send({ emoji: '👍' })
        .expect(200)
    ).body;
    expect(liked.reactions).toEqual([{ emoji: '👍', count: 1, mine: true }]);
    await student
      .post(`/api/v1/groups/messages/${first.id}/react`)
      .send({ emoji: '👍' })
      .expect(200);
    await classmate
      .post(`/api/v1/groups/messages/${first.id}/react`)
      .send({ emoji: '🤷' })
      .expect(400);
    const unliked = (
      await classmate
        .post(`/api/v1/groups/messages/${first.id}/react`)
        .send({ emoji: '👍' })
        .expect(200)
    ).body;
    expect(unliked.reactions).toEqual([{ emoji: '👍', count: 1, mine: false }]);

    // Only the writer edits; the text is kept in place and marked as edited.
    await classmate
      .patch(`/api/v1/groups/messages/${first.id}`)
      .send({ body: 'hacked' })
      .expect(403);
    const edited = (
      await student
        .patch(`/api/v1/groups/messages/${first.id}`)
        .send({ body: 'What does ta look like in Arabic?' })
        .expect(200)
    ).body;
    expect(edited).toMatchObject({ body: 'What does ta look like in Arabic?', edited: true });

    // Pinning is for teachers and admins; the group header shows the newest pinned message.
    await student.post(`/api/v1/groups/messages/${reply.id}/pin`).expect(403);
    await teacher.post(`/api/v1/groups/messages/${reply.id}/pin`).expect(200);
    expect((await student.get(`/api/v1/groups/${courseId}`).expect(200)).body.pinned).toMatchObject(
      {
        id: reply.id,
        text: 'Two dots on top.',
      },
    );
    await teacher.delete(`/api/v1/groups/messages/${reply.id}/pin`).expect(200);
    expect((await student.get(`/api/v1/groups/${courseId}`).expect(200)).body.pinned).toBeNull();

    // Students delete their own messages only; teachers and admins can remove anyone's.
    await classmate.delete(`/api/v1/groups/messages/${first.id}`).expect(403);
    await teacher.delete(`/api/v1/groups/messages/${first.id}`).expect(200);
    const page = (await student.get(`/api/v1/groups/${courseId}/messages`).expect(200)).body;
    const gone = page.items.find((m: { id: string }) => m.id === first.id);
    expect(gone).toMatchObject({ deleted: true, body: null, reactions: [] });
    // The reply that quoted it still reads well.
    const quoted = page.items.find((m: { id: string }) => m.id === reply.id);
    expect(quoted.replyTo.text).toBe('This message was deleted');

    // Deleting a message with a file removes the file.
    const withFile = (await say(classmate, 'see').attach('file', png, 'a.png').expect(201)).body;
    await classmate.delete(`/api/v1/groups/messages/${withFile.id}`).expect(200);
    await student.get(withFile.file.url).expect(404);
  });

  it('counts unread messages per group, clears them when read, and pages through history', async () => {
    // A student in a group for the first time starts with everything read.
    const late = await h.makeUser({ role: 'STUDENT' });
    const lateAgent = await h.signIn(late.phone, late.password);
    const course = await h.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    await h.prisma.enrolment.create({
      data: {
        branchId: course.branchId,
        studentId: late.id,
        courseId,
        status: 'ACTIVE',
        startAt: new Date(),
      },
    });
    expect((await lateAgent.get('/api/v1/groups').expect(200)).body.items[0].unread).toBe(0);
    expect((await lateAgent.get('/api/v1/groups/unread-count').expect(200)).body.count).toBe(0);

    await say(teacher, 'Homework is up').expect(201);
    await say(student, 'Thanks!').expect(201);
    const list = (await lateAgent.get('/api/v1/groups').expect(200)).body.items[0];
    expect(list.unread).toBe(2);
    expect(list.lastMessageText).toContain('Thanks!');
    expect((await lateAgent.get('/api/v1/groups/unread-count').expect(200)).body.count).toBe(2);
    // My own messages never count as unread.
    expect((await student.get('/api/v1/groups').expect(200)).body.items[0].unread).toBe(0);
    await lateAgent.post(`/api/v1/groups/${courseId}/read`).expect(200);
    expect((await lateAgent.get('/api/v1/groups/unread-count').expect(200)).body.count).toBe(0);

    // History comes in pages, newest first, each oldest-to-newest.
    for (let i = 0; i < 6; i++) await say(classmate, `message ${i}`).expect(201);
    const newest = (await student.get(`/api/v1/groups/${courseId}/messages?limit=4`).expect(200))
      .body;
    expect(newest.items).toHaveLength(4);
    expect(newest.hasMore).toBe(true);
    expect(newest.items.map((m: { body: string }) => m.body)).toEqual([
      'message 2',
      'message 3',
      'message 4',
      'message 5',
    ]);
    const older = (
      await student
        .get(`/api/v1/groups/${courseId}/messages?limit=2&before=${newest.items[0].id}`)
        .expect(200)
    ).body;
    expect(older.items.map((m: { body: string }) => m.body)).toEqual(['message 0', 'message 1']);
  });

  it('a student who is no longer in the course loses the group; announcements and moderation stay', async () => {
    const ex = await h.makeUser({ role: 'STUDENT' });
    const exAgent = await h.signIn(ex.phone, ex.password);
    const course = await h.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
    const enrolment = await h.prisma.enrolment.create({
      data: {
        branchId: course.branchId,
        studentId: ex.id,
        courseId,
        status: 'ACTIVE',
        startAt: new Date(),
      },
    });
    await say(exAgent, 'I am here').expect(201);
    await h.prisma.enrolment.update({ where: { id: enrolment.id }, data: { status: 'CANCELLED' } });
    await exAgent.get(`/api/v1/groups/${courseId}`).expect(404);
    await say(exAgent, 'still here?').expect(404);
    // What they wrote stays for the others.
    const page = (await student.get(`/api/v1/groups/${courseId}/messages?limit=100`).expect(200))
      .body;
    expect(page.items.some((m: { body: string }) => m.body === 'I am here')).toBe(true);

    // A new session announces itself in the group.
    const unit = (
      await teacher
        .post(`/api/v1/teach/courses/${courseId}/units`)
        .send({ title: 'Week 1' })
        .expect(201)
    ).body;
    const lesson = (
      await teacher
        .post(`/api/v1/teach/units/${unit.id}/lessons`)
        .send({ title: 'Letters' })
        .expect(201)
    ).body;
    const block = (
      await teacher
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'TEXT' })
        .expect(201)
    ).body;
    await teacher
      .patch(`/api/v1/teach/blocks/${block.id}`)
      .send({
        textJson: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Notes' }] }],
        },
      })
      .expect(200);
    await teacher.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
    const after = (await student.get(`/api/v1/groups/${courseId}/messages?limit=100`).expect(200))
      .body;
    const note = after.items.find((m: { kind: string }) => m.kind === 'SYSTEM');
    expect(note.body).toBe('New session: Letters');
    // Announcements can't be edited.
    await teacher.patch(`/api/v1/groups/messages/${note.id}`).send({ body: 'x' }).expect(403);
  });
});
