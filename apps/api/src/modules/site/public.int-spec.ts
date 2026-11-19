import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, randomPhone } from '../../test/harness';

/** The public website data: contact form, catalogue, news, certificate check (needs PostgreSQL + Redis). */
describe('public website API', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(async () => {
    await h.resetLimits();
  });

  const unique = () => Math.random().toString(36).slice(2, 8);
  const longAgo = () => Date.now() - 10_000;

  describe('contact form (FR-WEB-004)', () => {
    const body = (extra: Record<string, unknown> = {}) => ({
      name: 'Sara Ali',
      phone: randomPhone(),
      message: `Hello, I would like to know about levels ${unique()}`,
      openedAt: longAgo(),
      ...extra,
    });

    it('stores a message for the admin inbox', async () => {
      const payload = body();
      await h.client().post('/api/v1/public/contact').send(payload).expect(200);
      const saved = await h.prisma.inboxMessage.findFirst({ where: { message: payload.message } });
      expect(saved).toMatchObject({
        type: 'CONTACT',
        status: 'NEW',
        name: 'Sara Ali',
        phone: payload.phone,
      });
    });

    it('quietly ignores bots: filled hidden field, or sent instantly', async () => {
      const trap = body({ website: 'http://spam.example' });
      const instant = body({ openedAt: Date.now() });
      await h.client().post('/api/v1/public/contact').send(trap).expect(200);
      await h.client().post('/api/v1/public/contact').send(instant).expect(200);
      expect(
        await h.prisma.inboxMessage.count({
          where: { message: { in: [trap.message, instant.message] } },
        }),
      ).toBe(0);
    });

    it('explains mistakes with field messages', async () => {
      const res = await h
        .client()
        .post('/api/v1/public/contact')
        .send({ name: 'A', phone: '123', message: 'hi' })
        .expect(400);
      expect(Object.keys(res.body.error.fields)).toEqual(
        expect.arrayContaining(['name', 'phone', 'message']),
      );
    });

    it('allows 5 messages an hour per phone number, and other people on the same network still get through', async () => {
      const phone = randomPhone();
      const results: number[] = [];
      for (let i = 0; i < 6; i++) {
        results.push(
          (await h.client().post('/api/v1/public/contact').send(body({ phone }))).status,
        );
      }
      expect(results.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(results[5]).toBe(429);
      // Someone else behind the same address is not blocked by that number's limit.
      const other = await h
        .client()
        .post('/api/v1/public/contact')
        .send({ ...body(), phone: '+251922334455' });
      expect(other.status).toBe(200);
    });
  });

  describe('catalogue (FR-CAT, FR-WEB-006)', () => {
    async function makeCourse(status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN', levelName = 'Beginner') {
      const branch = await h.prisma.branch.findFirstOrThrow();
      const language = await h.prisma.language.upsert({
        where: { code: 'ar' },
        update: {},
        create: { code: 'ar', name: 'Arabic', direction: 'RTL', position: 1 },
      });
      const level = await h.prisma.level.upsert({
        where: { name: levelName },
        update: {},
        create: { name: levelName, position: 1 },
      });
      const slug = `course-${status.toLowerCase()}-${unique()}`;
      return h.prisma.course.create({
        data: {
          branchId: branch.id,
          slug,
          title: `Title ${slug}`,
          languageId: language.id,
          levelId: level.id,
          summary: 'A course',
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          featured: true,
        },
      });
    }

    it('lists only published courses, and never exposes drafts or hidden ones', async () => {
      // A level of their own, so earlier test data can't push them off the list.
      const levelName = `Level ${unique()}`;
      const published = await makeCourse('PUBLISHED', levelName);
      const draft = await makeCourse('DRAFT', levelName);
      const hidden = await makeCourse('HIDDEN', levelName);
      const list = await h
        .client()
        .get('/api/v1/public/courses')
        .query({ level: levelName })
        .expect(200);
      const slugs = list.body.items.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain(published.slug);
      expect(slugs).not.toContain(draft.slug);
      expect(slugs).not.toContain(hidden.slug);
      await h.client().get(`/api/v1/public/courses/${published.slug}`).expect(200);
      await h.client().get(`/api/v1/public/courses/${draft.slug}`).expect(404);
      await h.client().get(`/api/v1/public/courses/${hidden.slug}`).expect(404);
    });

    it('filters by language and level, and returns no private fields', async () => {
      const course = await makeCourse('PUBLISHED');
      const filtered = await h
        .client()
        .get('/api/v1/public/courses')
        .query({ language: 'ar', level: 'beginner' })
        .expect(200);
      expect(filtered.body.items.map((c: { slug: string }) => c.slug)).toContain(course.slug);
      const none = await h
        .client()
        .get('/api/v1/public/courses')
        .query({ language: 'om' })
        .expect(200);
      expect(none.body.items.map((c: { slug: string }) => c.slug)).not.toContain(course.slug);
      expect(JSON.stringify(filtered.body)).not.toMatch(/branchId|status|passwordHash|phone/);
    });

    it('lists languages with their published course counts', async () => {
      await makeCourse('PUBLISHED');
      const res = await h.client().get('/api/v1/public/filters').expect(200);
      const arabic = res.body.languages.find((l: { code: string }) => l.code === 'ar');
      expect(arabic.courseCount).toBeGreaterThan(0);
      expect(res.body.levels.length).toBeGreaterThan(0);
    });
  });

  describe('news and teachers', () => {
    it('shows only public announcements that are already published', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const branch = await h.prisma.branch.findFirstOrThrow();
      const make = (title: string, audience: 'PUBLIC' | 'ALL_STUDENTS', publishAt: Date) =>
        h.prisma.announcement.create({
          data: {
            branchId: branch.id,
            authorId: owner.id,
            title,
            audience,
            publishAt,
            body: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }],
            },
          },
        });
      const tag = unique();
      await make(`Public ${tag}`, 'PUBLIC', new Date(Date.now() - 1000));
      await make(`Students ${tag}`, 'ALL_STUDENTS', new Date(Date.now() - 1000));
      await make(`Future ${tag}`, 'PUBLIC', new Date(Date.now() + 3_600_000));
      const res = await h.client().get('/api/v1/public/announcements').expect(200);
      const titles = res.body.items.map((a: { title: string }) => a.title);
      expect(titles).toContain(`Public ${tag}`);
      expect(titles).not.toContain(`Students ${tag}`);
      expect(titles).not.toContain(`Future ${tag}`);
      expect(res.body.items.find((a: { title: string }) => a.title === `Public ${tag}`).text).toBe(
        'Body text',
      );
    });

    it('lists only teachers who chose to appear, and opens only their photos to visitors', async () => {
      const shown = await h.makeUser({ role: 'TEACHER' });
      const hiddenTeacher = await h.makeUser({ role: 'TEACHER' });
      const student = await h.makeUser({});
      await h.prisma.user.update({
        where: { id: shown.id },
        data: { showOnWebsite: true, bio: 'Teaches Arabic' },
      });

      const res = await h.client().get('/api/v1/public/teachers').expect(200);
      const ids = res.body.items.map((t: { id: string }) => t.id);
      expect(ids).toContain(shown.id);
      expect(ids).not.toContain(hiddenTeacher.id);
      expect(ids).not.toContain(student.id);
      expect(JSON.stringify(res.body)).not.toMatch(/phone|passwordHash/);

      // photos: a visitor sees a website teacher's photo but not a student's
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      const teacherAgent = await h.signIn(shown.phone, shown.password);
      const studentAgent = await h.signIn(student.phone, student.password);
      const teacherPhoto = (
        await teacherAgent
          .post('/api/v1/me/photo')
          .attach('photo', png, { filename: 'a.png', contentType: 'image/png' })
      ).body.photoUrl;
      const studentPhoto = (
        await studentAgent
          .post('/api/v1/me/photo')
          .attach('photo', png, { filename: 'b.png', contentType: 'image/png' })
      ).body.photoUrl;
      // Opens = a link to the bucket (302), or with database storage the picture itself (200).
      expect([200, 302]).toContain((await h.client().get(teacherPhoto).redirects(0)).status);
      expect((await h.client().get(studentPhoto).redirects(0)).status).toBe(404);
      // signed-in people can
      expect([200, 302]).toContain((await teacherAgent.get(studentPhoto).redirects(0)).status);
    });
  });

  describe('certificate check (FR-CERT-004)', () => {
    async function makeCertificate(status: 'VALID' | 'CANCELLED') {
      const student = await h.makeUser({});
      const branch = await h.prisma.branch.findFirstOrThrow();
      const language = await h.prisma.language.upsert({
        where: { code: 'en' },
        update: {},
        create: { code: 'en', name: 'English', position: 2 },
      });
      const level = await h.prisma.level.upsert({
        where: { name: 'Beginner' },
        update: {},
        create: { name: 'Beginner', position: 1 },
      });
      const course = await h.prisma.course.create({
        data: {
          branchId: branch.id,
          slug: `cert-${unique()}`,
          title: 'English B1',
          languageId: language.id,
          levelId: level.id,
          summary: 'x',
        },
      });
      const enrolment = await h.prisma.enrolment.create({
        data: {
          branchId: branch.id,
          studentId: student.id,
          courseId: course.id,
          status: 'COMPLETED',
        },
      });
      const number = `NLC-2099-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
      await h.prisma.certificate.create({
        data: {
          number,
          studentId: student.id,
          courseId: course.id,
          enrolmentId: enrolment.id,
          studentNameSnapshot: 'Abdi Kedir',
          courseTitleSnapshot: 'English B1',
          status,
        },
      });
      return number;
    }

    it('shows only name, course and date for a valid certificate', async () => {
      const number = await makeCertificate('VALID');
      const res = await h.client().get(`/api/v1/public/certificates/${number}`).expect(200);
      expect(res.body).toMatchObject({
        status: 'VALID',
        studentName: 'Abdi Kedir',
        courseTitle: 'English B1',
      });
      expect(Object.keys(res.body).sort()).toEqual([
        'courseTitle',
        'issuedAt',
        'number',
        'status',
        'studentName',
      ]);
    });

    it('says a cancelled certificate is cancelled and reveals nothing else', async () => {
      const number = await makeCertificate('CANCELLED');
      const res = await h.client().get(`/api/v1/public/certificates/${number}`).expect(200);
      expect(res.body).toEqual({ status: 'CANCELLED', number });
    });

    it('returns not found for unknown or malformed numbers, and limits guessing', async () => {
      await h.client().get('/api/v1/public/certificates/NLC-2099-00000').expect(404);
      await h.client().get('/api/v1/public/certificates/not-a-number').expect(404);
      let blocked = 0;
      for (let i = 0; i < 32; i++) {
        if ((await h.client().get('/api/v1/public/certificates/NLC-2099-99999')).status === 429)
          blocked++;
      }
      expect(blocked).toBeGreaterThan(0);
    });
  });
});
