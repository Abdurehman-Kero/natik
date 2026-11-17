import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

/** Course builder: permissions, publishing rules, uploads and media access (M3, AT-12, AT-07). */
describe('course builder', () => {
  let h: Harness;
  let languageId = '';
  let levelId = '';
  let image: Buffer;

  beforeAll(async () => {
    h = await createHarness();
    const stamp = Date.now();
    languageId = (
      await h.prisma.language.create({
        data: {
          name: `Test language ${stamp}`,
          code: `t${String(stamp).slice(-4)}`,
          direction: 'RTL',
        },
      })
    ).id;
    levelId = (await h.prisma.level.create({ data: { name: `Test level ${stamp}` } })).id;
    image = await sharp({
      create: { width: 1600, height: 1000, channels: 3, background: '#123b5a' },
    })
      .png()
      .toBuffer();
    await h.resetLimits();
  });
  afterAll(async () => {
    await h?.close();
  });

  const pdf = (bytes = 2048) => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(bytes)]);
  const courseBody = (overrides: Record<string, unknown> = {}) => ({
    title: `Arabic ${Math.random().toString(36).slice(2, 8)}`,
    languageId,
    levelId,
    summary: 'Learn to read and write the Arabic alphabet.',
    outcomes: ['Read letters'],
    access: 'PAID',
    priceSantim: 150_000,
    accessDays: 90,
    ...overrides,
  });

  /** An admin, a teacher assigned to a new course, and a signed-in agent for each. */
  async function setup() {
    await h.resetLimits();
    const admin = await h.makeUser({ role: 'ADMIN' });
    const teacher = await h.makeUser({ role: 'TEACHER' });
    const adminAgent = await h.signIn(admin.phone, admin.password);
    const teacherAgent = await h.signIn(teacher.phone, teacher.password);
    const course = (await adminAgent.post('/api/v1/admin/courses').send(courseBody()).expect(201))
      .body;
    await adminAgent
      .put(`/api/v1/admin/courses/${course.id}/teachers`)
      .send({ teacherIds: [teacher.id] })
      .expect(200);
    return { admin, teacher, adminAgent, teacherAgent, course };
  }

  async function addLesson(agent: Awaited<ReturnType<Harness['signIn']>>, courseId: string) {
    const unit = (
      await agent
        .post(`/api/v1/teach/courses/${courseId}/units`)
        .send({ title: 'Unit 1' })
        .expect(201)
    ).body;
    const lesson = (
      await agent
        .post(`/api/v1/teach/units/${unit.id}/lessons`)
        .send({ title: 'The alphabet' })
        .expect(201)
    ).body;
    return { unit, lesson };
  }

  describe('who can do what (AT-12, FR-TEACH-007)', () => {
    it('teachers and students cannot manage courses; visitors are asked to sign in', async () => {
      const { teacherAgent } = await setup();
      await teacherAgent.get('/api/v1/admin/courses').expect(403);
      await teacherAgent.post('/api/v1/admin/courses').send(courseBody()).expect(403);
      await h.client().get('/api/v1/admin/courses').expect(401);
      const student = await h.makeUser({});
      const studentAgent = await h.signIn(student.phone, student.password);
      await studentAgent.get('/api/v1/teach/courses').expect(403);
    });

    it('a teacher sees only their courses, and cannot open another teacher’s course', async () => {
      const a = await setup();
      const b = await setup();
      const mine = await a.teacherAgent.get('/api/v1/teach/courses').expect(200);
      expect(mine.body.items.map((c: { id: string }) => c.id)).toEqual([a.course.id]);

      const { unit, lesson } = await addLesson(b.teacherAgent, b.course.id);
      await a.teacherAgent.get(`/api/v1/teach/courses/${b.course.id}/outline`).expect(403);
      await a.teacherAgent
        .post(`/api/v1/teach/courses/${b.course.id}/units`)
        .send({ title: 'Sneaky unit' })
        .expect(403);
      await a.teacherAgent
        .patch(`/api/v1/teach/units/${unit.id}`)
        .send({ title: 'Renamed' })
        .expect(403);
      await a.teacherAgent.get(`/api/v1/teach/lessons/${lesson.id}`).expect(403);
      await a.teacherAgent
        .patch(`/api/v1/teach/lessons/${lesson.id}`)
        .send({ title: 'Renamed' })
        .expect(403);
      await a.teacherAgent
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'TEXT' })
        .expect(403);
      await a.teacherAgent.get(`/api/v1/teach/lessons/${lesson.id}/view`).expect(403);
    });

    it('admins can open every course; the outline tells a teacher the settings are read-only', async () => {
      const { adminAgent, teacherAgent, course } = await setup();
      const asTeacher = await teacherAgent
        .get(`/api/v1/teach/courses/${course.id}/outline`)
        .expect(200);
      expect(asTeacher.body.course.canEditSettings).toBe(false);
      expect(asTeacher.body.course.priceSantim).toBe(150_000);
      const asAdmin = await adminAgent
        .get(`/api/v1/teach/courses/${course.id}/outline`)
        .expect(200);
      expect(asAdmin.body.course.canEditSettings).toBe(true);
    });

    it('a course can only get active teachers', async () => {
      const { adminAgent, course } = await setup();
      const student = await h.makeUser({});
      await adminAgent
        .put(`/api/v1/admin/courses/${course.id}/teachers`)
        .send({ teacherIds: [student.id] })
        .expect(400);
    });
  });

  describe('courses', () => {
    it('makes a unique web address from the title', async () => {
      const { adminAgent } = await setup();
      const title = `Same Title ${Date.now()}`;
      const one = await adminAgent
        .post('/api/v1/admin/courses')
        .send(courseBody({ title }))
        .expect(201);
      const two = await adminAgent
        .post('/api/v1/admin/courses')
        .send(courseBody({ title }))
        .expect(201);
      expect(one.body.slug).toMatch(/^same-title-/);
      expect(two.body.slug).toBe(`${one.body.slug}-2`);
      const clash = await adminAgent
        .patch(`/api/v1/admin/courses/${two.body.id}`)
        .send(courseBody({ title, slug: one.body.slug }))
        .expect(409);
      expect(clash.body.error.code).toBe('SLUG_TAKEN');
    });

    it('needs a price for a paid course, and keeps free courses free', async () => {
      const { adminAgent } = await setup();
      const bad = await adminAgent
        .post('/api/v1/admin/courses')
        .send(courseBody({ priceSantim: null }))
        .expect(400);
      expect(bad.body.error.fields.priceSantim).toBeTruthy();
      const free = await adminAgent
        .post('/api/v1/admin/courses')
        .send(courseBody({ access: 'FREE', priceSantim: 99_900 }))
        .expect(201);
      expect(free.body.priceSantim).toBeNull();
    });

    it('is published only when complete, and is hidden rather than deleted afterwards', async () => {
      const { adminAgent, course } = await setup();
      const notReady = await adminAgent
        .post(`/api/v1/admin/courses/${course.id}/publish`)
        .expect(422);
      expect(notReady.body.error.code).toBe('NOT_READY_TO_PUBLISH');
      expect(notReady.body.error.fields.imageFileId).toBeTruthy();

      const up = await adminAgent
        .post('/api/v1/files')
        .field('purpose', 'COURSE_IMAGE')
        .attach('file', image, 'cover.png')
        .expect(201);
      expect(up.body.mime).toBe('image/webp');
      await adminAgent
        .patch(`/api/v1/admin/courses/${course.id}`)
        .send(courseBody({ title: course.title, slug: course.slug, imageFileId: up.body.id }))
        .expect(200);
      await adminAgent.post(`/api/v1/admin/courses/${course.id}/publish`).expect(200);

      const publicList = await h.client().get('/api/v1/public/courses').expect(200);
      expect(publicList.body.items.some((c: { id: string }) => c.id === course.id)).toBe(true);
      await h.client().get(up.body.url).expect(200);

      await adminAgent.delete(`/api/v1/admin/courses/${course.id}`).expect(409);
      await adminAgent.post(`/api/v1/admin/courses/${course.id}/hide`).expect(200);
      const after = await h.client().get('/api/v1/public/courses').expect(200);
      expect(after.body.items.some((c: { id: string }) => c.id === course.id)).toBe(false);
      await h.client().get(up.body.url).expect(404);
    });

    it('records course changes in the activity log', async () => {
      const { admin, course } = await setup();
      const rows = await h.prisma.auditLog.findMany({
        where: { entityId: course.id },
        select: { action: true, actorId: true },
      });
      expect(rows.map((r) => r.action)).toEqual(
        expect.arrayContaining(['COURSE_CREATED', 'COURSE_TEACHERS_CHANGED']),
      );
      expect(rows.every((r) => r.actorId === admin.id)).toBe(true);
    });
  });

  describe('units, lessons and blocks', () => {
    it('refuses to publish an empty lesson and says what is missing', async () => {
      const { teacherAgent, course } = await setup();
      const { lesson } = await addLesson(teacherAgent, course.id);
      const res = await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(422);
      expect(res.body.error.fields.blocks[0]).toMatch(/at least one block/i);
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'TEXT' })
        .expect(201);
      // A text block with nothing typed still counts as empty.
      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(422);
    });

    it('publishes, hides, and refuses to delete what was published (FR-TEACH-008)', async () => {
      const { teacherAgent, course } = await setup();
      const { lesson } = await addLesson(teacherAgent, course.id);
      const text = (
        await teacherAgent
          .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
          .send({ type: 'TEXT' })
          .expect(201)
      ).body;
      await teacherAgent
        .patch(`/api/v1/teach/blocks/${text.id}`)
        .send({
          textJson: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                attrs: { dir: 'rtl' },
                content: [{ type: 'text', text: 'الفتحة ـَ' }],
              },
            ],
          },
        })
        .expect(200);
      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
      await teacherAgent.delete(`/api/v1/teach/lessons/${lesson.id}`).expect(409);
      const hidden = await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/hide`).expect(200);
      expect(hidden.body.status).toBe('HIDDEN');
      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
    });

    it('lets a never-published draft be deleted', async () => {
      const { teacherAgent, course } = await setup();
      const { unit, lesson } = await addLesson(teacherAgent, course.id);
      await teacherAgent.delete(`/api/v1/teach/lessons/${lesson.id}`).expect(204);
      await teacherAgent.delete(`/api/v1/teach/units/${unit.id}`).expect(204);
    });

    it('renders the preview with direction kept, and text made safe', async () => {
      const { teacherAgent, course } = await setup();
      const { lesson } = await addLesson(teacherAgent, course.id);
      const block = (
        await teacherAgent
          .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
          .send({ type: 'TEXT' })
          .expect(201)
      ).body;
      await teacherAgent
        .patch(`/api/v1/teach/blocks/${block.id}`)
        .send({
          textJson: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                attrs: { dir: 'rtl' },
                content: [{ type: 'text', text: 'الفتحة' }],
              },
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }],
              },
            ],
          },
        })
        .expect(200);
      const view = (await teacherAgent.get(`/api/v1/teach/lessons/${lesson.id}/view`).expect(200))
        .body;
      expect(view.course.dir).toBe('rtl');
      expect(view.blocks[0].html).toBe(
        '<p dir="rtl">الفتحة</p><p>&lt;img src=x onerror=alert(1)&gt;</p>',
      );
    });

    it('keeps the order consistent when lessons move between units', async () => {
      const { teacherAgent, course } = await setup();
      const u1 = (
        await teacherAgent
          .post(`/api/v1/teach/courses/${course.id}/units`)
          .send({ title: 'One' })
          .expect(201)
      ).body;
      const u2 = (
        await teacherAgent
          .post(`/api/v1/teach/courses/${course.id}/units`)
          .send({ title: 'Two' })
          .expect(201)
      ).body;
      const mk = async (unitId: string, title: string) =>
        (
          await teacherAgent
            .post(`/api/v1/teach/units/${unitId}/lessons`)
            .send({ title })
            .expect(201)
        ).body.id as string;
      const [a, b, c] = [
        await mk(u1.id, 'Lesson A'),
        await mk(u1.id, 'Lesson B'),
        await mk(u2.id, 'Lesson C'),
      ];

      await teacherAgent
        .post(`/api/v1/teach/courses/${course.id}/lessons/reorder`)
        .send({
          units: [
            { unitId: u1.id, lessonIds: [b] },
            { unitId: u2.id, lessonIds: [c, a] },
          ],
        })
        .expect(200);
      const outline = (
        await teacherAgent.get(`/api/v1/teach/courses/${course.id}/outline`).expect(200)
      ).body;
      expect(outline.units[0].lessons.map((l: { id: string }) => l.id)).toEqual([b]);
      expect(outline.units[1].lessons.map((l: { id: string }) => l.id)).toEqual([c, a]);

      // A lesson from another course can't be slipped in.
      const other = await setup();
      const { lesson: foreign } = await addLesson(other.teacherAgent, other.course.id);
      await teacherAgent
        .post(`/api/v1/teach/courses/${course.id}/lessons/reorder`)
        .send({ units: [{ unitId: u1.id, lessonIds: [b, foreign.id] }] })
        .expect(400);
      await teacherAgent
        .post(`/api/v1/teach/courses/${course.id}/units/reorder`)
        .send({ ids: [u2.id, u1.id] })
        .expect(200);
    });

    it('shows a student nothing under a hidden unit', async () => {
      const { teacherAgent, adminAgent, course } = await setup();
      const { unit, lesson } = await addLesson(teacherAgent, course.id);
      const block = (
        await teacherAgent
          .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
          .send({ type: 'TEXT' })
          .expect(201)
      ).body;
      await teacherAgent
        .patch(`/api/v1/teach/blocks/${block.id}`)
        .send({
          textJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }] }],
          },
        })
        .expect(200);
      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
      await teacherAgent.post(`/api/v1/teach/units/${unit.id}/publish`).expect(200);
      const up = await adminAgent
        .post('/api/v1/files')
        .field('purpose', 'COURSE_IMAGE')
        .attach('file', image, 'cover.png')
        .expect(201);
      await adminAgent
        .patch(`/api/v1/admin/courses/${course.id}`)
        .send(courseBody({ title: course.title, slug: course.slug, imageFileId: up.body.id }))
        .expect(200);
      await adminAgent.post(`/api/v1/admin/courses/${course.id}/publish`).expect(200);

      const catalogue = async () =>
        (await h.client().get(`/api/v1/public/courses/${course.slug}`).expect(200)).body.outline;
      expect(await catalogue()).toHaveLength(1);
      await teacherAgent.post(`/api/v1/teach/units/${unit.id}/hide`).expect(200);
      expect(await catalogue()).toHaveLength(0);

      const student = await h.makeUser({});
      await h.prisma.enrolment.create({
        data: {
          branchId: (await h.prisma.branch.findFirstOrThrow()).id,
          studentId: student.id,
          courseId: course.id,
          status: 'ACTIVE',
        },
      });
      const studentAgent = await h.signIn(student.phone, student.password);
      // Enrolled, but the unit is hidden: the lesson is not available.
      await studentAgent.get(`/api/v1/teach/lessons/${lesson.id}/view`).expect(403);
    });

    it('publishing the first lesson of a new unit publishes the unit; a hidden unit stays hidden', async () => {
      const { teacherAgent, course } = await setup();
      const { unit, lesson } = await addLesson(teacherAgent, course.id);
      const fill = async (lessonId: string) => {
        const block = (
          await teacherAgent
            .post(`/api/v1/teach/lessons/${lessonId}/blocks`)
            .send({ type: 'TEXT' })
            .expect(201)
        ).body;
        await teacherAgent
          .patch(`/api/v1/teach/blocks/${block.id}`)
          .send({
            textJson: {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
            },
          })
          .expect(200);
      };
      const unitStatus = async () =>
        (await h.prisma.unit.findUniqueOrThrow({ where: { id: unit.id } })).status;

      expect(await unitStatus()).toBe('DRAFT');
      await fill(lesson.id);
      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
      expect(await unitStatus()).toBe('PUBLISHED');

      // The teacher hides the unit on purpose; publishing another lesson in it does not undo that.
      await teacherAgent.post(`/api/v1/teach/units/${unit.id}/hide`).expect(200);
      const second = (
        await teacherAgent
          .post(`/api/v1/teach/units/${unit.id}/lessons`)
          .send({ title: 'Second lesson' })
          .expect(201)
      ).body;
      await fill(second.id);
      await teacherAgent.post(`/api/v1/teach/lessons/${second.id}/publish`).expect(200);
      expect(await unitStatus()).toBe('HIDDEN');
    });
  });

  describe('uploads (NFR-SEC-004)', () => {
    it('refuses a 32 MB PDF with the plain-language size message', async () => {
      const { teacherAgent, course } = await setup();
      const res = await teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'LESSON_PDF')
        .field('courseId', course.id)
        .attach('file', pdf(Math.round(31.5 * 1024 * 1024)), 'big.pdf')
        .expect(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
      expect(res.body.error.message).toBe('This file is 32 MB. The maximum is 25 MB.');
    });

    it('refuses a program renamed to .pdf, and script saved as an image', async () => {
      const { teacherAgent, course } = await setup();
      const exe = Buffer.concat([Buffer.from('MZ\x90\x00\x03', 'latin1'), Buffer.alloc(4096)]);
      const res = await teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'LESSON_PDF')
        .field('courseId', course.id)
        .attach('file', exe, { filename: 'handout.pdf', contentType: 'application/pdf' })
        .expect(415);
      expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      );
      await teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'LESSON_IMAGE')
        .field('courseId', course.id)
        .attach('file', svg, { filename: 'a.png', contentType: 'image/png' })
        .expect(415);
    });

    it('turns pictures into WebP, and only lets teachers upload to their own course', async () => {
      const a = await setup();
      const b = await setup();
      const ok = await a.teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'LESSON_IMAGE')
        .field('courseId', a.course.id)
        .attach('file', image, 'photo.png')
        .expect(201);
      expect(ok.body.mime).toBe('image/webp');
      expect(ok.body.name).toBe('photo.webp');
      await a.teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'LESSON_IMAGE')
        .field('courseId', b.course.id)
        .attach('file', image, 'photo.png')
        .expect(403);
      // Only admins upload course pictures.
      await a.teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'COURSE_IMAGE')
        .attach('file', image, 'photo.png')
        .expect(403);
    });
  });

  describe('opening files and videos', () => {
    it('checks access on every request; free preview opens a lesson to everyone', async () => {
      const { teacherAgent, course } = await setup();
      const { lesson } = await addLesson(teacherAgent, course.id);
      const up = await teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'LESSON_PDF')
        .field('courseId', course.id)
        .attach('file', pdf(), 'chart.pdf')
        .expect(201);
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'PDF', fileId: up.body.id })
        .expect(201);

      // Not yet published: only people who can edit the course can open it.
      await h.client().get(up.body.url).expect(401);
      const stranger = await h.makeUser({});
      const strangerAgent = await h.signIn(stranger.phone, stranger.password);
      await strangerAgent.get(up.body.url).expect(403);
      const mine = await teacherAgent.get(up.body.url).expect(200);
      expect(mine.headers['content-type']).toBe('application/pdf');
      expect(mine.headers['content-disposition']).toMatch(/^inline/);

      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
      // The lesson is live, but its course is still a draft: nothing is open to visitors yet.
      await h.client().get(up.body.url).expect(401);
    });

    it('serves a free-preview lesson’s file to visitors, and downloads only when allowed', async () => {
      const { teacherAgent, adminAgent, course } = await setup();
      const { unit, lesson } = await addLesson(teacherAgent, course.id);
      const up = await teacherAgent
        .post('/api/v1/files')
        .field('purpose', 'LESSON_PDF')
        .field('courseId', course.id)
        .attach('file', pdf(), 'chart.pdf')
        .expect(201);
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'PDF', fileId: up.body.id })
        .expect(201);
      await teacherAgent.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
      await teacherAgent.post(`/api/v1/teach/units/${unit.id}/publish`).expect(200);
      await teacherAgent
        .patch(`/api/v1/teach/lessons/${lesson.id}`)
        .send({ isFreePreview: true })
        .expect(200);
      const cover = await adminAgent
        .post('/api/v1/files')
        .field('purpose', 'COURSE_IMAGE')
        .attach('file', image, 'cover.png')
        .expect(201);
      await adminAgent
        .patch(`/api/v1/admin/courses/${course.id}`)
        .send(courseBody({ title: course.title, slug: course.slug, imageFileId: cover.body.id }))
        .expect(200);
      await adminAgent.post(`/api/v1/admin/courses/${course.id}/publish`).expect(200);

      const visitor = await h.client().get(up.body.url).expect(200);
      expect(visitor.headers['content-disposition']).toMatch(/^inline/);
      // Downloads are off by default.
      await h.client().get(`${up.body.url}?download=1`).expect(403);
      await teacherAgent
        .patch(`/api/v1/teach/lessons/${lesson.id}`)
        .send({ downloadsAllowed: true })
        .expect(200);
      const dl = await h.client().get(`${up.body.url}?download=1`).expect(200);
      expect(dl.headers['content-disposition']).toMatch(/^attachment/);

      // Without free preview, the same file closes to visitors again.
      await teacherAgent
        .patch(`/api/v1/teach/lessons/${lesson.id}`)
        .send({ isFreePreview: false })
        .expect(200);
      await h.client().get(up.body.url).expect(401);
    });

    it('checks access for videos too, and never lets them be downloaded', async () => {
      const { teacherAgent, course } = await setup();
      const { lesson } = await addLesson(teacherAgent, course.id);
      const created = (
        await teacherAgent.post('/api/v1/videos').send({ title: 'Vowels' }).expect(201)
      ).body;
      expect(created.upload.kind).toBe('direct');
      const mp4 = Buffer.concat([
        Buffer.from([0, 0, 0, 0x20]),
        Buffer.from('ftypisom'),
        Buffer.alloc(4096),
      ]);
      await teacherAgent.post(created.upload.url).attach('file', mp4, 'v.mp4').expect(201);
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'VIDEO', videoId: created.id })
        .expect(201);

      await h.client().get(`/api/v1/videos/${created.id}/embed`).expect(401);
      const stranger = await h.makeUser({});
      const strangerAgent = await h.signIn(stranger.phone, stranger.password);
      await strangerAgent.get(`/api/v1/videos/${created.id}/embed`).expect(403);
      await strangerAgent.get(`/api/v1/videos/${created.id}/stream`).expect(403);
      const mine = (await teacherAgent.get(`/api/v1/videos/${created.id}/embed`).expect(200)).body;
      expect(mine.kind).toBe('file');
      const stream = await teacherAgent.get(`/api/v1/videos/${created.id}/stream`).expect(200);
      expect(stream.headers['content-disposition']).toBe('inline');

      // Another teacher can't use someone else's video.
      const other = await setup();
      const { lesson: otherLesson } = await addLesson(other.teacherAgent, other.course.id);
      await other.teacherAgent
        .post(`/api/v1/teach/lessons/${otherLesson.id}/blocks`)
        .send({ type: 'VIDEO', videoId: created.id })
        .expect(403);
    });

    it('a video shows a still picture before it plays: a captured frame, or YouTube’s thumbnail', async () => {
      const { teacherAgent, course } = await setup();
      const { lesson } = await addLesson(teacherAgent, course.id);
      const created = (
        await teacherAgent.post('/api/v1/videos').send({ title: 'Greetings' }).expect(201)
      ).body;
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'VIDEO', videoId: created.id })
        .expect(201);
      expect(created.posterUrl).toBeNull();

      // Only a picture is accepted, and only by people who can work on the video.
      await teacherAgent
        .post(`/api/v1/videos/${created.id}/poster`)
        .attach('file', Buffer.from('not a picture'), 'frame.jpg')
        .expect(415);
      const stranger = await h.makeUser({ role: 'TEACHER' });
      const strangerAgent = await h.signIn(stranger.phone, stranger.password);
      await strangerAgent
        .post(`/api/v1/videos/${created.id}/poster`)
        .attach('file', image, 'frame.png')
        .expect(403);

      const withPoster = (
        await teacherAgent
          .post(`/api/v1/videos/${created.id}/poster`)
          .attach('file', image, 'frame.png')
          .expect(201)
      ).body;
      expect(withPoster.posterUrl).toMatch(/^\/api\/v1\/files\/[a-z0-9]+$/);
      // Anyone can load the picture (no account needed), and browsers keep it.
      const picture = await h.client().get(withPoster.posterUrl).expect(200);
      expect(picture.headers['content-type']).toBe('image/webp');
      expect(picture.headers['cache-control']).toContain('immutable');

      // The editor and the lesson page both carry it.
      const editor = (await teacherAgent.get(`/api/v1/teach/lessons/${lesson.id}`).expect(200))
        .body;
      const block = editor.blocks.find((b: { type: string }) => b.type === 'VIDEO');
      expect(block.video.posterUrl).toBe(withPoster.posterUrl);

      // A new picture replaces the old one, and the old file is removed.
      const replaced = (
        await teacherAgent
          .post(`/api/v1/videos/${created.id}/poster`)
          .attach('file', image, 'frame-2.png')
          .expect(201)
      ).body;
      expect(replaced.posterUrl).not.toBe(withPoster.posterUrl);
      await h.client().get(withPoster.posterUrl).expect(404);

      // A YouTube link shows YouTube's own thumbnail.
      const youtube = (
        await teacherAgent
          .post('/api/v1/videos/external')
          .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Intro' })
          .expect(201)
      ).body;
      expect(youtube.posterUrl).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('refuses a video upload that is not a video', async () => {
      const { teacherAgent } = await setup();
      const created = (
        await teacherAgent.post('/api/v1/videos').send({ title: 'Fake' }).expect(201)
      ).body;
      await teacherAgent
        .post(created.upload.url)
        .attach('file', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(4096)]), 'fake.mp4')
        .expect(415);
    });
  });
});
