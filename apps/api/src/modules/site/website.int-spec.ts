import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

type Agent = Awaited<ReturnType<Harness['signIn']>>;

/** Public website, website editor, inbox and announcements (M4, AT-01, FR-WEB-005/006). */
describe('public website and its editor', () => {
  let h: Harness;
  let languageId = '';
  let levelId = '';
  let image: Buffer;
  let admin: Agent;

  beforeAll(async () => {
    h = await createHarness();
    const stamp = Date.now();
    languageId = (
      await h.prisma.language.create({
        data: { name: `Lang ${stamp}`, code: `w${String(stamp).slice(-4)}` },
      })
    ).id;
    levelId = (await h.prisma.level.create({ data: { name: `Level ${stamp}` } })).id;
    image = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#b69a4a' } })
      .png()
      .toBuffer();
    const user = await h.makeUser({ role: 'ADMIN' });
    admin = await h.signIn(user.phone, user.password);
  });
  afterAll(async () => {
    await h?.close();
  });

  const text = (value: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
  });

  /** A published course with one lesson. `free` marks that lesson as a free preview. */
  async function courseWithLesson(options: {
    free: boolean;
    publishCourse?: boolean;
    publishLesson?: boolean;
  }) {
    await h.resetLimits();
    const teacher = await h.makeUser({ role: 'TEACHER' });
    const teacherAgent = await h.signIn(teacher.phone, teacher.password);
    const course = (
      await admin
        .post('/api/v1/admin/courses')
        .send({
          title: `Site test ${Math.random().toString(36).slice(2, 8)}`,
          languageId,
          levelId,
          summary: 'A course used by the website tests.',
          outcomes: [],
          access: 'FREE',
        })
        .expect(201)
    ).body;
    await admin
      .put(`/api/v1/admin/courses/${course.id}/teachers`)
      .send({ teacherIds: [teacher.id] })
      .expect(200);
    const unit = (
      await teacherAgent
        .post(`/api/v1/teach/courses/${course.id}/units`)
        .send({ title: 'Unit one' })
        .expect(201)
    ).body;
    const lesson = (
      await teacherAgent
        .post(`/api/v1/teach/units/${unit.id}/lessons`)
        .send({ title: 'Free lesson' })
        .expect(201)
    ).body;
    const block = (
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'TEXT' })
        .expect(201)
    ).body;
    await teacherAgent
      .patch(`/api/v1/teach/blocks/${block.id}`)
      .send({ textJson: text('Hello learners') })
      .expect(200);
    if (options.publishLesson !== false) {
      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
      await teacherAgent.post(`/api/v1/teach/units/${unit.id}/publish`).expect(200);
    }
    if (options.publishCourse !== false) {
      const cover = await admin
        .post('/api/v1/files')
        .field('purpose', 'COURSE_IMAGE')
        .attach('file', image, 'c.png')
        .expect(201);
      await admin
        .patch(`/api/v1/admin/courses/${course.id}`)
        .send({
          title: course.title,
          slug: course.slug,
          languageId,
          levelId,
          summary: course.summary,
          outcomes: [],
          access: 'FREE',
          imageFileId: cover.body.id,
        })
        .expect(200);
      await admin.post(`/api/v1/admin/courses/${course.id}/publish`).expect(200);
    }
    return { course, unit, lesson, teacher, teacherAgent };
  }

  describe('introduction only (FR-CAT-005, FR-WEB-006)', () => {
    it('visitors get no session content: sample lesson addresses are gone', async () => {
      const { lesson } = await courseWithLesson({ free: true });
      await h.client().get(`/api/v1/public/lessons/${lesson.id}`).expect(404);
      await h.client().get('/api/v1/public/free-lessons').expect(404);
      // Opening the session itself asks visitors to sign in.
      await h.client().get(`/api/v1/learn/lessons/${lesson.id}`).expect(401);
    });

    it('the course page lists weeks and session titles, and never drafts or hidden ones', async () => {
      const draftLesson = await courseWithLesson({ free: true, publishLesson: false });
      const hidden = await courseWithLesson({ free: true });
      const shown = await courseWithLesson({ free: true });
      await hidden.teacherAgent.post(`/api/v1/teach/lessons/${hidden.lesson.id}/hide`).expect(200);

      const detail = await h
        .client()
        .get(`/api/v1/public/courses/${shown.course.slug}`)
        .expect(200);
      expect(detail.body.outline[0].lessons[0]).toEqual({
        id: shown.lesson.id,
        title: shown.lesson.title,
        sessionDate: null,
      });
      // Titles only: no content of any kind.
      expect(JSON.stringify(detail.body)).not.toContain('Hello learners');
      for (const { course, lesson } of [draftLesson, hidden]) {
        const page = await h.client().get(`/api/v1/public/courses/${course.slug}`).expect(200);
        expect(JSON.stringify(page.body.outline)).not.toContain(lesson.id);
      }
    });
  });

  describe('website editor (FR-WEB-005)', () => {
    it('only admins can edit; visitors can read the result', async () => {
      const teacher = await h.makeUser({ role: 'TEACHER' });
      const teacherAgent = await h.signIn(teacher.phone, teacher.password);
      await teacherAgent.put('/api/v1/admin/site/home').send({}).expect(403);
      await h.client().put('/api/v1/admin/site/home').send({}).expect(401);
      await teacherAgent.post('/api/v1/admin/faq').send({}).expect(403);
    });

    it('changes to the headline show on the public site straight away', async () => {
      const title = `Learn languages ${Date.now()}`;
      await admin
        .put('/api/v1/admin/site/home')
        .send({ heroTitle: title, heroSubtitle: 'With Natik’s teachers.' })
        .expect(200);
      const site = await h.client().get('/api/v1/public/site').expect(200);
      expect(site.body.home.heroTitle).toBe(title);
    });

    it('goes back to the standard wording when reset', async () => {
      await admin
        .put('/api/v1/admin/site/home')
        .send({ heroTitle: 'Temporary headline', heroSubtitle: 'Temporary line.' })
        .expect(200);
      await admin.delete('/api/v1/admin/site/home').expect(204);
      const site = await h.client().get('/api/v1/public/site').expect(200);
      expect(site.body.home).toBeNull();
      await h.client().delete('/api/v1/admin/site/home').expect(401);
    });

    it('checks the contact details', async () => {
      const res = await admin
        .put('/api/v1/admin/site/contact')
        .send({ email: 'not-an-email', mapUrl: 'javascript:alert(1)' })
        .expect(400);
      expect(res.body.error.fields.email).toBeTruthy();
      expect(res.body.error.fields.mapUrl).toBeTruthy();
      await admin
        .put('/api/v1/admin/site/contact')
        .send({ phone: '+251 11 123 4567', email: 'hello@natik.example' })
        .expect(200);
      const site = await h.client().get('/api/v1/public/site').expect(200);
      expect(site.body.contact.email).toBe('hello@natik.example');
    });

    it('rejects unknown settings keys', async () => {
      await admin.get('/api/v1/admin/site/secrets').expect(404);
    });

    it('adds, reorders, unpublishes and deletes FAQ items', async () => {
      const a = (
        await admin
          .post('/api/v1/admin/faq')
          .send({ question: 'First question?', answer: 'First answer.' })
          .expect(201)
      ).body;
      const b = (
        await admin
          .post('/api/v1/admin/faq')
          .send({ question: 'Second question?', answer: 'Second answer.' })
          .expect(201)
      ).body;
      const all = (await admin.get('/api/v1/admin/faq').expect(200)).body.items.map(
        (i: { id: string }) => i.id,
      );
      const reordered = [...all.filter((id: string) => id !== b.id), b.id];
      reordered.splice(reordered.indexOf(b.id), 1);
      reordered.unshift(b.id);
      await admin.post('/api/v1/admin/faq/reorder').send({ ids: reordered }).expect(200);
      let pub = (await h.client().get('/api/v1/public/faq').expect(200)).body.items.map(
        (i: { id: string }) => i.id,
      );
      expect(pub.indexOf(b.id)).toBeLessThan(pub.indexOf(a.id));

      await admin
        .put(`/api/v1/admin/faq/${a.id}`)
        .send({ question: 'First question?', answer: 'First answer.', published: false })
        .expect(200);
      pub = (await h.client().get('/api/v1/public/faq').expect(200)).body.items.map(
        (i: { id: string }) => i.id,
      );
      expect(pub).not.toContain(a.id);
      await admin.delete(`/api/v1/admin/faq/${a.id}`).expect(204);
      await admin.delete(`/api/v1/admin/faq/${b.id}`).expect(204);
      // a reorder with a stale list is refused
      await admin
        .post('/api/v1/admin/faq/reorder')
        .send({ ids: [a.id] })
        .expect(400);
    });

    it('shows only published testimonials', async () => {
      // The public list shows the first few, so start from an empty list rather than the test database's leftovers.
      await h.prisma.testimonial.deleteMany();
      const shown = (
        await admin
          .post('/api/v1/admin/testimonials')
          .send({
            name: 'Abdi K.',
            quote: 'The lessons are clear and patient.',
            courseLabel: 'Arabic',
          })
          .expect(201)
      ).body;
      const hidden = (
        await admin
          .post('/api/v1/admin/testimonials')
          .send({ name: 'Hidden P.', quote: 'This one is not published yet.', published: false })
          .expect(201)
      ).body;
      const pub = (await h.client().get('/api/v1/public/testimonials').expect(200)).body.items.map(
        (i: { id: string }) => i.id,
      );
      expect(pub).toContain(shown.id);
      expect(pub).not.toContain(hidden.id);
    });

    it('a testimonial can have a student photo that is public only once it is shown', async () => {
      await h.prisma.testimonial.deleteMany();
      const upload = await admin
        .post('/api/v1/files')
        .field('purpose', 'SITE_IMAGE')
        .attach('file', image, 'student.png')
        .expect(201);
      const photoId = upload.body.id as string;
      // Before it is used on the website, only an admin can see the picture.
      await h.client().get(`/api/v1/files/${photoId}`).expect(404);
      await admin.get(`/api/v1/files/${photoId}`).expect(200);

      const shown = (
        await admin
          .post('/api/v1/admin/testimonials')
          .send({
            name: 'Photo P.',
            quote: 'I could ask questions at any time.',
            photoFileId: photoId,
          })
          .expect(201)
      ).body;
      expect(shown.photoUrl).toBe(`/api/v1/files/${photoId}`);
      const pub = (await h.client().get('/api/v1/public/testimonials').expect(200)).body.items;
      expect(pub.find((i: { id: string }) => i.id === shown.id).photoUrl).toBe(
        `/api/v1/files/${photoId}`,
      );
      await h.client().get(`/api/v1/files/${photoId}`).expect(200);

      // Only a site picture can be used: a course image is refused.
      const other = await admin
        .post('/api/v1/files')
        .field('purpose', 'COURSE_IMAGE')
        .attach('file', image, 'cover.png')
        .expect(201);
      await admin
        .post('/api/v1/admin/testimonials')
        .send({
          name: 'Wrong P.',
          quote: 'This uses the wrong kind of picture.',
          photoFileId: other.body.id,
        })
        .expect(400);

      // Hiding the testimonial hides the picture from visitors again.
      await admin
        .put(`/api/v1/admin/testimonials/${shown.id}`)
        .send({
          name: 'Photo P.',
          quote: 'I could ask questions at any time.',
          photoFileId: photoId,
          published: false,
        })
        .expect(200);
      await h.client().get(`/api/v1/files/${photoId}`).expect(404);
    });

    it('policy text is made safe before it is shown', async () => {
      const body = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Your data' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] },
        ],
      };
      await admin
        .put('/api/v1/admin/policies/privacy')
        .send({ title: 'Privacy notice', body })
        .expect(200);
      const res = await h.client().get('/api/v1/public/policies/privacy').expect(200);
      expect(res.body.html).toBe('<h2>Your data</h2><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
      await h.client().get('/api/v1/public/policies/other').expect(404);
      await admin.put('/api/v1/admin/policies/other').send({ title: 'Other', body }).expect(404);
    });

    it('features only published courses, in the order given', async () => {
      const one = await courseWithLesson({ free: false });
      const two = await courseWithLesson({ free: false });
      const draft = await courseWithLesson({ free: false, publishCourse: false });
      await admin
        .put('/api/v1/admin/featured-courses')
        .send({ ids: [draft.course.id] })
        .expect(400);
      await admin
        .put('/api/v1/admin/featured-courses')
        .send({ ids: [two.course.id, one.course.id] })
        .expect(200);
      const list = (
        await h.client().get('/api/v1/public/courses?featured=true').expect(200)
      ).body.items.map((c: { id: string }) => c.id);
      expect(list.indexOf(two.course.id)).toBeLessThan(list.indexOf(one.course.id));
      await admin.put('/api/v1/admin/featured-courses').send({ ids: [] }).expect(200);
    });
  });

  describe('contact inbox (FR-ADMIN-007)', () => {
    it('a message sent from the site is read and closed by an admin', async () => {
      await h.resetLimits();
      const message = `Please call me about the Arabic course ${Date.now()}`;
      await h
        .client()
        .post('/api/v1/public/contact')
        .send({ name: 'Sara Ali', phone: '0911223344', message, openedAt: Date.now() - 10_000 })
        .expect(200);
      const list = (await admin.get('/api/v1/admin/messages?status=NEW').expect(200)).body;
      const found = list.items.find((m: { message: string }) => m.message === message);
      expect(found).toBeTruthy();
      expect(found.phone).toContain('91 122 3344');
      const count = (await admin.get('/api/v1/admin/messages/count').expect(200)).body.count;
      expect(count).toBeGreaterThan(0);

      await admin.post(`/api/v1/admin/messages/${found.id}/close`).expect(200);
      const closed = (await admin.get('/api/v1/admin/messages?status=CLOSED').expect(200)).body;
      expect(closed.items.some((m: { id: string }) => m.id === found.id)).toBe(true);
      await admin.post(`/api/v1/admin/messages/${found.id}/reopen`).expect(200);
    });

    it('is closed to teachers and visitors', async () => {
      const teacher = await h.makeUser({ role: 'TEACHER' });
      const teacherAgent = await h.signIn(teacher.phone, teacher.password);
      await teacherAgent.get('/api/v1/admin/messages').expect(403);
      await h.client().get('/api/v1/admin/messages').expect(401);
    });
  });

  describe('announcements (FR-NOTIF-001, SRS §3)', () => {
    it('admins post public announcements; future ones stay hidden until their date', async () => {
      const title = `Eid hours ${Date.now()}`;
      await admin
        .post('/api/v1/admin/announcements')
        .send({ title, text: 'We close early on Friday.', audience: 'PUBLIC' })
        .expect(201);
      const later = `Scheduled ${Date.now()}`;
      await admin
        .post('/api/v1/admin/announcements')
        .send({
          title: later,
          text: 'Not yet.',
          audience: 'PUBLIC',
          publishAt: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(201);
      const pub = (
        await h.client().get('/api/v1/public/announcements?limit=20').expect(200)
      ).body.items.map((a: { title: string }) => a.title);
      expect(pub).toContain(title);
      expect(pub).not.toContain(later);
    });

    it('only “one course” announcements for students show on the site never', async () => {
      const { course } = await courseWithLesson({ free: false });
      const title = `Class moved ${Date.now()}`;
      await admin
        .post('/api/v1/admin/announcements')
        .send({ title, text: 'Room 2 today.', audience: 'COURSE', courseId: course.id })
        .expect(201);
      const pub = (
        await h.client().get('/api/v1/public/announcements?limit=20').expect(200)
      ).body.items.map((a: { title: string }) => a.title);
      expect(pub).not.toContain(title);
    });

    it('a teacher posts to their own course only', async () => {
      const mine = await courseWithLesson({ free: false });
      const other = await courseWithLesson({ free: false });
      const ok = await mine.teacherAgent
        .post('/api/v1/teach/announcements')
        .send({
          title: 'Homework due',
          text: 'Please finish unit one.',
          audience: 'COURSE',
          courseId: mine.course.id,
        })
        .expect(201);
      await mine.teacherAgent
        .post('/api/v1/teach/announcements')
        .send({
          title: 'Not mine',
          text: 'Should not work.',
          audience: 'COURSE',
          courseId: other.course.id,
        })
        .expect(403);
      await mine.teacherAgent
        .post('/api/v1/teach/announcements')
        .send({ title: 'To everyone', text: 'Should not work.', audience: 'PUBLIC' })
        .expect(403);
      await mine.teacherAgent.post('/api/v1/admin/announcements').send({}).expect(403);

      const list = (await mine.teacherAgent.get('/api/v1/teach/announcements').expect(200)).body;
      expect(list.items.map((a: { id: string }) => a.id)).toContain(ok.body.id);
      expect(list.courses.map((c: { id: string }) => c.id)).toEqual([mine.course.id]);

      // another teacher can't change or delete it
      await other.teacherAgent
        .patch(`/api/v1/teach/announcements/${ok.body.id}`)
        .send({ title: 'Hacked', text: 'x y z', audience: 'COURSE', courseId: other.course.id })
        .expect(403);
      await other.teacherAgent.delete(`/api/v1/teach/announcements/${ok.body.id}`).expect(403);
      await mine.teacherAgent.delete(`/api/v1/teach/announcements/${ok.body.id}`).expect(204);
    });
  });
});
