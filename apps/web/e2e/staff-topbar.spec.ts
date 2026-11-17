import { expect, type Page, test } from '@playwright/test';
import {
  expectNoHorizontalScroll,
  expectNoSeriousA11yIssues,
  newPhone,
  SEED,
  signInAs,
  waitForPageReady,
} from './helpers';

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

async function registerStudent(page: Page) {
  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      fullName: `Bar Student ${unique()}`,
      phone: newPhone(),
      password: 'Passw0rd123',
      acceptTerms: true,
      confirmAge: true,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
}

/** Top bars for admins and teachers, menu numbers that go down once seen, and hidden prices. */
test.describe('admin and teacher top bar', () => {
  test('the admin top bar has the queues, chats, website link and account menu', async ({
    page,
  }, testInfo) => {
    await signInAs(page, SEED.owner);
    await page.goto('/admin');
    await waitForPageReady(page);
    const bar = page.getByRole('banner');
    await expect(bar.getByRole('link', { name: /Payments to check/ })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Messages/ })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Chats/ })).toBeVisible();
    if (testInfo.project.name === 'desktop') {
      await expect(bar.getByRole('link', { name: 'View website' })).toBeVisible();
    }
    await bar.getByRole('button', { name: /Account menu/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('the teacher top bar has marking, chats and announcements', async ({ page }) => {
    await signInAs(page, SEED.teacher);
    await page.goto('/teach');
    await waitForPageReady(page);
    const bar = page.getByRole('banner');
    await expect(bar.getByRole('link', { name: /Marking/ })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Messages/ })).toBeVisible();
    await expect(bar.getByRole('link', { name: /Announcements/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoSeriousA11yIssues(page);
  });

  test('opening the Messages page takes the unread count off the menu', async ({
    page,
    playwright,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the side menu is for large screens');
    const visitor = await playwright.request.newContext({ baseURL });
    await visitor.post('/api/v1/public/contact', {
      data: {
        name: `Counter ${unique()}`,
        phone: '+251911223344',
        message: 'Please call me about the premium courses.',
      },
    });
    await signInAs(page, SEED.owner);
    await page.goto('/admin');
    await waitForPageReady(page);
    const menuLink = page
      .getByRole('complementary')
      .getByRole('link', { name: /Messages/ })
      .first();
    await expect(menuLink).toContainText('unread', { timeout: 15_000 });

    await menuLink.click();
    await expect(page).toHaveURL(/\/admin\/messages/);
    await waitForPageReady(page);
    // The number is gone from the menu without reloading.
    await expect(menuLink).not.toContainText('unread', { timeout: 15_000 });
    await visitor.dispose();
  });

  test('reading a chat takes it off the count, and premium courses show no price', async ({
    page,
    playwright,
    baseURL,
  }) => {
    // A student writes to the team.
    await registerStudent(page);
    const open = await page.request.post('/api/v1/chat/conversations', { data: { with: 'TEAM' } });
    const { id } = (await open.json()) as { id: string };
    await page.request.post(`/api/v1/chat/conversations/${id}/messages`, {
      multipart: { body: 'Hello, I want to ask about payment' },
    });

    const admin = await playwright.request.newContext({ baseURL });
    await admin.post('/api/v1/auth/sign-in', { data: SEED.owner });
    const count = async () =>
      ((await (await admin.get('/api/v1/chat/unread-count')).json()) as { count: number }).count;
    expect(await count()).toBeGreaterThan(0);

    // The admin opens that chat in the browser: the count drops by what was read.
    const adminPage = await (await page.context().browser()!.newContext({ baseURL })).newPage();
    await adminPage.request.post('/api/v1/auth/sign-in', { data: SEED.owner });
    await adminPage.goto(`/admin/chat?c=${id}`);
    await waitForPageReady(adminPage);
    await expect(adminPage.getByText('Hello, I want to ask about payment').last()).toBeVisible();
    const unreadForThisChat = await admin.get('/api/v1/chat/conversations');
    const row = (
      (await unreadForThisChat.json()) as { items: { id: string; unread: number }[] }
    ).items.find((c) => c.id === id);
    expect(row?.unread).toBe(0);
    await adminPage.context().close();

    // Premium courses show no amount on the public pages, and point to support instead.
    await page.goto('/courses?type=premium');
    await waitForPageReady(page);
    await expect(page.getByRole('heading', { name: 'Premium courses' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Professional English/ }).first(),
    ).not.toContainText('ETB');
    await page
      .getByRole('link', { name: /Professional English/ })
      .first()
      .click();
    await waitForPageReady(page);
    await expect(page.getByText('Premium course').first()).toBeVisible();
    await expect(page.locator('aside')).not.toContainText('ETB');
    await expect(page.getByRole('link', { name: 'WhatsApp' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Telegram' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chat' }).first()).toBeVisible();
    await expectNoSeriousA11yIssues(page);
    await admin.dispose();
  });
});
