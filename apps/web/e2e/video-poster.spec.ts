import path from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import { joinCourse, SEED, signInAs, waitForPageReady, newContact } from './helpers';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const SHOTS = path.resolve(__dirname, '../../../docs/test-screenshots/video-poster');

/** A real 2-second WebM recorded in the browser (Chromium can make and read these). */
async function recordVideo(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d')!;
    let frame = 0;
    const draw = () => {
      context.fillStyle = '#123b5a';
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = '#b69a4a';
      context.fillRect(40 + (frame % 60) * 4, 230, 160, 24);
      context.fillStyle = '#ffffff';
      context.font = 'bold 56px sans-serif';
      context.fillText('Natik lesson', 150, 170);
      frame += 1;
    };
    draw();
    const timer = window.setInterval(draw, 33);
    const recorder = new MediaRecorder(canvas.captureStream(30), {
      mimeType: 'video/webm;codecs=vp8',
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    recorder.stop();
    await stopped;
    window.clearInterval(timer);
    const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer());
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(text);
  });
  return Buffer.from(base64, 'base64');
}

test.describe('video pictures', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      !['desktop', 'mobile'].includes(testInfo.project.name),
      'one phone and one desktop size',
    );
  });

  test('an uploaded video shows its own picture; students see it in the session and click to play', async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const shot = (name: string) =>
      page.screenshot({
        path: path.join(SHOTS, testInfo.project.name, `${name}.png`),
        animations: 'disabled',
      });
    const stamp = Date.now();
    const title = `Journey course video ${testInfo.project.name} ${stamp}`;

    // An admin makes a free course with a picture and a teacher (through the API: tested elsewhere).
    await signInAs(page, SEED.owner);
    const languages = (await (await page.request.get('/api/v1/admin/languages')).json()) as {
      items: { id: string; name: string }[];
    };
    const levels = (await (await page.request.get('/api/v1/admin/levels')).json()) as {
      items: { id: string }[];
    };
    const cover = (await (
      await page.request.post('/api/v1/files', {
        multipart: {
          purpose: 'COURSE_IMAGE',
          file: { name: 'cover.png', mimeType: 'image/png', buffer: PNG },
        },
      })
    ).json()) as { id: string };
    const course = (await (
      await page.request.post('/api/v1/admin/courses', {
        data: {
          title,
          languageId: languages.items.find((l) => l.name === 'English')!.id,
          levelId: levels.items[0]!.id,
          summary: 'A free course to check that videos show their own picture.',
          outcomes: [],
          access: 'FREE',
          imageFileId: cover.id,
        },
      })
    ).json()) as { id: string; slug: string };
    const teachers = (await (await page.request.get('/api/v1/admin/users?q=Ustaz')).json()) as {
      items: { id: string }[];
    };
    await page.request.put(`/api/v1/admin/courses/${course.id}/teachers`, {
      data: { teacherIds: [teachers.items[0]!.id] },
    });

    // The teacher adds a lesson and uploads a real video: its picture is taken automatically.
    await page.context().clearCookies();
    await signInAs(page, SEED.teacher);
    await page.goto(`/teach/courses/${course.id}`);
    await page.getByRole('button', { name: 'Add week' }).first().click();
    await page.getByLabel('Week title').fill('Greetings');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Add session' }).click();
    await page.getByLabel('Session title').fill('Saying hello');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page).toHaveURL(/\/lessons\/[a-z0-9]+$/);
    const lessonEditor = new URL(page.url()).pathname;
    await waitForPageReady(page);

    const video = await recordVideo(page);
    await page
      .getByTestId('file-video')
      .setInputFiles({ name: 'Saying hello.webm', mimeType: 'video/webm', buffer: video });
    await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 30_000 });
    const editorPicture = page.locator('main img[src^="/api/v1/files/"]').first();
    await expect(editorPicture).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Picture shown before the video plays.')).toBeVisible();
    await shot('1-editor-picture-from-video');

    // Published, then the course too.
    await page.getByRole('button', { name: 'Publish', exact: true }).last().click();
    await expect(page.getByText('Session published. Students see it now.')).toBeVisible();
    await page.context().clearCookies();
    await signInAs(page, SEED.owner);
    expect((await page.request.post(`/api/v1/admin/courses/${course.id}/publish`)).ok()).toBe(true);

    // A student who joined (and was accepted) sees the video's own picture, and it plays on a click.
    await page.context().clearCookies();
    const student = await page.request.post('/api/v1/auth/register', {
      data: {
        fullName: `Poster Student ${stamp}`,
        ...newContact(),
        password: 'Passw0rd123',
        acceptTerms: true,
        confirmAge: true,
      },
    });
    expect(student.status()).toBe(201);
    await joinCourse(page, course.id);
    await page.goto(lessonEditor.replace(/^\/teach\/courses\/[^/]+/, `/learn/${course.slug}`));
    const play = page.getByRole('button', { name: /Play video: Saying hello/ });
    await expect(play).toBeVisible({ timeout: 15_000 });
    await expect(play.locator('img')).toHaveAttribute('src', /^\/api\/v1\/files\//);
    await expect
      .poll(() => play.locator('img').evaluate((img) => (img as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await shot('2-session-video-picture');
    await play.click();
    await expect(page.locator('video')).toHaveCount(1);
    await expect(page.locator('video')).toHaveAttribute('poster', /^\/api\/v1\/files\//);

    // The teacher can choose another picture instead.
    await signInAs(page, SEED.teacher);
    await page.goto(lessonEditor);
    await waitForPageReady(page);
    const editorPicture2 = page.locator('main img[src^="/api/v1/files/"]').first();
    await expect(editorPicture2).toBeVisible();
    const before = await editorPicture2.getAttribute('src');
    await page.getByTestId('video-poster').setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(page.getByText('Picture saved.')).toBeVisible();
    await expect(page.locator('main img[src^="/api/v1/files/"]').first()).not.toHaveAttribute(
      'src',
      before!,
    );
  });
});
