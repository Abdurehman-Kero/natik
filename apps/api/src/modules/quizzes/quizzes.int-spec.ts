import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';
import { AttemptGrader } from './attempt-grader.service';
import { CertificatesService } from '../certificates/certificates.service';

/** Quizzes, marking, completion and certificates (M6): AT-10, AT-11, AT-13, AT-07 (quiz part). */
describe('quizzes, marking and certificates', () => {
  let h: Harness;
  let languageId = '';
  let levelId = '';
  let grader: AttemptGrader;
  let certificates: CertificatesService;

  beforeAll(async () => {
    h = await createHarness();
    grader = h.app.get(AttemptGrader);
    certificates = h.app.get(CertificatesService);
    const stamp = Date.now();
    languageId = (
      await h.prisma.language.create({
        data: { name: `M6 language ${stamp}`, code: `q${String(stamp).slice(-4)}` },
      })
    ).id;
    levelId = (await h.prisma.level.create({ data: { name: `M6 level ${stamp}` } })).id;
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(async () => {
    await h.resetLimits();
  });

  type Agent = Awaited<ReturnType<Harness['signIn']>>;
  const unique = () => Math.random().toString(36).slice(2, 8);

  /** A published free course with `lessons` lessons, and a teacher assigned to it. */
  async function setup(lessons = 3) {
    const branch = await h.prisma.branch.findFirstOrThrow();
    const slug = `m6-${unique()}`;
    const course = await h.prisma.course.create({
      data: {
        branchId: branch.id,
        slug,
        title: `Course ${slug}`,
        languageId,
        levelId,
        summary: 'A course for quiz tests',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        access: 'FREE',
        accessDays: 90,
      },
    });
    const unit = await h.prisma.unit.create({
      data: { courseId: course.id, title: 'Unit', position: 1, status: 'PUBLISHED' },
    });
    const lessonIds: string[] = [];
    for (let i = 1; i <= lessons; i++) {
      const lesson = await h.prisma.lesson.create({
        data: {
          unitId: unit.id,
          courseId: course.id,
          title: `Lesson ${i}`,
          position: i,
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      lessonIds.push(lesson.id);
    }
    const teacher = await h.makeUser({ role: 'TEACHER' });
    await h.prisma.courseTeacher.create({ data: { courseId: course.id, teacherId: teacher.id } });
    const teacherAgent = await h.signIn(teacher.phone, teacher.password);
    return { course, lessonIds, teacher, teacherAgent };
  }

  async function student(courseId?: string) {
    const user = await h.makeUser({});
    const agent = await h.signIn(user.phone, user.password);
    if (courseId) await agent.post(`/api/v1/courses/${courseId}/enrol`).expect(200);
    return { ...user, agent };
  }

  /** Builds a published quiz with one question of each type (the short answer is worth 2). */
  async function buildQuiz(
    teacher: Agent,
    lessonId: string,
    options: {
      isFinal?: boolean;
      timeLimitMinutes?: number | null;
      maxAttempts?: number | null;
      skipShort?: boolean;
    } = {},
  ) {
    const created = await teacher
      .post(`/api/v1/teach/lessons/${lessonId}/quiz`)
      .send({ title: 'Short vowels', isFinal: options.isFinal ?? false })
      .expect(201);
    const id = created.body.id as string;
    const add = (body: Record<string, unknown>) =>
      teacher.post(`/api/v1/teach/quizzes/${id}/questions`).send(body).expect(201);
    await add({
      type: 'MULTIPLE_CHOICE',
      text: 'Which letter is "ta"?',
      options: [{ text: 'ب' }, { text: 'ت' }, { text: 'ث' }],
      correctIndex: 1,
      explanation: 'Ta has two dots above.',
    });
    await add({ type: 'TRUE_FALSE', text: 'Arabic is written right to left.', correctValue: true });
    await add({
      type: 'FILL_BLANK',
      text: 'The Arabic word for book is ____.',
      acceptedAnswers: ['kitaab', 'كتاب'],
    });
    if (!options.skipShort) {
      await add({
        type: 'SHORT_ANSWER',
        text: 'Write a sentence with "kitaab".',
        marks: 2,
        modelAnswer: 'هذا كتاب',
      });
    }
    const settings = (await teacher.get(`/api/v1/teach/quizzes/${id}`).expect(200)).body;
    await teacher
      .patch(`/api/v1/teach/quizzes/${id}`)
      .send({
        title: settings.title,
        instructions: '',
        isFinal: settings.isFinal,
        passMarkPct: settings.passMarkPct,
        maxAttempts: options.maxAttempts === undefined ? settings.maxAttempts : options.maxAttempts,
        timeLimitMinutes: options.timeLimitMinutes ?? null,
        showAnswers: true,
      })
      .expect(200);
    await teacher.post(`/api/v1/teach/quizzes/${id}/publish`).expect(200);
    return (await teacher.get(`/api/v1/teach/quizzes/${id}`).expect(200)).body as {
      id: string;
      questions: {
        id: string;
        type: string;
        options?: { id: string; text: string }[];
        correctIndex?: number;
      }[];
    };
  }

  /** The student's answers for a quiz built by buildQuiz: everything right unless told otherwise. */
  function answersFor(quiz: Awaited<ReturnType<typeof buildQuiz>>, wrong: string[] = []) {
    return quiz.questions.map((q) => {
      const bad = wrong.includes(q.type);
      let response: string | boolean;
      switch (q.type) {
        case 'MULTIPLE_CHOICE':
          response = q.options![bad ? 0 : q.correctIndex!]!.id;
          break;
        case 'TRUE_FALSE':
          response = !bad;
          break;
        case 'FILL_BLANK':
          response = bad ? 'wrong' : '  KITAAB ';
          break;
        default:
          response = 'هذا كتاب جميل';
      }
      return { questionId: q.id, response };
    });
  }

  async function takeQuiz(
    agent: Agent,
    quizId: string,
    answers: { questionId: string; response: string | boolean }[],
  ) {
    const started = (await agent.post(`/api/v1/learn/quizzes/${quizId}/attempts`).expect(200)).body;
    for (const a of answers) {
      await agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${a.questionId}`)
        .send({ response: a.response })
        .expect(200);
    }
    const result = (
      await agent.post(`/api/v1/learn/attempts/${started.attemptId}/submit`).expect(200)
    ).body;
    return { attemptId: started.attemptId as string, result };
  }

  // ── Builder ─────────────────────────────────────────────────────────────

  describe('building quizzes (FR-QUIZ-001…004)', () => {
    it('uses stricter defaults for a final quiz, and allows only one per course', async () => {
      const { teacherAgent, lessonIds } = await setup();
      const lessonQuiz = (
        await teacherAgent
          .post(`/api/v1/teach/lessons/${lessonIds[0]}/quiz`)
          .send({ title: 'Lesson quiz' })
          .expect(201)
      ).body;
      const finalQuiz = (
        await teacherAgent
          .post(`/api/v1/teach/lessons/${lessonIds[1]}/quiz`)
          .send({ title: 'Final quiz', isFinal: true })
          .expect(201)
      ).body;
      const a = (await teacherAgent.get(`/api/v1/teach/quizzes/${lessonQuiz.id}`).expect(200)).body;
      const b = (await teacherAgent.get(`/api/v1/teach/quizzes/${finalQuiz.id}`).expect(200)).body;
      expect(a).toMatchObject({
        passMarkPct: 60,
        maxAttempts: null,
        isFinal: false,
        status: 'DRAFT',
      });
      expect(b).toMatchObject({ passMarkPct: 70, maxAttempts: 2, isFinal: true });
      // A second final quiz, and a second quiz on the same lesson, are refused.
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lessonIds[2]}/quiz`)
        .send({ title: 'Another', isFinal: true })
        .expect(409);
      await teacherAgent
        .post(`/api/v1/teach/lessons/${lessonIds[0]}/quiz`)
        .send({ title: 'Twice' })
        .expect(409);
    });

    it('explains mistakes in questions, and needs a question before publishing', async () => {
      const { teacherAgent, lessonIds } = await setup();
      const quiz = (
        await teacherAgent
          .post(`/api/v1/teach/lessons/${lessonIds[0]}/quiz`)
          .send({ title: 'Quiz' })
          .expect(201)
      ).body;
      await teacherAgent.post(`/api/v1/teach/quizzes/${quiz.id}/publish`).expect(422);
      const bad = await teacherAgent
        .post(`/api/v1/teach/quizzes/${quiz.id}/questions`)
        .send({
          type: 'MULTIPLE_CHOICE',
          text: 'Q?',
          options: [{ text: 'only one' }],
          correctIndex: 0,
        })
        .expect(400);
      expect(Object.keys(bad.body.error.fields).join()).toContain('options');
      await teacherAgent
        .post(`/api/v1/teach/quizzes/${quiz.id}/questions`)
        .send({ type: 'FILL_BLANK', text: 'Fill ____', acceptedAnswers: [] })
        .expect(400);
    });

    it('only the course teachers and admins can build; others get 403', async () => {
      const a = await setup();
      const b = await setup();
      const other = await b.teacherAgent
        .post(`/api/v1/teach/lessons/${b.lessonIds[0]}/quiz`)
        .send({ title: 'Mine' })
        .expect(201);
      await a.teacherAgent.get(`/api/v1/teach/quizzes/${other.body.id}`).expect(403);
      await a.teacherAgent
        .post(`/api/v1/teach/quizzes/${other.body.id}/questions`)
        .send({ type: 'TRUE_FALSE', text: 'Sneaky?', correctValue: true })
        .expect(403);
      const s = await student();
      await s.agent.get(`/api/v1/teach/quizzes/${other.body.id}`).expect(403);
      await h.client().get(`/api/v1/teach/quizzes/${other.body.id}`).expect(401);
    });

    it('a quiz students have taken can only be hidden, never deleted', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, { skipShort: true });
      const s = await student(course.id);
      await takeQuiz(s.agent, quiz.id, answersFor(quiz));
      await teacherAgent.delete(`/api/v1/teach/quizzes/${quiz.id}`).expect(409);
      await teacherAgent.post(`/api/v1/teach/quizzes/${quiz.id}/hide`).expect(200);
      // Hidden quizzes disappear for students.
      await s.agent.get(`/api/v1/learn/quizzes/${quiz.id}`).expect(404);
    });
  });

  // ── AT-10 ───────────────────────────────────────────────────────────────

  describe('taking quizzes (AT-10)', () => {
    it('never sends correct answers or explanations before the answers are in (FR-QUIZ-010)', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!);
      const s = await student(course.id);
      const intro = await s.agent.get(`/api/v1/learn/quizzes/${quiz.id}`).expect(200);
      const started = (await s.agent.post(`/api/v1/learn/quizzes/${quiz.id}/attempts`).expect(200))
        .body;
      const attempt = await s.agent.get(`/api/v1/learn/attempts/${started.attemptId}`).expect(200);
      for (const body of [intro.body, attempt.body]) {
        const sent = JSON.stringify(body);
        expect(sent).not.toMatch(
          /"correct"|correctIndex|correctValue|acceptedAnswers|modelAnswer|explanation/,
        );
        expect(sent).not.toContain('Ta has two dots');
        expect(sent).not.toContain('كتاب');
      }
      expect(attempt.body.questions).toHaveLength(4);
      // Saved answers can be read back, the right kind of response is required.
      const mc = attempt.body.questions[0];
      await s.agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${mc.id}`)
        .send({ response: mc.options[0].id })
        .expect(200);
      await s.agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${mc.id}`)
        .send({ response: 'not-an-option' })
        .expect(400);
      await s.agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${attempt.body.questions[1].id}`)
        .send({ response: 'true' })
        .expect(400);
      const again = await s.agent.get(`/api/v1/learn/attempts/${started.attemptId}`).expect(200);
      expect(again.body.answers[mc.id]).toBe(mc.options[0].id);
      // Starting again resumes the same attempt instead of starting another.
      const resumed = (await s.agent.post(`/api/v1/learn/quizzes/${quiz.id}/attempts`).expect(200))
        .body;
      expect(resumed).toMatchObject({ attemptId: started.attemptId, resumed: true });
    });

    it('marks the three automatic types, and waits for the teacher on the short answer', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!);
      const s = await student(course.id);
      const { result } = await takeQuiz(s.agent, quiz.id, answersFor(quiz));
      expect(result.attempt.status).toBe('WAITING_FOR_MARKING');
      expect(result.result).toBeNull();
      expect(result.review).toBeNull();

      const wrong = await student(course.id);
      const { attemptId } = await takeQuiz(
        wrong.agent,
        quiz.id,
        answersFor(quiz, ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK']),
      );
      const rows = await h.prisma.answer.findMany({ where: { attemptId } });
      const auto = rows.filter((r) => r.marksAwarded !== null);
      expect(auto).toHaveLength(3);
      expect(auto.every((r) => Number(r.marksAwarded) === 0 && r.isCorrect === false)).toBe(true);
      // A blank short answer needs no teacher: it is zero straight away.
      const blank = await student(course.id);
      const out = await takeQuiz(
        blank.agent,
        quiz.id,
        answersFor(quiz).filter((a) => a.response !== 'هذا كتاب جميل'),
      );
      expect(out.result.attempt.status).toBe('GRADED');
      expect(out.result.result).toMatchObject({
        score: 3,
        maxScore: 5,
        scorePct: 60,
        passed: true,
      });
    });

    it('enforces the number of attempts, and a teacher can give one more', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, {
        maxAttempts: 1,
        skipShort: true,
      });
      const s = await student(course.id);
      const wrongAnswers = answersFor(quiz, ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK']);
      const first = await takeQuiz(s.agent, quiz.id, wrongAnswers);
      expect(first.result.result.passed).toBe(false);
      expect(first.result.attemptsLeft).toBe(0);
      const intro = (await s.agent.get(`/api/v1/learn/quizzes/${quiz.id}`).expect(200)).body;
      expect(intro).toMatchObject({ attemptsLeft: 0, canStart: false });
      const refused = await s.agent.post(`/api/v1/learn/quizzes/${quiz.id}/attempts`).expect(403);
      expect(refused.body.error.code).toBe('NO_ATTEMPTS_LEFT');

      // Another student's teacher can't give extras; this course's teacher can.
      const stranger = await setup();
      await stranger.teacherAgent
        .post(`/api/v1/teach/quizzes/${quiz.id}/grants`)
        .send({ studentId: s.id })
        .expect(403);
      await teacherAgent
        .post(`/api/v1/teach/quizzes/${quiz.id}/grants`)
        .send({ studentId: s.id })
        .expect(201);
      const second = await takeQuiz(s.agent, quiz.id, answersFor(quiz));
      expect(second.result.result).toMatchObject({ passed: true, scorePct: 100 });
      expect(second.result.attempt.number).toBe(2);
      // The teacher sees both attempts.
      const overview = (
        await teacherAgent
          .get(`/api/v1/teach/courses/${course.id}/students/${s.id}/attempts`)
          .expect(200)
      ).body;
      expect(overview.quizzes[0].attempts).toHaveLength(2);
    });

    it('keeps time on the server: late saves are refused and saved answers are submitted', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, {
        timeLimitMinutes: 5,
        skipShort: true,
      });
      const s = await student(course.id);
      const started = (await s.agent.post(`/api/v1/learn/quizzes/${quiz.id}/attempts`).expect(200))
        .body;
      const attempt = (await s.agent.get(`/api/v1/learn/attempts/${started.attemptId}`).expect(200))
        .body;
      expect(
        new Date(attempt.attempt.deadlineAt).getTime() -
          new Date(attempt.attempt.serverNow).getTime(),
      ).toBeGreaterThan(290_000);
      const [mc, tf] = attempt.questions;
      const right = answersFor(quiz);
      await s.agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${mc.id}`)
        .send({ response: right[0]!.response })
        .expect(200);

      // The clock runs out.
      await h.prisma.quizAttempt.update({
        where: { id: started.attemptId },
        data: { deadlineAt: new Date(Date.now() - 1000) },
      });
      const late = await s.agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${tf.id}`)
        .send({ response: true });
      expect(late.status).toBe(409);
      expect(late.body.error.code).toBe('QUIZ_TIME_UP');
      const result = (
        await s.agent.get(`/api/v1/learn/attempts/${started.attemptId}/result`).expect(200)
      ).body;
      expect(result.attempt.status).toBe('GRADED');
      // Only the answer saved before the deadline counted: 1 of 3 marks.
      expect(result.result).toMatchObject({ score: 1, maxScore: 3 });
      // Saving or submitting after that does nothing more.
      await s.agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${tf.id}`)
        .send({ response: true })
        .expect(409);
      expect(
        (await s.agent.post(`/api/v1/learn/attempts/${started.attemptId}/submit`).expect(200)).body
          .result.score,
      ).toBe(1);
    });

    it('the time-out job submits attempts nobody came back to', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, {
        timeLimitMinutes: 5,
        skipShort: true,
      });
      const s = await student(course.id);
      const started = (await s.agent.post(`/api/v1/learn/quizzes/${quiz.id}/attempts`).expect(200))
        .body;
      await h.prisma.quizAttempt.update({
        where: { id: started.attemptId },
        data: { deadlineAt: new Date(Date.now() - 60_000) },
      });
      expect(await grader.submitDue()).toBeGreaterThanOrEqual(1);
      expect(
        (await h.prisma.quizAttempt.findUniqueOrThrow({ where: { id: started.attemptId } })).status,
      ).toBe('GRADED');
    });

    it('changing a quiz later does not change attempts already started', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, { skipShort: true });
      const s = await student(course.id);
      const started = (await s.agent.post(`/api/v1/learn/quizzes/${quiz.id}/attempts`).expect(200))
        .body;
      await teacherAgent
        .put(`/api/v1/teach/quizzes/${quiz.id}/questions/${quiz.questions[1]!.id}`)
        .send({ type: 'TRUE_FALSE', text: 'Changed to the opposite.', correctValue: false })
        .expect(200);
      const attempt = (await s.agent.get(`/api/v1/learn/attempts/${started.attemptId}`).expect(200))
        .body;
      expect(attempt.questions[1].text).toBe('Arabic is written right to left.');
      await s.agent
        .put(`/api/v1/learn/attempts/${started.attemptId}/answers/${quiz.questions[1]!.id}`)
        .send({ response: true })
        .expect(200);
      const out = (
        await s.agent.post(`/api/v1/learn/attempts/${started.attemptId}/submit`).expect(200)
      ).body;
      expect(
        out.review.find((r: { questionId: string }) => r.questionId === quiz.questions[1]!.id)
          .isCorrect,
      ).toBe(true);
    });

    it('shows correct answers and explanations only when the teacher allowed it', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, { skipShort: true });
      const settings = (await teacherAgent.get(`/api/v1/teach/quizzes/${quiz.id}`).expect(200))
        .body;
      const s = await student(course.id);
      const shown = await takeQuiz(s.agent, quiz.id, answersFor(quiz));
      expect(JSON.stringify(shown.result.review)).toContain('Ta has two dots above.');
      await teacherAgent
        .patch(`/api/v1/teach/quizzes/${quiz.id}`)
        .send({ ...settings, timeLimitMinutes: null, showAnswers: false })
        .expect(200);
      const hidden = await takeQuiz(s.agent, quiz.id, answersFor(quiz));
      const sent = JSON.stringify(hidden.result.review);
      expect(sent).not.toMatch(/Ta has two dots|"correct"|"explanation"|isCorrect/);
    });
  });

  // ── AT-07 / security ────────────────────────────────────────────────────

  describe('access and privacy (AT-07, AT-08)', () => {
    it('refuses without an enrolment, and hides one student’s attempts from another', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, { skipShort: true });
      const outsider = await student();
      const denied = await outsider.agent.get(`/api/v1/learn/quizzes/${quiz.id}`).expect(403);
      expect(denied.body.error.params.reason).toBe('NOT_ENROLLED');
      await outsider.agent.post(`/api/v1/learn/quizzes/${quiz.id}/attempts`).expect(403);

      const owner = await student(course.id);
      const { attemptId } = await takeQuiz(owner.agent, quiz.id, answersFor(quiz));
      const enrolledOther = await student(course.id);
      const attemptUrl = `/api/v1/learn/attempts/${attemptId}`;
      expect((await enrolledOther.agent.get(attemptUrl)).status).toBe(404);
      expect((await enrolledOther.agent.get(`${attemptUrl}/result`)).status).toBe(404);
      expect((await enrolledOther.agent.post(`${attemptUrl}/submit`)).status).toBe(404);
      const put = enrolledOther.agent.put(`${attemptUrl}/answers/${quiz.questions[0]!.id}`);
      expect((await put.send({ response: true })).status).toBe(404);
      await h.client().get(`/api/v1/learn/attempts/${attemptId}`).expect(401);
    });

    it('a quiz needs the course to be open: expired access is refused', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, { skipShort: true });
      const s = await student(course.id);
      await h.prisma.enrolment.updateMany({
        where: { studentId: s.id },
        data: { endAt: new Date(Date.now() - 1000) },
      });
      const res = await s.agent.get(`/api/v1/learn/quizzes/${quiz.id}`).expect(403);
      expect(res.body.error.code).toBe('ACCESS_EXPIRED');
    });
  });

  // ── AT-11 ───────────────────────────────────────────────────────────────

  describe('marking short answers (AT-11)', () => {
    it('waits for the teacher, who marks it; the student then sees score and comment', async () => {
      const { teacherAgent, lessonIds, course } = await setup();
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!);
      const s = await student(course.id);
      const { attemptId } = await takeQuiz(s.agent, quiz.id, answersFor(quiz));

      const queue = (await teacherAgent.get('/api/v1/teach/marking').expect(200)).body;
      const item = queue.items.find((i: { studentName: string; question: { text: string } }) =>
        i.question.text.includes('kitaab'),
      );
      expect(item).toBeTruthy();
      expect(
        (await teacherAgent.get('/api/v1/teach/marking/count').expect(200)).body.count,
      ).toBeGreaterThanOrEqual(1);
      expect(item.question).toMatchObject({ maxMarks: 2, modelAnswer: 'هذا كتاب' });

      await teacherAgent
        .post(`/api/v1/teach/answers/${item.answerId}/mark`)
        .send({ marks: 3 })
        .expect(400);
      await teacherAgent
        .post(`/api/v1/teach/answers/${item.answerId}/mark`)
        .send({ marks: 1.25 })
        .expect(400);
      // A teacher of another course can't mark it.
      const stranger = await setup();
      await stranger.teacherAgent
        .post(`/api/v1/teach/answers/${item.answerId}/mark`)
        .send({ marks: 2 })
        .expect(403);
      await teacherAgent
        .post(`/api/v1/teach/answers/${item.answerId}/mark`)
        .send({ marks: 1.5, comment: 'Good, watch the ending.' })
        .expect(200);

      const result = (await s.agent.get(`/api/v1/learn/attempts/${attemptId}/result`).expect(200))
        .body;
      expect(result.attempt.status).toBe('GRADED');
      expect(result.result).toMatchObject({ score: 4.5, maxScore: 5, scorePct: 90, passed: true });
      expect(result.review.at(-1)).toMatchObject({
        marks: 1.5,
        teacherComment: 'Good, watch the ending.',
      });

      // Changing the mark later is allowed, recalculates, and is logged old → new (FR-REP-003).
      await teacherAgent
        .post(`/api/v1/teach/answers/${item.answerId}/mark`)
        .send({ marks: 0 })
        .expect(200);
      expect(
        (await s.agent.get(`/api/v1/learn/attempts/${attemptId}/result`).expect(200)).body.result
          .scorePct,
      ).toBe(60);
      const log = await h.prisma.auditLog.findFirst({
        where: { entityId: item.answerId, action: 'MARK_CHANGED' },
      });
      expect(log?.details).toMatchObject({ from: 1.5, to: 0 });
    });

    it('a teacher sees only answers from their own courses', async () => {
      const a = await setup();
      const b = await setup();
      const quizB = await buildQuiz(b.teacherAgent, b.lessonIds[0]!);
      const s = await student(b.course.id);
      await takeQuiz(s.agent, quizB.id, answersFor(quizB));
      const seenByA = (await a.teacherAgent.get('/api/v1/teach/marking').expect(200)).body;
      expect(seenByA.items.some((i: { quiz: { id: string } }) => i.quiz.id === quizB.id)).toBe(
        false,
      );
      const seenByB = (await b.teacherAgent.get('/api/v1/teach/marking').expect(200)).body;
      expect(seenByB.items.some((i: { quiz: { id: string } }) => i.quiz.id === quizB.id)).toBe(
        true,
      );
      const admin = await h.makeUser({ role: 'ADMIN' });
      const adminAgent = await h.signIn(admin.phone, admin.password);
      expect(
        (await adminAgent.get('/api/v1/teach/marking').expect(200)).body.items.some(
          (i: { quiz: { id: string } }) => i.quiz.id === quizB.id,
        ),
      ).toBe(true);
      await s.agent.get('/api/v1/teach/marking').expect(403);
    });
  });

  // ── AT-13 ───────────────────────────────────────────────────────────────

  describe('completion and certificates (AT-13)', () => {
    /** A course with a final quiz on the last lesson; the student does every lesson. */
    async function finishCourse(passFinalFirst = false) {
      const { teacherAgent, lessonIds, course } = await setup(3);
      const quiz = await buildQuiz(teacherAgent, lessonIds[2]!, {
        isFinal: true,
        maxAttempts: null,
        skipShort: true,
      });
      const s = await student(course.id);
      const complete = (lessonId: string) =>
        s.agent.post(`/api/v1/learn/lessons/${lessonId}/complete`).expect(200);
      if (passFinalFirst) {
        // The final quiz is passed before the other lessons are done.
        const { result } = await takeQuiz(s.agent, quiz.id, answersFor(quiz));
        expect(result.result.passed).toBe(true);
        const mid = await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } });
        expect(mid.status).toBe('ACTIVE');
        await complete(lessonIds[0]!);
        expect(
          (await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } })).status,
        ).toBe('ACTIVE');
        await complete(lessonIds[1]!);
      } else {
        await complete(lessonIds[0]!);
        await complete(lessonIds[1]!);
        // Every lesson but the quiz one is done: still not complete, the final quiz is waiting.
        const waiting = await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } });
        expect(waiting).toMatchObject({ status: 'ACTIVE', progressPct: 66 });
        await s.agent.post(`/api/v1/learn/lessons/${lessonIds[2]}/complete`).expect(400);
        const failed = await takeQuiz(
          s.agent,
          quiz.id,
          answersFor(quiz, ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK']),
        );
        expect(failed.result.result.passed).toBe(false);
        expect(
          (await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } })).status,
        ).toBe('ACTIVE');
        const { result } = await takeQuiz(s.agent, quiz.id, answersFor(quiz));
        expect(result.result.passed).toBe(true);
        expect(result.courseCompleted).toBe(true);
      }
      return { s, course, quiz, lessonIds };
    }

    it('finishing every lesson and passing the final quiz completes the course', async () => {
      const { s } = await finishCourse();
      const done = await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } });
      expect(done).toMatchObject({ status: 'COMPLETED', progressPct: 100 });
    });

    it('works in either order: final passed first, last lesson finished later', async () => {
      const { s } = await finishCourse(true);
      expect(
        (await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } })).status,
      ).toBe('COMPLETED');
    });

    it('nothing is issued until the student confirms the name and an admin approves it', async () => {
      const { s, course } = await finishCourse();
      const admin = await h.makeUser({ role: 'ADMIN' });
      const adminAgent = await h.signIn(admin.phone, admin.password);

      // Finishing the course opens a request; no certificate exists yet.
      let mine = (await s.agent.get('/api/v1/me/certificates').expect(200)).body;
      expect(mine.items).toHaveLength(0);
      expect(mine.requests).toHaveLength(1);
      const request = mine.requests[0];
      expect(request).toMatchObject({
        status: 'AWAITING_NAME',
        courseTitle: `Course ${course.slug}`,
        nameOnCertificate: null,
        suggestedName: 'Test STUDENT',
      });
      // Asking again never opens a second one.
      expect((await s.agent.get('/api/v1/me/certificates').expect(200)).body.requests).toHaveLength(
        1,
      );
      expect(await h.prisma.certificate.count({ where: { studentId: s.id } })).toBe(0);

      // The admin can't approve before the student has confirmed the name.
      await adminAgent
        .post(`/api/v1/admin/certificate-requests/${request.id}/approve`)
        .send({})
        .expect(409);

      // The name is checked, and someone else can't change it.
      const nameUrl = `/api/v1/me/certificates/requests/${request.id}/name`;
      await s.agent.put(nameUrl).send({ nameOnCertificate: 'x' }).expect(400);
      await s.agent.put(nameUrl).send({ nameOnCertificate: '<b>Hacker</b>' }).expect(400);
      const other = await student();
      await other.agent.put(nameUrl).send({ nameOnCertificate: 'Someone Else' }).expect(404);
      const sent = await s.agent
        .put(nameUrl)
        .send({ nameOnCertificate: '  Beimnet   Tadese ' })
        .expect(200);
      expect(sent.body).toMatchObject({
        status: 'AWAITING_APPROVAL',
        nameOnCertificate: 'Beimnet Tadese',
      });

      // The admin sees it in the queue, and sends it back with a note.
      const queue = await adminAgent
        .get('/api/v1/admin/certificate-requests')
        .query({ status: 'AWAITING_APPROVAL', pageSize: 50 })
        .expect(200);
      expect(queue.body.counts.AWAITING_APPROVAL).toBeGreaterThanOrEqual(1);
      expect(
        (await adminAgent.get('/api/v1/admin/certificate-requests/count').expect(200)).body.count,
      ).toBeGreaterThanOrEqual(1);
      await adminAgent
        .post(`/api/v1/admin/certificate-requests/${request.id}/return`)
        .send({})
        .expect(400);
      await adminAgent
        .post(`/api/v1/admin/certificate-requests/${request.id}/return`)
        .send({ note: 'Please check the spelling of your surname.' })
        .expect(200);
      mine = (await s.agent.get('/api/v1/me/certificates').expect(200)).body;
      expect(mine.requests[0]).toMatchObject({
        status: 'RETURNED',
        adminNote: 'Please check the spelling of your surname.',
        suggestedName: 'Beimnet Tadese',
      });

      // The student fixes it; the admin corrects one more detail and approves.
      await s.agent.put(nameUrl).send({ nameOnCertificate: 'Beimnet Tadesse' }).expect(200);
      const approved = await adminAgent
        .post(`/api/v1/admin/certificate-requests/${request.id}/approve`)
        .send({ nameOnCertificate: 'Beimnet T. Tadesse' })
        .expect(200);
      expect(approved.body.certificate.number).toMatch(/^NLC-\d{4}-\d{5}$/);
      // Approving twice, or changing the name afterwards, is refused.
      await adminAgent
        .post(`/api/v1/admin/certificate-requests/${request.id}/approve`)
        .send({})
        .expect(409);
      await s.agent.put(nameUrl).send({ nameOnCertificate: 'Another Name' }).expect(409);
      expect(
        await h.prisma.auditLog.count({
          where: {
            entityId: approved.body.certificate.id,
            action: 'CERTIFICATE_ISSUED',
            actorId: admin.id,
          },
        }),
      ).toBe(1);

      mine = (await s.agent.get('/api/v1/me/certificates').expect(200)).body;
      expect(mine.requests).toHaveLength(0);
      expect(mine.items).toHaveLength(1);
      const cert = mine.items[0];
      expect(cert).toMatchObject({
        number: approved.body.certificate.number,
        nameOnCertificate: 'Beimnet T. Tadesse',
        courseTitle: `Course ${course.slug}`,
      });

      const pdf = await s.agent
        .get(cert.pdfUrl)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');

      const valid = await h.client().get(`/api/v1/public/certificates/${cert.number}`).expect(200);
      expect(valid.body).toMatchObject({
        status: 'VALID',
        studentName: 'Beimnet T. Tadesse',
        courseTitle: cert.courseTitle,
      });

      // Another student can't download it.
      await other.agent.get(cert.pdfUrl).expect(404);

      await adminAgent.post(`/api/v1/admin/certificates/${cert.id}/cancel`).send({}).expect(400);
      await adminAgent
        .post(`/api/v1/admin/certificates/${cert.id}/cancel`)
        .send({ reason: 'Obtained unfairly' })
        .expect(200);
      await adminAgent
        .post(`/api/v1/admin/certificates/${cert.id}/cancel`)
        .send({ reason: 'Again' })
        .expect(409);
      expect(
        (await h.client().get(`/api/v1/public/certificates/${cert.number}`).expect(200)).body,
      ).toEqual({ status: 'CANCELLED', number: cert.number });
      expect(
        await h.prisma.auditLog.count({
          where: { entityId: cert.id, action: 'CERTIFICATE_CANCELLED' },
        }),
      ).toBe(1);
      // The student can no longer download a cancelled certificate, and it is listed as cancelled.
      await s.agent.get(cert.pdfUrl).expect(404);
      expect((await s.agent.get('/api/v1/me/certificates').expect(200)).body.items[0].status).toBe(
        'CANCELLED',
      );
      await s.agent.get('/api/v1/admin/certificates').expect(403);
      const found = await adminAgent
        .get('/api/v1/admin/certificates')
        .query({ q: cert.number })
        .expect(200);
      expect(found.body.items[0]).toMatchObject({
        number: cert.number,
        status: 'CANCELLED',
        cancelReason: 'Obtained unfairly',
      });
    });

    it('two certificates approved at the same moment get different, consecutive numbers', async () => {
      const first = await finishCourse();
      const second = await finishCourse();
      const admin = await h.makeUser({ role: 'ADMIN' });
      const adminAgent = await h.signIn(admin.phone, admin.password);
      const enrolments = await h.prisma.enrolment.findMany({
        where: { studentId: { in: [first.s.id, second.s.id] } },
        select: { id: true },
      });
      // Opening the same request twice at once still gives one.
      await Promise.all([
        certificates.openRequest(enrolments[0]!.id),
        certificates.openRequest(enrolments[0]!.id),
        certificates.openRequest(enrolments[1]!.id),
      ]);
      const requests = await h.prisma.certificateRequest.findMany({
        where: { enrolmentId: { in: enrolments.map((e) => e.id) } },
      });
      expect(requests).toHaveLength(2);
      for (const [index, who] of [first, second].entries()) {
        const mine = requests.find((r) => r.studentId === who.s.id)!;
        await who.s.agent
          .put(`/api/v1/me/certificates/requests/${mine.id}/name`)
          .send({ nameOnCertificate: `Student Number ${index + 1}` })
          .expect(200);
      }
      const results = await Promise.all(
        requests.map((r) =>
          adminAgent.post(`/api/v1/admin/certificate-requests/${r.id}/approve`).send({}),
        ),
      );
      expect(results.map((r) => r.status)).toEqual([200, 200]);
      const nums = results
        .map((r) => Number((r.body.certificate.number as string).slice(-5)))
        .sort((a, b) => a - b);
      expect(nums[1]! - nums[0]!).toBe(1);

      // A double click on Approve issues one certificate.
      const third = await finishCourse();
      const thirdEnrolment = await h.prisma.enrolment.findFirstOrThrow({
        where: { studentId: third.s.id },
      });
      await certificates.openRequest(thirdEnrolment.id);
      const thirdRequest = await h.prisma.certificateRequest.findUniqueOrThrow({
        where: { enrolmentId: thirdEnrolment.id },
      });
      await third.s.agent
        .put(`/api/v1/me/certificates/requests/${thirdRequest.id}/name`)
        .send({ nameOnCertificate: 'Student Number Three' })
        .expect(200);
      const twice = await Promise.all([
        adminAgent.post(`/api/v1/admin/certificate-requests/${thirdRequest.id}/approve`).send({}),
        adminAgent.post(`/api/v1/admin/certificate-requests/${thirdRequest.id}/approve`).send({}),
      ]);
      expect(twice.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await h.prisma.certificate.count({ where: { enrolmentId: thirdEnrolment.id } })).toBe(
        1,
      );
    });

    it('hiding a lesson changes progress but keeps quiz results', async () => {
      const { teacherAgent, lessonIds, course } = await setup(3);
      const quiz = await buildQuiz(teacherAgent, lessonIds[0]!, { skipShort: true });
      const s = await student(course.id);
      const { attemptId } = await takeQuiz(s.agent, quiz.id, answersFor(quiz));
      // Passing the lesson quiz completed the lesson.
      expect(
        (await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } })).progressPct,
      ).toBe(33);
      await h.prisma.lesson.update({ where: { id: lessonIds[2]! }, data: { status: 'HIDDEN' } });
      await h.app
        .get((await import('../enrolments/progress.service')).ProgressService)
        .recalcCourse(course.id);
      expect(
        (await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } })).progressPct,
      ).toBe(50);
      expect(
        (await s.agent.get(`/api/v1/learn/attempts/${attemptId}/result`).expect(200)).body.result
          .passed,
      ).toBe(true);
    });
  });

  describe('certificate settings', () => {
    it('admins set the signatory; teachers and students cannot', async () => {
      const admin = await h.makeUser({ role: 'ADMIN' });
      const adminAgent = await h.signIn(admin.phone, admin.password);
      await adminAgent
        .put('/api/v1/admin/settings/certificate')
        .send({ signatoryName: 'A', signatoryTitle: '' })
        .expect(400);
      await adminAgent
        .put('/api/v1/admin/settings/certificate')
        .send({ signatoryName: 'Ustaz Abdurahman', signatoryTitle: 'Director' })
        .expect(200);
      const res = await adminAgent.get('/api/v1/admin/settings/certificate').expect(200);
      expect(res.body).toMatchObject({
        signatoryName: 'Ustaz Abdurahman',
        signatoryTitle: 'Director',
        signatureUrl: null,
      });
      const s = await student();
      await s.agent.get('/api/v1/admin/settings/certificate').expect(403);
    });

    it('admins can preview the certificate design as a PDF; students cannot', async () => {
      const admin = await h.makeUser({ role: 'ADMIN' });
      const adminAgent = await h.signIn(admin.phone, admin.password);
      const pdf = await adminAgent
        .get('/api/v1/admin/settings/certificate/preview')
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(pdf.headers['content-disposition']).toContain('inline');
      expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      const s = await student();
      await s.agent.get('/api/v1/admin/settings/certificate/preview').expect(403);
    });
  });
});
