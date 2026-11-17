import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

type Agent = Awaited<ReturnType<Harness['signIn']>>;

/** A few bytes that look like a WebM recording, which is what Chrome and Firefox send for voice. */
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 1)]);

/** Chat between students, teachers and the Natik team: who may talk, files, voice and unread counts. */
describe('chat', () => {
  let h: Harness;
  let admin: Agent;
  let teacher: Agent;
  let otherTeacher: Agent;
  let student: Agent;
  let stranger: Agent;
  let ids: Record<'teacher' | 'otherTeacher' | 'student' | 'stranger', string>;

  beforeAll(async () => {
    h = await createHarness();
    await h.resetLimits();
    const stamp = Date.now();
    const language = await h.prisma.language.create({
      data: { name: `Lang ${stamp}`, code: `c${String(stamp).slice(-4)}` },
    });
    const level = await h.prisma.level.create({ data: { name: `Level ${stamp}` } });
    const a = await h.makeUser({ role: 'ADMIN' });
    const t = await h.makeUser({ role: 'TEACHER' });
    const t2 = await h.makeUser({ role: 'TEACHER' });
    const s = await h.makeUser({ role: 'STUDENT' });
    const x = await h.makeUser({ role: 'STUDENT' });
    admin = await h.signIn(a.phone, a.password);
    teacher = await h.signIn(t.phone, t.password);
    otherTeacher = await h.signIn(t2.phone, t2.password);
    student = await h.signIn(s.phone, s.password);
    stranger = await h.signIn(x.phone, x.password);
    ids = { teacher: t.id, otherTeacher: t2.id, student: s.id, stranger: x.id };

    const course = (
      await admin
        .post('/api/v1/admin/courses')
        .send({
          title: `Chat course ${stamp}`,
          languageId: language.id,
          levelId: level.id,
          summary: 'A course used by the chat tests.',
          outcomes: [],
          access: 'FREE',
        })
        .expect(201)
    ).body;
    await admin
      .put(`/api/v1/admin/courses/${course.id}/teachers`)
      .send({ teacherIds: [t.id] })
      .expect(200);
    await h.prisma.enrolment.create({
      data: {
        branchId: course.branchId,
        studentId: s.id,
        courseId: course.id,
        status: 'ACTIVE',
        startAt: new Date(),
      },
    });
  });
  afterAll(async () => {
    await h?.close();
  });

  const open = async (agent: Agent, who: string) =>
    (await agent.post('/api/v1/chat/conversations').send({ with: who }).expect(200)).body
      .id as string;

  it('needs sign-in', async () => {
    await h.client().get('/api/v1/chat/conversations').expect(401);
  });

  it('a student chats with the Natik team and an admin answers', async () => {
    const id = await open(student, 'TEAM');
    expect(await open(student, 'TEAM')).toBe(id); // one chat, not two

    await student
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .field('body', 'Hello, I need help with my course')
      .expect(201);

    // An empty chat is not listed; this one has a message, so the admin sees it, unread.
    const adminList = (await admin.get('/api/v1/chat/conversations').expect(200)).body.items;
    const row = adminList.find((c: { id: string }) => c.id === id);
    expect(row).toMatchObject({ unread: 1, subtitle: 'Student' });
    expect((await admin.get('/api/v1/chat/unread-count').expect(200)).body.count).toBeGreaterThan(
      0,
    );

    const reply = (
      await admin
        .post(`/api/v1/chat/conversations/${id}/messages`)
        .field('body', 'Hi! Happy to help.')
        .expect(201)
    ).body;
    expect(reply.mine).toBe(true);

    const seen = (await student.get(`/api/v1/chat/conversations/${id}/messages`).expect(200)).body;
    expect(seen.conversation.title).toBe('Natik team');
    expect(seen.items.map((m: { body: string }) => m.body)).toEqual([
      'Hello, I need help with my course',
      'Hi! Happy to help.',
    ]);
    expect(seen.items[1]).toMatchObject({ mine: false, senderName: 'Natik team' });

    await student.post(`/api/v1/chat/conversations/${id}/read`).expect(200);
    const after = (await student.get('/api/v1/chat/conversations').expect(200)).body.items;
    expect(after.find((c: { id: string }) => c.id === id).unread).toBe(0);
  });

  it('a student and a teacher of their course can chat; strangers cannot start one', async () => {
    const id = await open(student, ids.teacher);
    await student
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .field('body', 'Question about lesson 2')
      .expect(201);

    const forTeacher = (await teacher.get('/api/v1/chat/conversations').expect(200)).body.items;
    expect(forTeacher.find((c: { id: string }) => c.id === id)).toMatchObject({
      unread: 1,
      subtitle: 'Student',
    });
    await teacher
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .field('body', 'Sure, here it is.')
      .expect(201);

    // Not their teacher, not their student, and admins do not read private student-teacher chats.
    await student.post('/api/v1/chat/conversations').send({ with: ids.otherTeacher }).expect(403);
    await stranger.post('/api/v1/chat/conversations').send({ with: ids.teacher }).expect(403);
    await stranger.get(`/api/v1/chat/conversations/${id}/messages`).expect(404);
    await otherTeacher.get(`/api/v1/chat/conversations/${id}/messages`).expect(404);
    await admin.get(`/api/v1/chat/conversations/${id}/messages`).expect(404);
    await stranger
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .field('body', 'hi')
      .expect(404);
  });

  it('a teacher chats with the Natik team', async () => {
    const id = await open(teacher, 'TEAM');
    await teacher
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .field('body', 'I need a new course added')
      .expect(201);
    const row = (await admin.get('/api/v1/chat/conversations').expect(200)).body.items.find(
      (c: { id: string }) => c.id === id,
    );
    expect(row.subtitle).toBe('Teacher');
    await student.get(`/api/v1/chat/conversations/${id}/messages`).expect(404);
  });

  it('an admin can start a chat with a student by name', async () => {
    const found = (await admin.get('/api/v1/chat/contacts?q=a').expect(200)).body.items;
    expect(found).toEqual([]); // too short: no listing of everyone
    const id = await open(admin, ids.stranger);
    await admin
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .field('body', 'Welcome to Natik')
      .expect(201);
    const mine = (await stranger.get('/api/v1/chat/conversations').expect(200)).body.items;
    expect(mine.find((c: { id: string }) => c.id === id)).toMatchObject({
      title: 'Natik team',
      unread: 1,
    });
  });

  it('sends pictures, documents and voice messages, and only chat members can open them', async () => {
    const id = await open(student, 'TEAM');
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#123' } })
      .png()
      .toBuffer();
    const photo = (
      await student
        .post(`/api/v1/chat/conversations/${id}/messages`)
        .attach('file', png, 'photo.png')
        .expect(201)
    ).body;
    expect(photo).toMatchObject({ kind: 'IMAGE', file: { mime: 'image/webp' } });

    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');
    const doc = (
      await student
        .post(`/api/v1/chat/conversations/${id}/messages`)
        .field('body', 'my homework')
        .attach('file', pdf, 'homework.pdf')
        .expect(201)
    ).body;
    expect(doc).toMatchObject({
      kind: 'FILE',
      body: 'my homework',
      file: { name: 'homework.pdf' },
    });

    const voice = (
      await student
        .post(`/api/v1/chat/conversations/${id}/messages`)
        .field('voice', 'true')
        .field('durationSec', '7')
        .attach('file', WEBM, 'voice.webm')
        .expect(201)
    ).body;
    expect(voice).toMatchObject({ kind: 'VOICE', durationSec: 7, file: { mime: 'audio/webm' } });

    await student.get(voice.file.url).expect(200);
    await admin.get(doc.file.url).expect(200);
    await stranger.get(doc.file.url).expect(404);
    await teacher.get(doc.file.url).expect(404);
    await h.client().get(doc.file.url).expect(404);

    // A program renamed to .pdf, and an empty message, are refused.
    await student
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .attach('file', Buffer.from('MZ this is a program, not a document'), 'virus.pdf')
      .expect(415);
    await student.post(`/api/v1/chat/conversations/${id}/messages`).field('body', '  ').expect(400);
    await student
      .post(`/api/v1/chat/conversations/${id}/messages`)
      .field('voice', 'true')
      .attach('file', Buffer.from('not audio at all, just text'), 'voice.webm')
      .expect(415);
  });

  it('deletes a message for everyone, clears a chat for one side only, and keeps others out', async () => {
    // A fresh student, so earlier tests' messages are not in this chat.
    const fresh = await h.makeUser({ role: 'STUDENT' });
    const kid = await h.signIn(fresh.phone, fresh.password);
    const id = await open(kid, 'TEAM');
    const send = async (agent: Agent, body: string) =>
      (
        await agent
          .post(`/api/v1/chat/conversations/${id}/messages`)
          .field('body', body)
          .expect(201)
      ).body;
    const first = await send(kid, 'one to delete');
    const second = await send(kid, 'one to keep');
    const reply = await send(admin, 'from the team');

    // You can only delete your own; the team's message is not the student's to delete.
    await kid.delete(`/api/v1/chat/messages/${reply.id}`).expect(403);
    await stranger.delete(`/api/v1/chat/messages/${first.id}`).expect(404);
    await teacher.delete(`/api/v1/chat/messages/${first.id}`).expect(404);
    await kid.delete('/api/v1/chat/messages/nope').expect(404);

    const before = (await kid.get(`/api/v1/chat/conversations/${id}/messages`).expect(200)).body;
    await kid.delete(`/api/v1/chat/messages/${first.id}`).expect(204);
    const after = (await admin.get(`/api/v1/chat/conversations/${id}/messages`).expect(200)).body;
    expect(after.items.map((m: { id: string }) => m.id)).not.toContain(first.id);
    expect(after.revision).toBe(before.revision + 1);

    // An admin can delete what the team wrote; it disappears for the student too.
    await admin.delete(`/api/v1/chat/messages/${reply.id}`).expect(204);
    const seen = (await kid.get(`/api/v1/chat/conversations/${id}/messages`).expect(200)).body;
    expect(seen.items.map((m: { id: string }) => m.id)).toEqual([second.id]);

    // The chat list shows the newest message that is left.
    const row = (await kid.get('/api/v1/chat/conversations').expect(200)).body.items.find(
      (c: { id: string }) => c.id === id,
    );
    expect(row.lastMessageText).toBe('one to keep');

    // Clearing hides everything for the student only; the team still has it.
    await kid.post(`/api/v1/chat/conversations/${id}/clear`).expect(200);
    expect(
      (await kid.get(`/api/v1/chat/conversations/${id}/messages`).expect(200)).body.items,
    ).toEqual([]);
    expect(
      (await kid.get('/api/v1/chat/conversations').expect(200)).body.items.some(
        (c: { id: string }) => c.id === id,
      ),
    ).toBe(false);
    const stillThere = (await admin.get(`/api/v1/chat/conversations/${id}/messages`).expect(200))
      .body;
    expect(stillThere.items.map((m: { id: string }) => m.id)).toEqual([second.id]);

    // A new message brings the chat back, with only the new message in it.
    const again = await send(admin, 'welcome back');
    const fresh2 = (await kid.get(`/api/v1/chat/conversations/${id}/messages`).expect(200)).body;
    expect(fresh2.items.map((m: { id: string }) => m.id)).toEqual([again.id]);
    expect(
      (await kid.get('/api/v1/chat/conversations').expect(200)).body.items.find(
        (c: { id: string }) => c.id === id,
      ),
    ).toMatchObject({ unread: 1 });

    await stranger.post(`/api/v1/chat/conversations/${id}/clear`).expect(404);
  });

  it('deleting a picture message also removes its file', async () => {
    const id = await open(teacher, 'TEAM');
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#abc' } })
      .png()
      .toBuffer();
    const photo = (
      await teacher
        .post(`/api/v1/chat/conversations/${id}/messages`)
        .attach('file', png, 'p.png')
        .expect(201)
    ).body;
    await teacher.get(photo.file.url).expect(200);
    await teacher.delete(`/api/v1/chat/messages/${photo.id}`).expect(204);
    await teacher.get(photo.file.url).expect(404);
  });

  it('shows only the right people in the contact list', async () => {
    const forStudent = (await student.get('/api/v1/chat/contacts').expect(200)).body.items;
    expect(forStudent.map((c: { id: string }) => c.id)).toEqual(['TEAM', ids.teacher]);
    const forTeacher = (await teacher.get('/api/v1/chat/contacts').expect(200)).body.items;
    expect(forTeacher.map((c: { id: string }) => c.id)).toEqual(['TEAM', ids.student]);
    const forStranger = (await stranger.get('/api/v1/chat/contacts').expect(200)).body.items;
    expect(forStranger.map((c: { id: string }) => c.id)).toEqual(['TEAM']);
  });
});
