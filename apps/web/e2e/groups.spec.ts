import path from 'node:path';
import { expect, type Page, request, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  newPhone,
  SEED,
  signInAs,
  waitForPageReady,
  emailFor,
} from './helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const SHOTS = path.resolve(__dirname, '../../../docs/test-screenshots/course-groups');

/** Each course has a group chat: its accepted students, its teachers and the admins. */
test.describe('course groups', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['desktop', 'mobile'].includes(testInfo.project.name),
      'one phone and one desktop size',
    );
  });

  test('students and the teacher talk in the course group, Telegram style', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const shot = async (name: string) => {
      await waitForPageReady(page);
      await page.screenshot({
        path: path.join(SHOTS, testInfo.project.name, `${name}.png`),
        animations: 'disabled',
      });
    };

    // ── Set up: a course with the sample teacher, and two accepted students ─────────────────
    const admin = await request.newContext({ baseURL: baseURL! });
    expect((await admin.post('/api/v1/auth/sign-in', { data: SEED.owner })).ok()).toBe(true);
    const languages = (await (await admin.get('/api/v1/admin/languages')).json()) as {
      items: { id: string }[];
    };
    const levels = (await (await admin.get('/api/v1/admin/levels')).json()) as {
      items: { id: string }[];
    };
    const cover = (await (
      await admin.post('/api/v1/files', {
        multipart: {
          purpose: 'COURSE_IMAGE',
          file: { name: 'cover.png', mimeType: 'image/png', buffer: PNG },
        },
      })
    ).json()) as { id: string };
    const title = `Journey course group ${testInfo.project.name} ${stamp}`;
    const course = (await (
      await admin.post('/api/v1/admin/courses', {
        data: {
          title,
          languageId: languages.items[0]!.id,
          levelId: levels.items[0]!.id,
          summary: 'A free course to try the group chat.',
          outcomes: [],
          access: 'FREE',
          imageFileId: cover.id,
        },
      })
    ).json()) as { id: string };
    const teachers = (await (await admin.get('/api/v1/admin/users?q=Ustaz')).json()) as {
      items: { id: string }[];
    };
    await admin.put(`/api/v1/admin/courses/${course.id}/teachers`, {
      data: { teacherIds: [teachers.items[0]!.id] },
    });
    expect((await admin.post(`/api/v1/admin/courses/${course.id}/publish`)).ok()).toBe(true);

    async function newStudent(name: string) {
      const api = await request.newContext({ baseURL: baseURL! });
      const phone = newPhone();
      const res = await api.post('/api/v1/auth/register', {
        data: {
          fullName: name,
          phone,
          email: emailFor(phone),
          password: 'Passw0rd123',
          acceptTerms: true,
          confirmAge: true,
        },
      });
      expect(res.status()).toBe(201);
      const asked = (await (await api.post(`/api/v1/courses/${course.id}/enrol`)).json()) as {
        id: string;
        status: string;
      };
      expect(asked.status).toBe('AWAITING_APPROVAL');
      return { api, phone, requestId: asked.id, name };
    }
    const sara = await newStudent(`Sara Group ${stamp}`);
    const abel = await newStudent(`Abel Group ${stamp}`);

    // Not accepted yet: the group isn't there for them.
    expect((await sara.api.get(`/api/v1/groups/${course.id}`)).status()).toBe(404);
    await admin.post(`/api/v1/admin/enrolments/${sara.requestId}/approve`);
    await admin.post(`/api/v1/admin/enrolments/${abel.requestId}/approve`);

    // ── Abel and the teacher write through the API; Sara opens the group in the browser ─────
    const teacherApi = await request.newContext({ baseURL: baseURL! });
    expect((await teacherApi.post('/api/v1/auth/sign-in', { data: SEED.teacher })).ok()).toBe(true);
    const speak = (api: typeof teacherApi, text: string, extra: Record<string, string> = {}) =>
      api.post(`/api/v1/groups/${course.id}/messages`, { multipart: { body: text, ...extra } });
    const welcome = (await (
      await speak(teacherApi, 'Welcome, everyone! Ask anything here.')
    ).json()) as {
      id: string;
    };
    await teacherApi.post(`/api/v1/groups/messages/${welcome.id}/pin`);
    await speak(abel.api, 'Hello teacher! When is the first session?');
    const picture = await abel.api.post(`/api/v1/groups/${course.id}/messages`, {
      multipart: {
        body: 'my notebook',
        file: { name: 'notebook.png', mimeType: 'image/png', buffer: PNG },
      },
    });
    expect(picture.status()).toBe(201);

    // Sara signs in and finds the group from her course page and from the menu.
    await signInAs(page, { phone: sara.phone, password: 'Passw0rd123' });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto(`/groups?c=${course.id}`);
    await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Welcome, everyone! Ask anything here.').first()).toBeVisible();
    await expect(page.getByText('Pinned message')).toBeVisible();
    await expect(page.getByText('Hello teacher! When is the first session?')).toBeVisible();
    // The teacher is tagged so students know who answers.
    await expect(page.getByText('Teacher', { exact: true }).first()).toBeVisible();
    await expect(page.locator('img[alt="my notebook"]')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
    await shot('1-group-conversation');

    // Members: the teacher, the Natik team and the students.
    await page.getByRole('button', { name: /\d+ members?/ }).click();
    const members = page.getByRole('dialog');
    await expect(members.getByText(`Sara Group ${stamp}`)).toBeVisible();
    await expect(members.getByText(`Abel Group ${stamp}`)).toBeVisible();
    await expect(members.getByText('Teachers · 1')).toBeVisible();
    await shot('2-group-members');

    // Tap a classmate in the list: their profile card opens, like Telegram. It shows the course they
    // share with her, and no phone number or email.
    await members.getByRole('button', { name: `Abel Group ${stamp}` }).click();
    const abelCard = page.getByRole('dialog', { name: `Abel Group ${stamp}` });
    await expect(abelCard.getByText('Student', { exact: true })).toBeVisible();
    await expect(abelCard.getByText(title)).toBeVisible();
    await expect(abelCard.getByText(/\+251|@/)).toHaveCount(0);
    await expect(abelCard.getByRole('button', { name: 'Send message' })).toHaveCount(0);
    await expectNoSeriousA11yIssues(page);
    await shot('2b-profile-card');
    await page.keyboard.press('Escape');

    // Reply to Abel's question, with a reaction.
    const question = page.locator('[id^="m-"]', { hasText: 'When is the first session?' }).first();
    await question.hover();
    await question.getByRole('button', { name: 'Message options' }).click();
    await page.getByRole('menuitem', { name: '👍' }).click();
    await expect(question.getByRole('button', { name: /👍 from 1 person/ })).toBeVisible();
    await question.getByRole('button', { name: 'Message options' }).click();
    await page.getByRole('menuitem', { name: 'Reply' }).click();
    await expect(page.getByText(/Replying to Abel/)).toBeVisible();
    await page.getByRole('textbox', { name: 'Write a message' }).fill('I would like to know too!');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const mine = page.locator('[id^="m-"]', { hasText: 'I would like to know too!' }).first();
    await expect(mine).toBeVisible();
    await expect(mine.getByText('When is the first session?')).toBeVisible();
    await shot('3-reply-and-reaction');

    // She edits her message, then the teacher answers; Sara sees it arrive without reloading.
    await mine.getByRole('button', { name: 'Message options' }).click();
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    await page.getByRole('textbox', { name: 'Message' }).fill('I would like to know too, please!');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('I would like to know too, please!')).toBeVisible();
    await expect(page.getByText('edited', { exact: true })).toBeVisible();
    await speak(teacherApi, 'The first session is on Monday at 5pm.');
    await expect(
      page.getByRole('region', { name: title }).getByText('The first session is on Monday at 5pm.'),
    ).toBeVisible({
      timeout: 15_000,
    });

    // Tap the teacher's name in the conversation: their card has a button that opens the private chat.
    await page
      .getByRole('region', { name: title })
      .getByRole('button', { name: 'Ustaz Ahmed' })
      .first()
      .click();
    const teacherCard = page.getByRole('dialog', { name: 'Ustaz Ahmed' });
    await expect(teacherCard.getByText('Teacher', { exact: true })).toBeVisible();
    await teacherCard.getByRole('button', { name: 'Send message' }).click();
    await expect(page).toHaveURL(/\/chat\?c=/);

    // A phone shows the list first, then the group; the unread badge counts what you have not read.
    await page.goto('/groups');
    if (testInfo.project.name === 'mobile') {
      await expect(page.getByRole('heading', { name: title })).toBeHidden();
    }
    await shot('4-groups-list');

    // Moderation: the teacher removes a message; students cannot pin or remove others' messages.
    const first = (await (await speak(abel.api, 'spam spam spam')).json()) as { id: string };
    expect((await sara.api.delete(`/api/v1/groups/messages/${first.id}`)).status()).toBe(403);
    expect((await sara.api.post(`/api/v1/groups/messages/${first.id}/pin`)).status()).toBe(403);
    expect((await teacherApi.delete(`/api/v1/groups/messages/${first.id}`)).ok()).toBe(true);

    // The teacher's and the admin's views: their own course only, and every course.
    await page.context().clearCookies();
    await signInAs(page, SEED.teacher);
    await page.goto(`/teach/groups?c=${course.id}`);
    await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByRole('region', { name: title }).getByText('This message was deleted').first(),
    ).toBeVisible();
    await shot('5-teacher-view');
    await page.context().clearCookies();
    await signInAs(page, SEED.owner);
    await page.goto('/admin/groups');
    await expect(page.getByRole('heading', { name: 'Course groups', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
    await page.getByRole('button', { name: new RegExp(title) }).click();
    await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    await shot('6-admin-view');

    for (const api of [admin, teacherApi, sara.api, abel.api]) await api.dispose();
  });

  test('a student who is not in the course cannot open its group', async ({ page }) => {
    await page.context().clearCookies();
    const phone = newPhone();
    const res = await page.request.post('/api/v1/auth/register', {
      data: {
        fullName: `Outsider ${Date.now()}`,
        phone,
        email: emailFor(phone),
        password: 'Passw0rd123',
        acceptTerms: true,
        confirmAge: true,
      },
    });
    expect(res.status()).toBe(201);
    const courses = (await (await page.request.get('/api/v1/public/courses')).json()) as {
      items: { id: string }[];
    };
    const id = courses.items[0]!.id;
    expect((await page.request.get(`/api/v1/groups/${id}`)).status()).toBe(404);
    await page.goto(`/groups?c=${id}`);
    await waitForPageReady(page);
    await expect(page.getByText("You can't open this group")).toBeVisible();
    await expectNoHorizontalScroll(page as Page);
  });
});
