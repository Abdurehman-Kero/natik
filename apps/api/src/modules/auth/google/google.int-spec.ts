import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GoogleAuthService } from './google-auth.service';
import { createHarness, type Harness, randomEmail, randomPhone } from '../../../test/harness';

// "dev" plays Google: the login hint is the email that signs in (see DevGoogleOAuthClient).
process.env.GOOGLE_CLIENT_ID = 'dev';

type Agent = ReturnType<Harness['client']>;

/** "Continue with Google" for people, connecting Google in the Profile, and every way it can fail. */
describe('Google sign-in', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
    await h.resetLimits();
  });
  afterAll(async () => {
    await h?.close();
  });

  const hasSession = (response: { headers: Record<string, unknown> }) =>
    ([] as string[])
      .concat((response.headers['set-cookie'] as string[] | undefined) ?? [])
      .some((cookie) => cookie.startsWith('natik_sid='));

  /** The button, then Google, then back to the callback: returns where the browser ends up. */
  async function viaGoogle(agent: Agent, email: string, query = '') {
    const start = await agent
      .get(`/api/v1/auth/google/start?login_hint=${encodeURIComponent(email)}${query}`)
      .redirects(0);
    expect(start.status).toBe(302);
    const back = new URL(start.headers.location as string);
    const callback = await agent.get(back.pathname + back.search).redirects(0);
    expect(callback.status).toBe(302);
    return { start, callback, location: callback.headers.location as string };
  }

  const completeBody = (extra: Record<string, unknown> = {}) => ({
    fullName: 'Hana Alemu',
    acceptTerms: true,
    confirmAge: true,
    country: 'ET',
    city: 'Adama',
    ...extra,
  });

  it('tells the website whether the button should show', async () => {
    const res = await h.client().get('/api/v1/auth/providers').expect(200);
    expect(res.body).toEqual({ google: true });
  });

  it('sends the browser to Google, keeping the state in a cookie that only the Google routes see', async () => {
    const agent = h.client();
    const start = await agent.get('/api/v1/auth/google/start').redirects(0);
    expect(start.status).toBe(302);
    const cookie = ([] as string[]).concat(start.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/^natik_gstate=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth\/google/);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(start.headers.location).toContain('/api/v1/auth/google/callback?code=dev.');
  });

  it('a new person confirms the terms, gets an account without a password, and next time signs straight in', async () => {
    const email = randomEmail();
    const agent = h.client();
    const first = await viaGoogle(agent, email, '&next=/courses/everyday-english');
    expect(first.location).toBe('/register/google');
    expect(hasSession(first.callback)).toBe(false);

    const info = await agent.get('/api/v1/auth/google/pending').expect(200);
    expect(info.body).toMatchObject({ email, next: '/courses/everyday-english' });
    expect(info.body.name).toBeTruthy();

    // The terms and age are asked for, like in normal registration.
    const refused = await agent
      .post('/api/v1/auth/google/complete')
      .send(completeBody({ acceptTerms: false }))
      .expect(400);
    expect(Object.keys(refused.body.error.fields)).toContain('acceptTerms');

    const done = await agent.post('/api/v1/auth/google/complete').send(completeBody()).expect(201);
    expect(done.body).toEqual({ ok: true, home: '/courses/everyday-english' });
    expect(hasSession(done)).toBe(true);

    const me = (await agent.get('/api/v1/me').expect(200)).body;
    expect(me).toMatchObject({
      email,
      role: 'STUDENT',
      fullName: 'Hana Alemu',
      country: 'ET',
      city: 'Adama',
      googleConnected: true,
      hasPassword: false,
    });
    const row = await h.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(row.passwordHash).toBeNull();
    expect(row.phone).toBeNull();
    expect(row.termsAcceptedAt).not.toBeNull();
    expect(row.ageConfirmedAt).not.toBeNull();

    // A new browser, Google again: straight in, to their home.
    const again = h.client();
    const second = await viaGoogle(again, email);
    expect(second.location).toBe('/dashboard');
    expect(hasSession(second.callback)).toBe(true);
    await again.get('/api/v1/me').expect(200);

    // They can still choose a password later with "Forgot password".
    await h.client().post('/api/v1/auth/password/forgot').send({ email }).expect(200);
  });

  it('the finishing step is single use and expires', async () => {
    const email = randomEmail();
    const agent = h.client();
    await viaGoogle(agent, email);
    await agent.post('/api/v1/auth/google/complete').send(completeBody()).expect(201);
    // The cookie is gone now: a second try is refused.
    const second = await agent.post('/api/v1/auth/google/complete').send(completeBody());
    expect(second.status).toBe(410);
    expect(second.body.error.code).toBe('GOOGLE_SIGN_UP_EXPIRED');
    // And nobody can finish without having been through Google.
    const nobody = await h.client().post('/api/v1/auth/google/complete').send(completeBody());
    expect(nobody.status).toBe(410);
    await h.client().get('/api/v1/auth/google/pending').expect(410);
  });

  it('a phone number is optional, but one that already has an account is refused', async () => {
    const taken = await h.makeUser({});
    const agent = h.client();
    await viaGoogle(agent, randomEmail());
    const refused = await agent
      .post('/api/v1/auth/google/complete')
      .send(completeBody({ phone: taken.phone }))
      .expect(409);
    expect(refused.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
    const withPhone = await agent
      .post('/api/v1/auth/google/complete')
      .send(completeBody({ phone: randomPhone() }))
      .expect(201);
    expect(withPhone.body.ok).toBe(true);
  });

  it('an account an admin created for that email (no password yet) is connected and signed in', async () => {
    const branch = await h.prisma.branch.findFirstOrThrow();
    const email = randomEmail();
    const teacher = await h.prisma.user.create({
      data: {
        branchId: branch.id,
        fullName: 'Sara Mohammed',
        role: 'TEACHER',
        phone: randomPhone(),
        email,
      },
    });
    const agent = h.client();
    const result = await viaGoogle(agent, email.toUpperCase());
    expect(result.location).toBe('/teach');
    expect(hasSession(result.callback)).toBe(true);
    const row = await h.prisma.user.findUniqueOrThrow({ where: { id: teacher.id } });
    expect(row.googleId).toBeTruthy();
    expect((await agent.get('/api/v1/me').expect(200)).body.role).toBe('TEACHER');
  });

  it('an account that has a password is NOT taken over by whoever has a Google account with that email', async () => {
    const owner = await h.makeUser({});
    const agent = h.client();
    const result = await viaGoogle(agent, owner.email);
    expect(result.location).toBe('/sign-in?google=exists');
    expect(hasSession(result.callback)).toBe(false);
    await agent.get('/api/v1/me').expect(401);
    const row = await h.prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(row.googleId).toBeNull();
  });

  it('connecting Google from the Profile needs a signed-in person, then Google signs them in later', async () => {
    const user = await h.makeUser({});
    // Not signed in: refused before leaving the site.
    const loggedOut = await h.client().get('/api/v1/auth/google/start?mode=link').redirects(0);
    expect(loggedOut.headers.location).toBe('/sign-in?google=signed-out');

    const agent = await h.signIn(user.phone, user.password);
    // The Google account may have a different email than the Natik account.
    const googleEmail = randomEmail();
    const linked = await viaGoogle(agent, googleEmail, '&mode=link');
    expect(linked.location).toBe('/profile?google=connected');
    expect((await agent.get('/api/v1/me').expect(200)).body.googleConnected).toBe(true);

    const later = h.client();
    const signedIn = await viaGoogle(later, googleEmail);
    expect(signedIn.location).toBe('/dashboard');
    expect((await later.get('/api/v1/me').expect(200)).body.email).toBe(user.email);
  });

  it('one Google account cannot be connected to two people', async () => {
    const googleEmail = randomEmail();
    const first = await h.makeUser({});
    await viaGoogle(await h.signIn(first.phone, first.password), googleEmail, '&mode=link');
    const second = await h.makeUser({});
    const result = await viaGoogle(
      await h.signIn(second.phone, second.password),
      googleEmail,
      '&mode=link',
    );
    expect(result.location).toBe('/profile?google=taken');
  });

  it('refuses a Google account whose email Google has not verified', async () => {
    const result = await viaGoogle(h.client(), 'unverified.person@example.com');
    expect(result.location).toBe('/sign-in?google=unverified');
    expect(hasSession(result.callback)).toBe(false);
  });

  it('refuses a disabled account', async () => {
    const branch = await h.prisma.branch.findFirstOrThrow();
    const email = randomEmail();
    await h.prisma.user.create({
      data: { branchId: branch.id, fullName: 'Gone', role: 'STUDENT', email, status: 'DISABLED' },
    });
    const result = await viaGoogle(h.client(), email);
    expect(result.location).toBe('/sign-in?google=disabled');
    expect(hasSession(result.callback)).toBe(false);
  });

  it('refuses a callback that was not started from this browser, or was already used', async () => {
    // Started in one browser, finished in another (no state cookie): refused.
    const start = await h
      .client()
      .get('/api/v1/auth/google/start?login_hint=a@example.com')
      .redirects(0);
    const back = new URL(start.headers.location as string);
    const stranger = await h
      .client()
      .get(back.pathname + back.search)
      .redirects(0);
    expect(stranger.headers.location).toBe('/sign-in?google=invalid');

    // The state is single use.
    const agent = h.client();
    const ok = await viaGoogle(agent, randomEmail());
    expect(ok.location).toBe('/register/google');
    const replay = await agent
      .get(
        new URL(ok.start.headers.location as string).pathname +
          new URL(ok.start.headers.location as string).search,
      )
      .redirects(0);
    expect(replay.headers.location).toBe('/sign-in?google=invalid');

    // Nonsense and "the person pressed Cancel at Google".
    expect(
      (await h.client().get('/api/v1/auth/google/callback').redirects(0)).headers.location,
    ).toBe('/sign-in?google=invalid');
    expect(
      (await h.client().get('/api/v1/auth/google/callback?error=access_denied').redirects(0))
        .headers.location,
    ).toBe('/sign-in?google=cancelled');
  });

  it('only follows "next" to pages of this site', async () => {
    const email = randomEmail();
    const agent = h.client();
    await viaGoogle(agent, email, '&next=https://evil.example/steal');
    const info = await agent.get('/api/v1/auth/google/pending').expect(200);
    expect(info.body.next).toBeNull();
    const protocolRelative = h.client();
    await viaGoogle(protocolRelative, randomEmail(), '&next=//evil.example');
    expect(
      (await protocolRelative.get('/api/v1/auth/google/pending').expect(200)).body.next,
    ).toBeNull();
  });

  it('an unexpected crash sends the person back to the sign-in page instead of showing raw JSON', async () => {
    const service = h.app.get(GoogleAuthService);
    const start = vi.spyOn(service, 'begin').mockRejectedValueOnce(new Error('redis is down'));
    const failedStart = await h.client().get('/api/v1/auth/google/start').redirects(0);
    expect(failedStart.status).toBe(302);
    expect(failedStart.headers.location).toBe('/sign-in?google=invalid');
    start.mockRestore();

    const finish = vi.spyOn(service, 'finish').mockRejectedValueOnce(new Error('database is down'));
    const failedCallback = await h
      .client()
      .get('/api/v1/auth/google/callback?code=x&state=y')
      .redirects(0);
    expect(failedCallback.status).toBe(302);
    expect(failedCallback.headers.location).toBe('/sign-in?google=invalid');
    finish.mockRestore();
  });

  it('records Google sign-ups and sign-ins in the activity log', async () => {
    const email = randomEmail();
    const agent = h.client();
    await viaGoogle(agent, email);
    await agent.post('/api/v1/auth/google/complete').send(completeBody()).expect(201);
    const user = await h.prisma.user.findUniqueOrThrow({ where: { email } });
    const entries = await h.prisma.auditLog.findMany({ where: { actorId: user.id } });
    expect(entries.map((e) => e.action)).toContain('ACCOUNT_REGISTERED');
    expect(JSON.stringify(entries.map((e) => e.details))).toContain('google');
  });
});
