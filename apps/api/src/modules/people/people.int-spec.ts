import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

type Agent = Awaited<ReturnType<Harness['signIn']>>;

/** Profile cards (tap a person in a chat or group): who may open whose, and what each viewer sees. */
describe('people cards', () => {
  let h: Harness;
  let admin: Agent;
  let teacher: Agent;
  let otherTeacher: Agent;
  let student: Agent;
  let classmate: Agent;
  let waiting: Agent;
  let outsider: Agent;
  const id: Record<string, string> = {};

  beforeAll(async () => {
    h = await createHarness();
    await h.resetLimits();
    const stamp = Date.now();
    const language = await h.prisma.language.create({
      data: { name: `Lang ${stamp}`, code: `p${String(stamp).slice(-4)}` },
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
    for (const [key, user] of Object.entries(users)) id[key] = user.id;
    admin = await h.signIn(users.admin.phone, users.admin.password);
    teacher = await h.signIn(users.teacher.phone, users.teacher.password);
    otherTeacher = await h.signIn(users.otherTeacher.phone, users.otherTeacher.password);
    student = await h.signIn(users.student.phone, users.student.password);
    classmate = await h.signIn(users.classmate.phone, users.classmate.password);
    waiting = await h.signIn(users.waiting.phone, users.waiting.password);
    outsider = await h.signIn(users.outsider.phone, users.outsider.password);

    await h.prisma.user.update({
      where: { id: id.teacher! },
      data: { bio: 'Teaches Arabic to beginners.' },
    });
    await h.prisma.user.update({
      where: { id: id.student! },
      data: { country: 'ET', city: 'Adama', bio: 'A student bio that is never shown.' },
    });

    const course = (
      await admin
        .post('/api/v1/admin/courses')
        .send({
          title: `People course ${stamp}`,
          languageId: language.id,
          levelId: level.id,
          summary: 'A course used by the people tests.',
          outcomes: [],
          access: 'FREE',
        })
        .expect(201)
    ).body as { id: string; branchId: string };
    await admin
      .put(`/api/v1/admin/courses/${course.id}/teachers`)
      .send({ teacherIds: [id.teacher!] })
      .expect(200);
    await h.prisma.course.update({ where: { id: course.id }, data: { status: 'PUBLISHED' } });
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
    await enrol(id.student!, 'ACTIVE');
    await enrol(id.classmate!, 'ACTIVE');
    await enrol(id.waiting!, 'AWAITING_APPROVAL');
  });
  afterAll(async () => {
    await h?.close();
  });

  const card = (agent: Agent, who: string) => agent.get(`/api/v1/people/${id[who]}/card`);

  it('needs a signed-in person', async () => {
    await h.client().get(`/api/v1/people/${id.teacher}/card`).expect(401);
  });

  it('shows classmates, their teacher and the Natik team to a student, and nobody else', async () => {
    expect((await card(student, 'classmate').expect(200)).body.name).toBeTruthy();
    const teacherCard = (await card(student, 'teacher').expect(200)).body;
    expect(teacherCard).toMatchObject({ role: 'TEACHER', bio: 'Teaches Arabic to beginners.' });
    expect(teacherCard.sharedCourses).toHaveLength(1);
    expect(teacherCard.teaches).toHaveLength(1);
    await card(student, 'admin').expect(200);

    // Someone not in the course, a student still waiting for approval, a teacher of other courses:
    // each looks like a person that does not exist.
    await card(student, 'outsider').expect(404);
    await card(student, 'waiting').expect(404);
    await card(student, 'otherTeacher').expect(404);
    await card(outsider, 'student').expect(404);
    await card(outsider, 'teacher').expect(404);
    await card(otherTeacher, 'student').expect(404);
    await card(waiting, 'student').expect(404);
    await student.get('/api/v1/people/not-a-real-id/card').expect(404);
  });

  it('keeps private details private: no phone or email for teachers, no location for classmates', async () => {
    const asClassmate = (await card(classmate, 'student').expect(200)).body;
    expect(asClassmate.location).toBeNull();
    expect(asClassmate.contact).toBeNull();
    expect(asClassmate.bio).toBeNull(); // a student's bio is never shown
    expect(JSON.stringify(asClassmate)).not.toContain('+251');
    expect(JSON.stringify(asClassmate)).not.toContain('passwordHash');

    // The teacher sees where a student is from, but not their phone or email.
    const asTeacher = (await card(teacher, 'student').expect(200)).body;
    expect(asTeacher.location).toEqual({ country: 'ET', city: 'Adama' });
    expect(asTeacher.contact).toBeNull();

    // The Natik team sees everything, contact details included.
    const asAdmin = (await card(admin, 'student').expect(200)).body;
    expect(asAdmin.location).toEqual({ country: 'ET', city: 'Adama' });
    expect(asAdmin.contact.phone).toMatch(/^\+251/);
    expect(asAdmin.contact.email).toContain('@');
    await card(admin, 'outsider').expect(200);
  });

  it('says whether a message can be sent, and to whom', async () => {
    expect((await card(student, 'teacher').expect(200)).body.messageWith).toBe(id.teacher);
    expect((await card(teacher, 'student').expect(200)).body.messageWith).toBe(id.student);
    // Students do not write to each other; everyone reaches the team through the team chat.
    expect((await card(student, 'classmate').expect(200)).body.messageWith).toBeNull();
    expect((await card(student, 'admin').expect(200)).body.messageWith).toBe('TEAM');
    expect((await card(admin, 'student').expect(200)).body.messageWith).toBe(id.student);
    const mine = (await card(student, 'student').expect(200)).body;
    expect(mine).toMatchObject({ isMe: true, messageWith: null });
  });

  it('tells the chat screens who the other person is, so the header can open their card', async () => {
    const opened = await student
      .post('/api/v1/chat/conversations')
      .send({ with: id.teacher })
      .expect(200);
    expect(opened.body.id).toBeTruthy();
    const thread = (
      await student.get(`/api/v1/chat/conversations/${opened.body.id}/messages`).expect(200)
    ).body;
    expect(thread.conversation.personId).toBe(id.teacher);
    // The list shows chats that have a message in them.
    await student
      .post(`/api/v1/chat/conversations/${opened.body.id}/messages`)
      .field('body', 'Hello teacher')
      .expect(201);
    const list = (await student.get('/api/v1/chat/conversations').expect(200)).body;
    expect(list.items.some((c: { personId: string | null }) => c.personId === id.teacher)).toBe(
      true,
    );
  });
});
