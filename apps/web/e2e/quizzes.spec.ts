import {
  type APIRequestContext,
  expect,
  type Page,
  type PlaywrightWorkerArgs,
  test,
} from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  SEED,
  signInAs,
  joinCourse,
  newContact,
} from './helpers';

/** A real PNG, used as the course cover (a course needs a picture to be published). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

/** An admin API session, separate from the page (so the page can stay signed in as someone else). */
async function adminApi(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string) {
  const api = await playwright.request.newContext({ baseURL });
  const res = await api.post('/api/v1/auth/sign-in', { data: SEED.owner });
  expect(res.ok(), `admin sign-in failed: ${res.status()}`).toBe(true);
  return api;
}

async function ok<T>(
  res: { ok(): boolean; status(): number; text(): Promise<string>; json(): Promise<unknown> },
  what: string,
): Promise<T> {
  expect(res.ok(), `${what}: ${res.status()} ${await res.text()}`).toBe(true);
  return (await res.json()) as T;
}

interface Built {
  courseId: string;
  slug: string;
  title: string;
  lessonIds: string[];
}

/** A published free course with the given number of text lessons, assigned to the seed teacher. */
async function buildCourse(api: APIRequestContext, lessons = 2): Promise<Built> {
  const languages = await ok<{ items: { id: string; code: string }[] }>(
    await api.get('/api/v1/admin/languages'),
    'languages',
  );
  const levels = await ok<{ items: { id: string }[] }>(
    await api.get('/api/v1/admin/levels'),
    'levels',
  );
  const teachers = await ok<{ items: { id: string; fullName: string }[] }>(
    await api.get('/api/v1/admin/courses/teachers'),
    'teachers',
  );
  const image = await ok<{ id: string }>(
    await api.post('/api/v1/files', {
      multipart: {
        purpose: 'COURSE_IMAGE',
        file: { name: 'cover.png', mimeType: 'image/png', buffer: PNG },
      },
    }),
    'cover',
  );
  const title = `Quiz course ${unique()}`;
  const course = await ok<{ id: string; slug: string }>(
    await api.post('/api/v1/admin/courses', {
      data: {
        title,
        languageId: languages.items[0]!.id,
        levelId: levels.items[0]!.id,
        summary: 'A course made by the browser tests to try quizzes.',
        outcomes: ['Try a quiz'],
        access: 'FREE',
        accessDays: 90,
        // All sessions are in: the course can be completed.
        ongoing: false,
        imageFileId: image.id,
      },
    }),
    'course',
  );
  const teacher = teachers.items.find((t) => t.fullName === 'Ustaz Ahmed') ?? teachers.items[0]!;
  await ok(
    await api.put(`/api/v1/admin/courses/${course.id}/teachers`, {
      data: { teacherIds: [teacher.id] },
    }),
    'teachers',
  );
  const unit = await ok<{ id: string }>(
    await api.post(`/api/v1/teach/courses/${course.id}/units`, { data: { title: 'Unit 1' } }),
    'unit',
  );
  const lessonIds: string[] = [];
  for (let i = 1; i <= lessons; i++) {
    const lesson = await ok<{ id: string }>(
      await api.post(`/api/v1/teach/units/${unit.id}/lessons`, { data: { title: `Lesson ${i}` } }),
      'lesson',
    );
    await ok(
      await api.post(`/api/v1/teach/lessons/${lesson.id}/blocks`, {
        data: {
          type: 'TEXT',
          textJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: `Body ${i}` }] }],
          },
        },
      }),
      'block',
    );
    await ok(await api.post(`/api/v1/teach/lessons/${lesson.id}/publish`), 'publish lesson');
    lessonIds.push(lesson.id);
  }
  await ok(await api.post(`/api/v1/teach/units/${unit.id}/publish`), 'publish unit');
  await ok(await api.post(`/api/v1/admin/courses/${course.id}/publish`), 'publish course');
  return { courseId: course.id, slug: course.slug, title, lessonIds };
}

/** A published final quiz: multiple choice (ت is right), true/false (true), fill-in (kitaab), short answer (2 marks). */
async function buildQuiz(
  api: APIRequestContext,
  lessonId: string,
  options: { isFinal?: boolean; minutes?: number | null } = {},
) {
  const quiz = await ok<{ id: string }>(
    await api.post(`/api/v1/teach/lessons/${lessonId}/quiz`, {
      data: { title: 'Short vowels', isFinal: options.isFinal ?? false },
    }),
    'quiz',
  );
  const add = async (data: Record<string, unknown>) =>
    ok(await api.post(`/api/v1/teach/quizzes/${quiz.id}/questions`, { data }), 'question');
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
    text: 'The Arabic word for book, written in Latin letters, is ____.',
    acceptedAnswers: ['kitaab'],
  });
  await add({
    type: 'SHORT_ANSWER',
    text: 'Write a sentence with the word book.',
    marks: 2,
    modelAnswer: 'هذا كتاب',
  });
  if (options.minutes !== undefined) {
    const detail = await ok<{
      title: string;
      isFinal: boolean;
      passMarkPct: number;
      maxAttempts: number | null;
    }>(await api.get(`/api/v1/teach/quizzes/${quiz.id}`), 'quiz settings');
    await ok(
      await api.patch(`/api/v1/teach/quizzes/${quiz.id}`, {
        data: {
          title: detail.title,
          instructions: '',
          isFinal: detail.isFinal,
          passMarkPct: detail.passMarkPct,
          maxAttempts: null,
          timeLimitMinutes: options.minutes,
          showAnswers: true,
        },
      }),
      'quiz settings',
    );
  }
  await ok(await api.post(`/api/v1/teach/quizzes/${quiz.id}/publish`), 'publish quiz');
  return quiz.id;
}

async function registerStudent(page: Page) {
  const name = `E2E Quiz ${unique()}`;
  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      fullName: name,
      ...newContact(),
      password: 'Passw0rd123',
      acceptTerms: true,
      confirmAge: true,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return name;
}

/** Answers the four questions of buildQuiz on the page, moving with Next. */
async function answerAll(page: Page, options: { short?: string } = {}) {
  await page.getByRole('radio', { name: 'ت' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  // The real radio is visually hidden behind its big label, so it is ticked directly.
  await page.getByRole('radio', { name: 'True', exact: true }).check({ force: true });
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'Type your answer' }).fill('  Kitaab ');
  await page.getByRole('button', { name: 'Next' }).click();
  await page
    .getByRole('textbox', { name: 'Write your answer' })
    .fill(options.short ?? 'هذا كتاب جميل');
}

test.describe('building a quiz (FR-QUIZ-001…004)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The builder is tried on a desktop.');
  });

  test('a teacher adds a quiz with all four question types, previews and publishes it', async ({
    page,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const admin = await adminApi(playwright, baseURL!);
    const course = await buildCourse(admin, 1);
    await admin.dispose();

    await signInAs(page, SEED.teacher);
    await page.goto(`/teach/courses/${course.courseId}/lessons/${course.lessonIds[0]}`);
    await page.getByRole('button', { name: 'Add quiz' }).click();
    await page.getByRole('dialog').getByLabel('Quiz name').fill('Short vowels');
    await page.getByRole('dialog').getByRole('button', { name: 'Add quiz' }).click();
    await expect(page).toHaveURL(/\/teach\/quizzes\//);
    await expect(page.getByRole('heading', { level: 1, name: 'Short vowels' })).toBeVisible();
    // Nothing to publish yet.
    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();

    const addQuestion = async (type: string) => {
      await page.getByRole('button', { name: 'Add question' }).first().click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: new RegExp(`^${type}`) })
        .click();
    };
    const dialog = page.getByRole('dialog');

    await addQuestion('Multiple choice');
    await dialog.getByLabel('Question', { exact: true }).fill('Which letter is "ta"?');
    await dialog.getByPlaceholder('Option 1').fill('ب');
    await dialog.getByPlaceholder('Option 2').fill('ت');
    await dialog.getByPlaceholder('Option 3').fill('ث');
    await dialog.getByRole('radio', { name: 'Correct option 2' }).check();
    await dialog.getByRole('button', { name: 'Save question' }).click();
    await expect(page.getByText('Question saved')).toBeVisible();

    await addQuestion('True / False');
    await dialog.getByLabel('Question', { exact: true }).fill('Arabic is written right to left.');
    await dialog.getByRole('button', { name: 'Save question' }).click();

    await addQuestion('Fill in the blank');
    await dialog.getByLabel('Question', { exact: true }).fill('The word for book is ____.');
    await dialog.getByPlaceholder('Accepted answer 1').fill('kitaab');
    await dialog.getByRole('button', { name: 'Add another answer' }).click();
    await dialog.getByPlaceholder('Accepted answer 2').fill('كتاب');
    await dialog.getByRole('button', { name: 'Save question' }).click();

    await addQuestion('Short answer');
    await dialog.getByLabel('Question', { exact: true }).fill('Write a sentence with "kitaab".');
    await dialog.getByLabel('Marks').fill('2');
    await dialog.getByRole('button', { name: 'Save question' }).click();

    await expect(page.getByRole('heading', { name: 'Questions (4)' })).toBeVisible();
    await expect(page.getByText('Total: 5 marks')).toBeVisible();
    await expectNoSeriousA11yIssues(page);

    // Mistakes in a question are explained on the field.
    await page.getByRole('button', { name: 'Add question' }).first().click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Fill in the blank/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save question' }).click();
    await expect(page.getByText('Write the question.')).toBeVisible();
    await page.keyboard.press('Escape');

    // Preview: nothing is saved.
    await page.getByRole('link', { name: 'Preview' }).click();
    await expect(page.getByText('Nothing is saved')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Which letter is "ta"?' })).toBeVisible();
    await page.getByRole('radio', { name: 'ت' }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Review' }).click();
    await page.getByRole('button', { name: 'Submit answers' }).click();
    await expect(page.getByText(/end of the preview/)).toBeVisible();

    await page.getByRole('link', { name: 'Back to quiz builder' }).last().click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Quiz published')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hide' })).toBeVisible();
  });
});

test.describe('taking a quiz (AT-10, AT-11, AT-13)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['phone-320', 'desktop'].includes(testInfo.project.name),
      'The student journey runs on the smallest phone and on a desktop.',
    );
  });

  test('answer on a phone, wait for marking, pass, finish the course, and verify the certificate', async ({
    page,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const admin = await adminApi(playwright, baseURL!);
    const course = await buildCourse(admin, 2);
    const quizId = await buildQuiz(admin, course.lessonIds[1]!, { isFinal: true });
    const studentName = await registerStudent(page);

    await joinCourse(page, course.courseId);
    await page.goto(`/learn/${course.slug}/lessons/${course.lessonIds[0]}`);
    await page.getByRole('button', { name: 'Mark as complete' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Completed' })).toBeVisible();

    // The lesson with the quiz points to the quiz instead of "Mark as complete".
    await page.goto(`/learn/${course.slug}/lessons/${course.lessonIds[1]}`);
    await expect(page.getByRole('button', { name: 'Mark as complete' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Take the quiz' }).click();
    await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Short vowels' })).toBeVisible();
    await expect(page.getByText('4 questions')).toBeVisible();
    await expect(page.getByText('Pass mark 70%')).toBeVisible();
    await expect(page.getByText('This is the final quiz for the course.')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await page.getByRole('button', { name: 'Start quiz' }).click();
    await expect(page.getByText('1 of 4')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    await answerAll(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Review lists what is left, then submit.
    await page.getByRole('button', { name: 'Review' }).click();
    await expect(page.getByText('4 of 4 answered')).toBeVisible();
    await page.getByRole('button', { name: 'Submit answers' }).click();

    // The short answer needs the teacher, so there is no score yet.
    await expect(page.getByRole('heading', { name: 'Waiting for teacher marking' })).toBeVisible();
    await expectNoSeriousA11yIssues(page);

    // The teacher marks it.
    const queue = await ok<{ items: { answerId: string; studentName: string }[] }>(
      await admin.get('/api/v1/teach/marking'),
      'queue',
    );
    const waiting = queue.items.find((i) => i.studentName === studentName);
    expect(waiting, 'the answer is in the marking queue').toBeTruthy();
    await ok(
      await admin.post(`/api/v1/teach/answers/${waiting!.answerId}/mark`, {
        data: { marks: 2, comment: 'Well done.' },
      }),
      'mark',
    );

    // The student sees the score and the comment, and the course is complete.
    await page.goto(`/learn/${course.slug}/quiz/${quizId}/attempts`);
    await expect(page.getByText('100%', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Open' }).click();
    await expect(page.getByRole('heading', { name: 'You passed!' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Course complete!' })).toBeVisible();
    await page.getByRole('button', { name: 'Review answers' }).click();
    await expect(page.getByText('Well done.')).toBeVisible();
    await expect(page.getByText('Ta has two dots above.')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // Nothing is issued yet: the student confirms the name to print, then an admin approves it.
    await expect(page.getByRole('link', { name: 'Get my certificate' })).toBeVisible();
    await page.goto('/certificates');
    await expect(page.getByRole('heading', { level: 2, name: course.title })).toBeVisible();
    await expect(page.getByText('Confirm your name', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Name on the certificate')).toHaveValue(studentName);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    const printedName = `${studentName} Tadesse`;
    await page.getByLabel('Name on the certificate').fill(printedName);
    await page.getByRole('button', { name: 'Send for approval' }).click();
    await expect(page.getByText('Waiting for approval')).toBeVisible();
    await expect(page.getByText(printedName)).toBeVisible();
    await expect(page.getByRole('link', { name: /Download PDF for/ })).toHaveCount(0);

    const requests = await ok<{ items: { id: string; profileName: string }[] }>(
      await admin.get('/api/v1/admin/certificate-requests?status=AWAITING_APPROVAL&pageSize=50'),
      'requests',
    );
    const mine = requests.items.find((r) => r.profileName === studentName);
    expect(mine, 'the certificate waits for the admin').toBeTruthy();
    await ok(
      await admin.post(`/api/v1/admin/certificate-requests/${mine!.id}/approve`, { data: {} }),
      'approve',
    );

    // The certificate: listed, downloadable as a PDF, and valid on the public page.
    await page.goto('/certificates');
    await expect(page.getByRole('heading', { level: 2, name: course.title })).toBeVisible();
    const number = (await page.getByText(/Number NLC-\d{4}-\d{5}/).innerText()).match(
      /NLC-\d{4}-\d{5}/,
    )![0];
    const href = await page.getByRole('link', { name: /Download PDF for/ }).getAttribute('href');
    const pdf = await page.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    await page.context().clearCookies();
    await page.goto(`/verify?n=${number}`);
    await expect(page.getByRole('heading', { name: 'Valid certificate' })).toBeVisible();
    await expect(page.getByText(printedName)).toBeVisible();

    // Cancelled by an admin → the public page says so.
    const list = await ok<{ items: { id: string; number: string }[] }>(
      await admin.get(`/api/v1/admin/certificates?q=${number}`),
      'certificates',
    );
    await ok(
      await admin.post(`/api/v1/admin/certificates/${list.items[0]!.id}/cancel`, {
        data: { reason: 'Test finished' },
      }),
      'cancel',
    );
    await page.goto(`/verify?n=${number}`);
    await expect(page.getByText('This certificate was cancelled.')).toBeVisible();
    await admin.dispose();
  });

  test('answers saved offline are kept and sent when the connection returns (FR-QUIZ-006)', async ({
    page,
    context,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const admin = await adminApi(playwright, baseURL!);
    const course = await buildCourse(admin, 1);
    const quizId = await buildQuiz(admin, course.lessonIds[0]!);
    await admin.dispose();
    await registerStudent(page);
    await joinCourse(page, course.courseId);

    await page.goto(`/learn/${course.slug}/quiz/${quizId}`);
    await page.getByRole('button', { name: 'Start quiz' }).click();
    await expect(page.getByText('1 of 4')).toBeVisible();

    await context.setOffline(true);
    await page.getByRole('radio', { name: 'ت' }).check();
    await expect(page.getByText(/You're offline/)).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText(/You're offline/)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Leave and come back: the quiz resumes with the answer still there.
    await page.goto(`/learn/${course.slug}/quiz/${quizId}`);
    await page.getByRole('button', { name: 'Continue quiz' }).click();
    await expect(page.getByRole('radio', { name: 'ت' })).toBeChecked();
  });

  test('when time runs out the saved answers are submitted (FR-QUIZ-007)', async ({
    page,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    const admin = await adminApi(playwright, baseURL!);
    const course = await buildCourse(admin, 1);
    const quizId = await buildQuiz(admin, course.lessonIds[0]!, { minutes: 1 });
    await admin.dispose();
    await registerStudent(page);
    await joinCourse(page, course.courseId);

    await page.goto(`/learn/${course.slug}/quiz/${quizId}`);
    await expect(page.getByText('1 minute')).toBeVisible();
    await page.getByRole('button', { name: 'Start quiz' }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    await page.getByRole('radio', { name: 'ت' }).check();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    // One minute later the page submits by itself.
    await expect(
      page.getByText('Time is up. Your saved answers were submitted.').first(),
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByRole('heading', { name: 'Not passed this time' })).toBeVisible();
  });
});

test.describe('marking and certificates screens (desktop)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'The teacher and admin screens are tried on a desktop.',
    );
  });

  test('a teacher marks a short answer; an admin approves, then finds and cancels the certificate', async ({
    page,
    playwright,
    baseURL,
  }) => {
    test.setTimeout(240_000);
    const admin = await adminApi(playwright, baseURL!);
    const course = await buildCourse(admin, 1);
    const quizId = await buildQuiz(admin, course.lessonIds[0]!, { isFinal: true });
    const studentName = await registerStudent(page);
    await joinCourse(page, course.courseId);
    const started = await ok<{ attemptId: string }>(
      await page.request.post(`/api/v1/learn/quizzes/${quizId}/attempts`),
      'start',
    );
    const attempt = await ok<{
      questions: { id: string; type: string; options?: { id: string; text: string }[] }[];
    }>(await page.request.get(`/api/v1/learn/attempts/${started.attemptId}`), 'attempt');
    for (const q of attempt.questions) {
      const response =
        q.type === 'MULTIPLE_CHOICE'
          ? q.options!.find((o) => o.text === 'ت')!.id
          : q.type === 'TRUE_FALSE'
            ? true
            : q.type === 'FILL_BLANK'
              ? 'kitaab'
              : 'هذا كتاب جميل';
      await ok(
        await page.request.put(`/api/v1/learn/attempts/${started.attemptId}/answers/${q.id}`, {
          data: { response },
        }),
        'answer',
      );
    }
    await ok(
      await page.request.post(`/api/v1/learn/attempts/${started.attemptId}/submit`),
      'submit',
    );

    // The student's own session, kept to confirm the certificate name later.
    const studentApi = await playwright.request.newContext({
      baseURL,
      storageState: await page.context().storageState(),
    });

    // The teacher marks it in the queue.
    await page.context().clearCookies();
    await signInAs(page, SEED.teacher);
    await page.goto('/teach/marking');
    await expect(page.getByRole('heading', { level: 1, name: 'Marking' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Course' }).selectOption({ label: course.title });
    await expect(page.getByText(`From ${studentName}`)).toBeVisible();
    await expect(page.getByText('هذا كتاب جميل')).toBeVisible();
    await expect(page.getByText('Model answer')).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    await page.getByRole('button', { name: 'Save & next' }).click();
    await expect(page.getByText(/Scores? ?0 to 2|0 to 2/).first()).toBeVisible();
    await page.getByLabel('Score').fill('2');
    await page.getByLabel('Comment').fill('Excellent!');
    await page.getByRole('button', { name: 'Save & next' }).click();
    await expect(page.getByText('Mark saved')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nothing to mark' })).toBeVisible();

    // The student's attempts list shows the teacher the score and gives a way to add an attempt.
    await page.goto(`/teach/courses/${course.courseId}/students`);
    await expect(page.getByText(studentName)).toBeVisible();
    await page.getByRole('link', { name: 'Quiz attempts' }).click();
    await expect(page.getByText('100%', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Give one extra attempt' }).click();
    await page.getByRole('button', { name: 'Give attempt' }).click();
    await expect(page.getByText('One extra attempt given')).toBeVisible();

    // The course is complete; the student confirms the name to print.
    const mine = await ok<{ requests: { id: string }[] }>(
      await studentApi.get('/api/v1/me/certificates'),
      'my certificates',
    );
    expect(mine.requests).toHaveLength(1);
    await ok(
      await studentApi.put(`/api/v1/me/certificates/requests/${mine.requests[0]!.id}/name`, {
        data: { nameOnCertificate: studentName },
      }),
      'confirm name',
    );
    await studentApi.dispose();

    // The admin finds it under "To approve", corrects the name and sends it.
    await page.context().clearCookies();
    await signInAs(page, SEED.owner);
    await page.goto('/admin/certificates');
    await expect(page.getByRole('link', { name: /^To approve/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const waitingCard = page.locator('li', { hasText: studentName }).first();
    await expect(waitingCard).toBeVisible({ timeout: 20_000 });
    await expectNoSeriousA11yIssues(page);
    await waitingCard.getByRole('button', { name: 'Approve and send' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Name on the certificate')).toHaveValue(studentName);
    await dialog.getByLabel('Name on the certificate').fill(`${studentName} Approved`);
    await dialog.getByRole('button', { name: 'Approve and send' }).click();
    await expect(page.getByText(/Certificate NLC-\d{4}-\d{5} sent to the student/)).toBeVisible();
    await expect(page.locator('li', { hasText: studentName })).toHaveCount(0);

    // Under "Issued" it can be found and cancelled.
    await page.getByRole('link', { name: /^Issued/ }).click();
    await expect(page).toHaveURL(/view=issued/);
    await page.getByRole('searchbox', { name: /Search by/ }).fill(studentName);
    await page.keyboard.press('Enter');
    const card = page.locator('li', { hasText: `${studentName} Approved` }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expectNoSeriousA11yIssues(page);
    await card.getByRole('button', { name: 'Cancel certificate' }).click();
    await page.getByRole('button', { name: 'Cancel certificate' }).last().click();
    await expect(page.getByText('Please give a reason.')).toBeVisible();
    await page.getByLabel('Reason').fill('Test finished');
    await page.getByRole('button', { name: 'Cancel certificate' }).last().click();
    await expect(page.getByText('Certificate cancelled')).toBeVisible();

    // The signatory settings page works too.
    await page.goto('/admin/settings/certificate');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Certificate signatory' }),
    ).toBeVisible();
    await page.getByLabel('Name').fill('Natik Language Centre');
    await expectNoSeriousA11yIssues(page);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await admin.dispose();
  });
});
