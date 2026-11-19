import { expect, type Page, test } from '@playwright/test';
import { expectNoHorizontalScroll, expectNoSeriousA11yIssues, SEED, newContact } from './helpers';

/** A tiny valid PNG, used as a picture to send. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// A fake microphone (a silent audio stream), so voice recording works without a person or a device.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const audio = new AudioContext();
      const source = audio.createOscillator();
      const destination = audio.createMediaStreamDestination();
      source.connect(destination);
      source.start();
      return destination.stream;
    };
  });
});

async function registerStudent(page: Page, name: string) {
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
}

/** Messages (chat): students, the Natik team and attachments. */
test.describe('chat', () => {
  test('a student chats with the Natik team with text, a picture, a file and a voice message; an admin answers', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
    const name = `Chat Student ${unique()}`;
    await registerStudent(page, name);

    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();
    await expect(page.getByText('No chats yet')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // Start a chat with the team from the dialog.
    await page.getByRole('button', { name: 'New chat' }).first().click();
    await page.getByRole('button', { name: /Natik team/ }).click();
    await expect(page.getByRole('heading', { name: 'Natik team' })).toBeVisible();

    // Text.
    const hello = `Hello team ${unique()}`;
    await page.getByLabel('Write a message').fill(hello);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region').getByText(hello)).toBeVisible();

    // A picture with a caption.
    await page.locator('input[type=file]').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await page.getByLabel('Write a message').fill('my photo');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('region').getByText('my photo')).toBeVisible();
    await expect(page.locator('main img[alt="my photo"]')).toBeVisible();

    // A PDF.
    await page.locator('input[type=file]').setInputFiles({
      name: 'homework.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'),
    });
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('link', { name: /homework\.pdf/ })).toBeVisible();

    // A voice message.
    await page.getByRole('button', { name: 'Record a voice message' }).click();
    await expect(page.getByRole('status')).toContainText('Recording');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Send voice message' }).click();
    await expect(page.getByRole('button', { name: 'Play voice message' })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);

    // The admin sees it, and answers.
    const adminContext = await browser.newContext({ baseURL });
    const admin = await adminContext.newPage();
    const signIn = await admin.request.post('/api/v1/auth/sign-in', { data: SEED.owner });
    expect(signIn.ok()).toBe(true);
    await admin.goto('/admin/chat');
    await admin.getByRole('button', { name: new RegExp(name) }).click();
    await expect(admin.getByRole('region').getByText(hello)).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Play voice message' })).toBeVisible();

    // The student's name in the chat header opens their profile card. The Natik team sees where they
    // are from and how to reach them; the student's own view of the team chat has no such button.
    await admin.getByRole('region', { name }).getByRole('button', { name }).click();
    const card = admin.getByRole('dialog', { name });
    await expect(card.getByText('Student', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: /@/ })).toBeVisible();
    await expect(card.getByRole('link', { name: /\+251/ })).toBeVisible();
    await expectNoSeriousA11yIssues(admin);
    await admin.keyboard.press('Escape');
    await expect(
      page.getByRole('region', { name: 'Natik team' }).locator('button[aria-haspopup="dialog"]'),
    ).toHaveCount(0);
    const reply = `Welcome ${unique()}`;
    await admin.getByLabel('Write a message').fill(reply);
    await admin.keyboard.press('Enter');
    await expect(admin.getByRole('region').getByText(reply)).toBeVisible();

    // The student receives it without reloading.
    await expect(page.getByRole('region').getByText(reply)).toBeVisible({ timeout: 15_000 });
    await adminContext.close();
  });

  test('messages can be deleted by right-click, and a chat can be cleared or deleted', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'tablet', 'covered on phone and desktop');
    await registerStudent(page, `Chat Student ${unique()}`);
    const chat = await page.request.post('/api/v1/chat/conversations', { data: { with: 'TEAM' } });
    const { id } = (await chat.json()) as { id: string };
    const send = async (body: string) =>
      page.request.post(`/api/v1/chat/conversations/${id}/messages`, { multipart: { body } });
    await send('first message');
    await send('second message');
    await send('third message');

    await page.goto(`/chat?c=${id}`);
    const thread = page.getByRole('region');
    await expect(thread.getByText('third message')).toBeVisible();

    // Right-click a message: delete it.
    await thread.getByText('second message').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Copy text' }).waitFor();
    await page.getByRole('menuitem', { name: 'Delete message' }).click();
    await page.getByRole('button', { name: 'Delete message' }).click();
    await expect(thread.getByText('second message')).toHaveCount(0);
    await expect(thread.getByText('first message')).toBeVisible();

    // The admin sees the message is gone too (and the others are still there).
    const adminContext = await browser.newContext({ baseURL });
    const admin = await adminContext.newPage();
    const signIn = await admin.request.post('/api/v1/auth/sign-in', { data: SEED.owner });
    expect(signIn.ok()).toBe(true);
    const adminView = await admin.request.get(`/api/v1/chat/conversations/${id}/messages`);
    const texts = ((await adminView.json()) as { items: { body: string }[] }).items.map(
      (m) => m.body,
    );
    expect(texts).toEqual(['first message', 'third message']);

    // Clear history from the chat menu: the chat stays open and empty.
    await page.getByRole('button', { name: 'Chat options' }).click();
    await page.getByRole('menuitem', { name: 'Clear history' }).click();
    await page.getByRole('button', { name: 'Clear history' }).click();
    await expect(thread.getByText('first message')).toHaveCount(0);
    const stillThere = await admin.request.get(`/api/v1/chat/conversations/${id}/messages`);
    expect(((await stillThere.json()) as { items: unknown[] }).items).toHaveLength(2);

    // A new message from the team brings the chat back; delete the chat from the list by right-click.
    await admin.request.post(`/api/v1/chat/conversations/${id}/messages`, {
      multipart: { body: 'hello again' },
    });
    await expect(thread.getByText('hello again')).toBeVisible({ timeout: 15_000 });
    await page.goto('/chat');
    await page.getByRole('button', { name: /Natik team/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete chat' }).click();
    await page.getByRole('button', { name: 'Delete chat' }).click();
    await expect(page.getByText('No chats yet')).toBeVisible({ timeout: 15_000 });
    await adminContext.close();
  });

  test('chat is only for signed-in people', async ({ page }) => {
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
