import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

type Agent = Awaited<ReturnType<Harness['signIn']>>;

const text = (value: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
});

/** Guided lessons: stages, slides, external video, captions, opening lessons in order, resume. */
describe('guided lessons (Phase A)', () => {
  let h: Harness;
  let admin: Agent;
  let teacher: Agent;
  let student: Agent;
  let other: Agent;
  let courseId: string;
  const lessonIds: string[] = [];
  let studentId = '';

  beforeAll(async () => {
    h = await createHarness();
    await h.resetLimits();
    const stamp = Date.now();
    const language = await h.prisma.language.create({
      data: { name: `Lang ${stamp}`, code: `g${String(stamp).slice(-4)}` },
    });
    const level = await h.prisma.level.create({ data: { name: `Level ${stamp}` } });
    const a = await h.makeUser({ role: 'ADMIN' });
    const t = await h.makeUser({ role: 'TEACHER' });
    const s = await h.makeUser({ role: 'STUDENT' });
    const o = await h.makeUser({ role: 'STUDENT' });
    admin = await h.signIn(a.phone, a.password);
    teacher = await h.signIn(t.phone, t.password);
    student = await h.signIn(s.phone, s.password);
    other = await h.signIn(o.phone, o.password);
    studentId = s.id;

    const cover = await sharp({
      create: { width: 40, height: 40, channels: 3, background: '#345' },
    })
      .png()
      .toBuffer();
    const picture = (
      await admin
        .post('/api/v1/files')
        .field('purpose', 'COURSE_IMAGE')
        .attach('file', cover, 'cover.png')
        .expect(201)
    ).body;
    const course = (
      await admin
        .post('/api/v1/admin/courses')
        .send({
          title: `Guided ${stamp}`,
          languageId: language.id,
          levelId: level.id,
          summary: 'A course used by the guided lesson tests.',
          outcomes: [],
          access: 'FREE',
          imageFileId: picture.id,
        })
        .expect(201)
    ).body;
    courseId = course.id;
    await admin
      .put(`/api/v1/admin/courses/${courseId}/teachers`)
      .send({ teacherIds: [t.id] })
      .expect(200);

    const unit = (
      await teacher
        .post(`/api/v1/teach/courses/${courseId}/units`)
        .send({ title: 'Unit' })
        .expect(201)
    ).body;
    for (const title of ['Lesson one', 'Lesson two', 'Lesson three']) {
      const lesson = (
        await teacher.post(`/api/v1/teach/units/${unit.id}/lessons`).send({ title }).expect(201)
      ).body;
      await teacher
        .post(`/api/v1/teach/lessons/${lesson.id}/blocks`)
        .send({ type: 'TEXT', textJson: text(`Body of ${title}`) })
        .expect(201);
      await teacher.post(`/api/v1/teach/lessons/${lesson.id}/publish`).expect(200);
      lessonIds.push(lesson.id);
    }
    await teacher.post(`/api/v1/teach/units/${unit.id}/publish`).expect(200);
    await admin.post(`/api/v1/admin/courses/${courseId}/publish`).expect(200);
    await h.prisma.enrolment.create({
      data: {
        branchId: course.branchId,
        studentId: s.id,
        courseId,
        status: 'ACTIVE',
        startAt: new Date(),
      },
    });
  });
  afterAll(async () => {
    await h?.close();
  });

  it('lesson intro: description, objectives and study time are saved and shown', async () => {
    const id = lessonIds[0]!;
    const saved = (
      await teacher
        .patch(`/api/v1/teach/lessons/${id}`)
        .send({
          description: 'Say hello and introduce yourself.',
          objectives: ['Greet people', 'Say your name'],
          estimatedMinutes: 15,
        })
        .expect(200)
    ).body;
    expect(saved).toMatchObject({
      description: 'Say hello and introduce yourself.',
      objectives: ['Greet people', 'Say your name'],
      estimatedMinutes: 15,
    });
    await teacher
      .patch(`/api/v1/teach/lessons/${id}`)
      .send({ objectives: Array(7).fill('x') })
      .expect(400);

    const page = (await student.get(`/api/v1/learn/lessons/${id}`).expect(200)).body;
    expect(page.lesson).toMatchObject({
      description: 'Say hello and introduce yourself.',
      objectives: ['Greet people', 'Say your name'],
      estimatedMinutes: 15,
    });
  });

  it('blocks can be put in a stage, and a deck of slides can be built', async () => {
    const id = lessonIds[0]!;
    const deck = (
      await teacher
        .post(`/api/v1/teach/lessons/${id}/blocks`)
        .send({ type: 'SLIDES', stage: 'PREPARE' })
        .expect(201)
    ).body;

    const png = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#789' } })
      .png()
      .toBuffer();
    const upload = (
      await teacher
        .post('/api/v1/files')
        .field('purpose', 'LESSON_IMAGE')
        .field('courseId', courseId)
        .attach('file', png, 'slide.png')
        .expect(201)
    ).body;

    const first = (
      await teacher
        .post(`/api/v1/teach/blocks/${deck.id}/slides`)
        .send({ title: 'Hello', body: 'Say hello', keywords: ['salaam'], imageFileId: upload.id })
        .expect(201)
    ).body;
    const second = (
      await teacher
        .post(`/api/v1/teach/blocks/${deck.id}/slides`)
        .send({ title: 'Goodbye' })
        .expect(201)
    ).body;
    await teacher.post(`/api/v1/teach/blocks/${deck.id}/slides`).send({ title: '' }).expect(400);

    await teacher
      .post(`/api/v1/teach/blocks/${deck.id}/slides/reorder`)
      .send({ ids: [second.id, first.id] })
      .expect(200);
    await teacher
      .patch(`/api/v1/teach/slides/${second.id}`)
      .send({ body: 'See you later' })
      .expect(200);

    const view = (await student.get(`/api/v1/learn/lessons/${id}`).expect(200)).body.lesson;
    const block = view.blocks.find((b: { type: string }) => b.type === 'SLIDES');
    expect(block.stage).toBe('PREPARE');
    expect(block.slides.map((s: { title: string }) => s.title)).toEqual(['Goodbye', 'Hello']);
    expect(block.slides[1].keywords).toEqual(['salaam']);

    // The slide picture opens for the enrolled student, but not for a stranger.
    await student.get(block.slides[1].imageUrl).expect(200);
    await other.get(block.slides[1].imageUrl).expect(403);

    // A picture from another course, or one that is not a lesson picture, is refused.
    await teacher
      .post(`/api/v1/teach/blocks/${deck.id}/slides`)
      .send({ title: 'Bad', imageFileId: 'does-not-exist' })
      .expect(415);

    await teacher.delete(`/api/v1/teach/slides/${first.id}`).expect(204);
    const left = (await teacher.get(`/api/v1/teach/lessons/${id}`).expect(200)).body.blocks.find(
      (b: { type: string }) => b.type === 'SLIDES',
    );
    expect(left.slides).toHaveLength(1);

    // An empty deck does not count as lesson content when publishing.
    // (A week holds up to 3 sessions, so this one goes in a week of its own.)
    const deckCourseId = (await teacher.get(`/api/v1/teach/lessons/${id}`)).body.course.id;
    const week = (
      await teacher
        .post(`/api/v1/teach/courses/${deckCourseId}/units`)
        .send({ title: 'Week 2' })
        .expect(201)
    ).body;
    const emptyLesson = (
      await teacher
        .post(`/api/v1/teach/units/${week.id}/lessons`)
        .send({ title: 'Only an empty deck' })
        .expect(201)
    ).body;
    await teacher
      .post(`/api/v1/teach/lessons/${emptyLesson.id}/blocks`)
      .send({ type: 'SLIDES' })
      .expect(201);
    await teacher.post(`/api/v1/teach/lessons/${emptyLesson.id}/publish`).expect(422);
    await teacher.delete(`/api/v1/teach/lessons/${emptyLesson.id}`).expect(204);
  });

  it('only teachers of the course can edit slides', async () => {
    const outsider = await h.makeUser({ role: 'TEACHER' });
    const agent = await h.signIn(outsider.phone, outsider.password);
    const deck = (await teacher.get(`/api/v1/teach/lessons/${lessonIds[0]}`)).body.blocks.find(
      (b: { type: string }) => b.type === 'SLIDES',
    );
    await agent.post(`/api/v1/teach/blocks/${deck.id}/slides`).send({ title: 'Nope' }).expect(403);
    await student
      .post(`/api/v1/teach/blocks/${deck.id}/slides`)
      .send({ title: 'Nope' })
      .expect(403);
  });

  it('a YouTube or Vimeo link becomes a video; other links are refused', async () => {
    const bad = await teacher
      .post('/api/v1/videos/external')
      .send({ title: 'Nope', url: 'https://example.com/watch?v=dQw4w9WgXcQ' })
      .expect(400);
    expect(bad.body.error.fields.url).toBeTruthy();

    const video = (
      await teacher
        .post('/api/v1/videos/external')
        .send({ title: 'Greetings', url: 'https://youtu.be/dQw4w9WgXcQ' })
        .expect(201)
    ).body;
    expect(video).toMatchObject({ external: true, status: 'READY', hasCaptions: false });

    const id = lessonIds[1]!;
    await teacher
      .post(`/api/v1/teach/lessons/${id}/blocks`)
      .send({ type: 'VIDEO', videoId: video.id, stage: 'WATCH' })
      .expect(201);
    const playback = (await student.get(`/api/v1/videos/${video.id}/embed`).expect(200)).body;
    expect(playback.kind).toBe('iframe');
    expect(playback.url).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    await other.get(`/api/v1/videos/${video.id}/embed`).expect(403);

    // Captions belong on the other site for these videos.
    await teacher
      .post(`/api/v1/videos/${video.id}/captions`)
      .attach('file', Buffer.from('WEBVTT\n\n'), 'c.vtt')
      .expect(400);
  });

  it('captions: only WebVTT files, shown to people who may watch the video', async () => {
    const created = (await teacher.post('/api/v1/videos').send({ title: 'Local clip' }).expect(201))
      .body;
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 1)]);
    await teacher
      .post(`/api/v1/videos/${created.id}/upload`)
      .attach('file', webm, 'clip.webm')
      .expect(201);
    await teacher
      .post(`/api/v1/teach/lessons/${lessonIds[2]}/blocks`)
      .send({ type: 'VIDEO', videoId: created.id, stage: 'WATCH' })
      .expect(201);

    await teacher
      .post(`/api/v1/videos/${created.id}/captions`)
      .attach('file', Buffer.from('not captions at all'), 'c.vtt')
      .expect(415);
    const vtt = 'WEBVTT\n\n00:00.000 --> 00:02.000\nHello\n';
    const withCaptions = (
      await teacher
        .post(`/api/v1/videos/${created.id}/captions`)
        .attach('file', Buffer.from(vtt), 'c.vtt')
        .expect(201)
    ).body;
    expect(withCaptions.hasCaptions).toBe(true);

    const playback = (await student.get(`/api/v1/videos/${created.id}/embed`).expect(200)).body;
    expect(playback.captionsUrl).toBe(`/api/v1/videos/${created.id}/captions`);
    const file = await student.get(playback.captionsUrl).expect(200);
    expect(file.headers['content-type']).toContain('text/vtt');
    expect(file.text).toContain('Hello');
    await other.get(playback.captionsUrl).expect(403);

    await teacher.delete(`/api/v1/videos/${created.id}/captions`).expect(200);
    await student.get(playback.captionsUrl).expect(404);
  });

  it('opening lessons in order locks later lessons until earlier ones are done', async () => {
    const courseSlug = await slug();
    // Everything is open by default.
    const open = (await student.get(`/api/v1/learn/${courseSlug}`).expect(200)).body;
    expect(open.units[0].lessons.map((l: { state: string }) => l.state)).not.toContain('locked');

    const fields = await courseFields();
    await admin
      .patch(`/api/v1/admin/courses/${courseId}`)
      .send({ ...fields, lessonOrder: 'IN_ORDER' })
      .expect(200);

    const outline = (await student.get(`/api/v1/learn/${courseSlug}`).expect(200)).body;
    expect(outline.units[0].lessons.map((l: { state: string }) => l.state)).toEqual([
      'current',
      'locked',
      'locked',
    ]);

    // Opening a locked lesson by its address is refused, with the lesson to finish first.
    const refused = await student.get(`/api/v1/learn/lessons/${lessonIds[1]}`).expect(403);
    expect(refused.body.error.params).toMatchObject({
      reason: 'LESSON_LOCKED',
      lockedById: lessonIds[0],
    });
    await student.post(`/api/v1/learn/lessons/${lessonIds[2]}/complete`).expect(403);
    // Its video and pictures are locked too.
    const videoOfTwo = await h.prisma.lessonBlock.findFirstOrThrow({
      where: { lessonId: lessonIds[1], type: 'VIDEO' },
    });
    await student.get(`/api/v1/videos/${videoOfTwo.videoId}/embed`).expect(403);

    // A lesson marked "always open" can be opened out of order.
    await teacher
      .patch(`/api/v1/teach/lessons/${lessonIds[2]}`)
      .send({ alwaysOpen: true })
      .expect(200);
    await student.get(`/api/v1/learn/lessons/${lessonIds[2]}`).expect(200);
    await teacher
      .patch(`/api/v1/teach/lessons/${lessonIds[2]}`)
      .send({ alwaysOpen: false })
      .expect(200);

    // Finishing lesson one opens lesson two.
    await student.post(`/api/v1/learn/lessons/${lessonIds[0]}/complete`).expect(200);
    await student.get(`/api/v1/learn/lessons/${lessonIds[1]}`).expect(200);
    await student.get(`/api/v1/learn/lessons/${lessonIds[2]}`).expect(403);
    const after = (await student.get(`/api/v1/learn/${courseSlug}`).expect(200)).body;
    expect(after.units[0].lessons.map((l: { state: string }) => l.state)).toEqual([
      'done',
      'current',
      'locked',
    ]);

    await admin
      .patch(`/api/v1/admin/courses/${courseId}`)
      .send({ ...fields, lessonOrder: 'OPEN' })
      .expect(200);
    await student.get(`/api/v1/learn/lessons/${lessonIds[2]}`).expect(200);
  });

  it('remembers the step and where each video stopped', async () => {
    const id = lessonIds[1]!;
    await student
      .put(`/api/v1/learn/lessons/${id}/resume`)
      .send({ stage: 2, video: { id: 'v1', sec: 41.6 } })
      .expect(200);
    await student
      .put(`/api/v1/learn/lessons/${id}/resume`)
      .send({ video: { id: 'v2', sec: 5 } })
      .expect(200);
    const page = (await student.get(`/api/v1/learn/lessons/${id}`).expect(200)).body;
    expect(page.state.resume).toEqual({ stage: 2, videos: { v1: 42, v2: 5 } });

    await student.put(`/api/v1/learn/lessons/${id}/resume`).send({ stage: -1 }).expect(400);
    // A stranger cannot save progress in a lesson they cannot open.
    await other.put(`/api/v1/learn/lessons/${id}/resume`).send({ stage: 1 }).expect(403);
    const stored = await h.prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId, lessonId: id } },
    });
    expect(stored?.stage).toBe(2);
  });

  it('the course trailer must be a YouTube or Vimeo link and shows on the public page', async () => {
    const fields = await courseFields();
    await admin
      .patch(`/api/v1/admin/courses/${courseId}`)
      .send({ ...fields, trailerUrl: 'https://example.com/video' })
      .expect(400);
    await admin
      .patch(`/api/v1/admin/courses/${courseId}`)
      .send({ ...fields, trailerUrl: 'https://vimeo.com/76979871' })
      .expect(200);
    const trailerSlug = await slug();
    const pub = (await h.client().get(`/api/v1/public/courses/${trailerSlug}`).expect(200)).body;
    expect(pub.trailerEmbedUrl).toBe('https://player.vimeo.com/video/76979871?dnt=1');
    expect(pub.lessonOrder).toBe('OPEN');
  });

  async function slug(): Promise<string> {
    return (await h.prisma.course.findUniqueOrThrow({ where: { id: courseId } })).slug;
  }

  /** The fields a course update must send again (the update replaces the whole form). */
  async function courseFields() {
    const c = (await admin.get(`/api/v1/admin/courses/${courseId}`).expect(200)).body;
    return {
      title: c.title,
      languageId: c.languageId,
      levelId: c.levelId,
      summary: c.summary,
      outcomes: c.outcomes,
      access: c.access,
      imageFileId: c.imageFileId,
    };
  }
});
