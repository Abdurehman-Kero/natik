import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, randomEmail, randomPhone } from '../../test/harness';

/** AT-02 and AT-03: register, verify, sign in, lockout, reset and sign out (needs PostgreSQL + Redis). */
describe('accounts and sign-in', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(async () => {
    await h.resetLimits();
  });

  const registerBody = (phone: string, email: string = randomEmail()) => ({
    fullName: 'Abdi Kedir',
    phone,
    email,
    password: 'Passw0rd123',
    acceptTerms: true,
    confirmAge: true,
  });

  describe('register', () => {
    it('registers and signs in at once, without sending any SMS', async () => {
      const phone = randomPhone();
      const agent = h.client();
      const reg = await agent.post('/api/v1/auth/register').send(registerBody(phone)).expect(201);
      expect(reg.body.home).toBe('/dashboard');
      expect(reg.headers['set-cookie']?.[0]).toMatch(/natik_sid=.*HttpOnly.*SameSite=Lax/i);

      const me = await agent.get('/api/v1/me').expect(200);
      expect(me.body).toMatchObject({ fullName: 'Abdi Kedir', role: 'STUDENT' });
      expect(me.body).not.toHaveProperty('passwordHash');
      expect(await h.prisma.smsMessage.count({ where: { to: phone } })).toBe(0);
    });

    it('can sign in again with just the phone and password', async () => {
      const phone = randomPhone();
      await h.client().post('/api/v1/auth/register').send(registerBody(phone)).expect(201);
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone, password: 'Passw0rd123' })
        .expect(200);
    });

    it('signs in with the email, in any letter case, and shows a clear answer for a wrong one', async () => {
      const phone = randomPhone();
      const email = randomEmail();
      await h.client().post('/api/v1/auth/register').send(registerBody(phone, email)).expect(201);
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ email: email.toUpperCase(), password: 'Passw0rd123' })
        .expect(200);
      const wrong = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ email, password: 'not-the-password' })
        .expect(401);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
      // Nothing to sign in with: the form says what is missing.
      const none = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ password: 'Passw0rd123' })
        .expect(400);
      expect(Object.keys(none.body.error.fields)).toContain('email');
    });

    it('needs an email to register, and one email belongs to one account', async () => {
      const { email: _omit, ...withoutEmail } = registerBody(randomPhone());
      const missing = await h.client().post('/api/v1/auth/register').send(withoutEmail).expect(400);
      expect(Object.keys(missing.body.error.fields)).toContain('email');

      const email = randomEmail();
      await h
        .client()
        .post('/api/v1/auth/register')
        .send(registerBody(randomPhone(), email))
        .expect(201);
      const again = await h
        .client()
        .post('/api/v1/auth/register')
        .send(registerBody(randomPhone(), email.toUpperCase()))
        .expect(409);
      expect(again.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    });

    it('accepts the number in any Ethiopian format and stores one form', async () => {
      const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
      await h
        .client()
        .post('/api/v1/auth/register')
        .send(registerBody(`09${digits}`))
        .expect(201);
      const user = await h.prisma.user.findUnique({ where: { phone: `+2519${digits}` } });
      expect(user?.phone).toBe(`+2519${digits}`);
    });

    it('refuses a duplicate phone and says what to do (AT-02)', async () => {
      const existing = await h.makeUser({});
      const res = await h
        .client()
        .post('/api/v1/auth/register')
        .send(registerBody(existing.phone))
        .expect(409);
      expect(res.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
    });

    it('rejects weak passwords and missing consent with field messages', async () => {
      const res = await h
        .client()
        .post('/api/v1/auth/register')
        .send({ ...registerBody(randomPhone()), password: 'short', acceptTerms: false })
        .expect(400);
      expect(res.body.error.fields).toHaveProperty('password');
      expect(res.body.error.fields).toHaveProperty('acceptTerms');
    });

    it('logs the registration in the activity log', async () => {
      const phone = randomPhone();
      await h.client().post('/api/v1/auth/register').send(registerBody(phone)).expect(201);
      const user = await h.prisma.user.findUniqueOrThrow({ where: { phone } });
      const actions = (await h.prisma.auditLog.findMany({ where: { entityId: user.id } })).map(
        (a) => a.action,
      );
      expect(actions).toContain('ACCOUNT_REGISTERED');
    });
  });

  describe('sign in', () => {
    it('signs in, and the wrong password gives one generic message (AT-03)', async () => {
      const user = await h.makeUser({});
      const bad = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: 'Wrong12345' });
      expect(bad.status).toBe(401);
      expect(bad.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Phone number or password is incorrect.',
      });
      const unknown = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: randomPhone(), password: 'Wrong12345' });
      expect(unknown.status).toBe(401);
      expect(unknown.body.error.message).toBe(bad.body.error.message);

      const ok = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: user.password });
      expect(ok.status).toBe(200);
    });

    it('locks the account after 5 wrong passwords, even for the right one', async () => {
      const user = await h.makeUser({});
      for (let i = 0; i < 5; i++) {
        await h
          .client()
          .post('/api/v1/auth/sign-in')
          .send({ phone: user.phone, password: 'Wrong12345' })
          .expect(401);
      }
      const locked = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: user.password });
      expect(locked.status).toBe(429);
      expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('unlocks after the lock period', async () => {
      const user = await h.makeUser({});
      for (let i = 0; i < 5; i++) {
        await h
          .client()
          .post('/api/v1/auth/sign-in')
          .send({ phone: user.phone, password: 'Wrong12345' });
      }
      await h.prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: user.password })
        .expect(200);
    });

    it('keeps students signed in for 30 days only when asked', async () => {
      const user = await h.makeUser({});
      const keep = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: user.password, keepSignedIn: true });
      expect(keep.headers['set-cookie']?.[0]).toMatch(/Expires=/i);
      const session = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: user.password });
      expect(session.headers['set-cookie']?.[0]).not.toMatch(/Expires=/i);
    });

    it('signs staff out after 60 idle minutes', async () => {
      const staff = await h.makeUser({ role: 'TEACHER' });
      const agent = await h.signIn(staff.phone, staff.password);
      await agent.get('/api/v1/me').expect(200);
      await h.prisma.session.updateMany({
        where: { userId: staff.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await agent.get('/api/v1/me').expect(401);
    });

    it('does not let a disabled account in', async () => {
      const user = await h.makeUser({});
      await h.prisma.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: user.password })
        .expect(401);
    });

    it('signs out', async () => {
      const user = await h.makeUser({});
      const agent = await h.signIn(user.phone, user.password);
      await agent.post('/api/v1/auth/sign-out').expect(200);
      await agent.get('/api/v1/me').expect(401);
    });

    it('writes sign-ins and failures to the activity log (FR-REP-003)', async () => {
      const user = await h.makeUser({});
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: 'Wrong12345' });
      await h.signIn(user.phone, user.password);
      const actions = (await h.prisma.auditLog.findMany({ where: { entityId: user.id } })).map(
        (a) => a.action,
      );
      expect(actions).toEqual(expect.arrayContaining(['SIGN_IN_FAILED', 'SIGN_IN']));
    });
  });

  describe('forgot and reset password', () => {
    it('waits 60 seconds between codes', async () => {
      const user = await h.makeUser({});
      await h.client().post('/api/v1/auth/password/forgot').send({ phone: user.phone }).expect(200);
      const again = await h
        .client()
        .post('/api/v1/auth/password/forgot')
        .send({ phone: user.phone });
      expect(again.status).toBe(429);
      expect(again.body.error.code).toBe('OTP_TOO_SOON');
    });

    it('resets with the email: the code is texted to the phone on the account', async () => {
      const user = await h.makeUser({});
      await h.client().post('/api/v1/auth/password/forgot').send({ email: user.email }).expect(200);
      const code = await h.lastCode(user.phone);
      const verified = await h
        .client()
        .post('/api/v1/auth/password/verify-code')
        .send({ email: user.email, code })
        .expect(200);
      expect(verified.body.token).toBeTruthy();
    });

    it('answers the same for a known and an unknown email, and texts nothing for the unknown one', async () => {
      const user = await h.makeUser({});
      const known = await h
        .client()
        .post('/api/v1/auth/password/forgot')
        .send({ email: user.email });
      const stranger = randomEmail();
      const unknown = await h
        .client()
        .post('/api/v1/auth/password/forgot')
        .send({ email: stranger });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(unknown.body).toEqual(known.body);
      expect(await h.prisma.smsMessage.count({ where: { to: `email:${stranger}` } })).toBe(0);
    });

    it('answers the same for known and unknown numbers', async () => {
      const user = await h.makeUser({});
      const known = await h
        .client()
        .post('/api/v1/auth/password/forgot')
        .send({ phone: user.phone });
      const unknown = await h
        .client()
        .post('/api/v1/auth/password/forgot')
        .send({ phone: randomPhone() });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(200);
      expect(unknown.body).toEqual(known.body);
    });

    it('resets by SMS code, signs out other devices and a link works once (AT-03)', async () => {
      const user = await h.makeUser({});
      const otherDevice = await h.signIn(user.phone, user.password);

      await h.client().post('/api/v1/auth/password/forgot').send({ phone: user.phone }).expect(200);
      const { body } = await h
        .client()
        .post('/api/v1/auth/password/verify-code')
        .send({ phone: user.phone, code: await h.lastCode(user.phone) })
        .expect(200);

      await h
        .client()
        .post('/api/v1/auth/password/set')
        .send({ token: body.token, newPassword: 'NewPassw0rd9' })
        .expect(200);
      await h
        .client()
        .post('/api/v1/auth/password/set')
        .send({ token: body.token, newPassword: 'Another1234' })
        .expect(400);

      await otherDevice.get('/api/v1/me').expect(401); // signed out everywhere
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: user.password })
        .expect(401);
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: user.phone, password: 'NewPassw0rd9' })
        .expect(200);
    });

    it('refuses an expired or invented link', async () => {
      const user = await h.makeUser({});
      await h.client().post('/api/v1/auth/password/forgot').send({ phone: user.phone });
      const { body } = await h
        .client()
        .post('/api/v1/auth/password/verify-code')
        .send({ phone: user.phone, code: await h.lastCode(user.phone) });
      await h.prisma.passwordToken.updateMany({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await h
        .client()
        .post('/api/v1/auth/password/set')
        .send({ token: body.token, newPassword: 'NewPassw0rd9' })
        .expect(400);
      await h
        .client()
        .post('/api/v1/auth/password/set')
        .send({ token: 'x'.repeat(43), newPassword: 'NewPassw0rd9' })
        .expect(400);
    });
  });

  describe('profile', () => {
    it('changes the name and password; other devices are signed out', async () => {
      const user = await h.makeUser({});
      const phone = await h.signIn(user.phone, user.password);
      const laptop = await h.signIn(user.phone, user.password);

      await phone
        .patch('/api/v1/me')
        .send({ fullName: 'Abdi K.', email: randomEmail() })
        .expect(200);
      const wrong = await phone
        .post('/api/v1/me/password')
        .send({ currentPassword: 'Nope12345', newPassword: 'NewPassw0rd9' });
      expect(wrong.status).toBe(400);
      expect(wrong.body.error.code).toBe('CURRENT_PASSWORD_WRONG');

      await phone
        .post('/api/v1/me/password')
        .send({ currentPassword: user.password, newPassword: 'NewPassw0rd9' })
        .expect(200);
      await phone.get('/api/v1/me').expect(200);
      await laptop.get('/api/v1/me').expect(401);
    });

    it('stores a profile photo as a small WebP and rejects other files', async () => {
      const user = await h.makeUser({});
      const agent = await h.signIn(user.phone, user.password);
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      );
      const ok = await agent
        .post('/api/v1/me/photo')
        .attach('photo', png, { filename: 'me.png', contentType: 'image/png' });
      expect(ok.status).toBe(201);
      expect(ok.body.photoUrl).toMatch(/^\/api\/v1\/files\//);
      const redirect = await agent.get(ok.body.photoUrl).redirects(0);
      // A link to the bucket (302), or with database storage the picture itself (200).
      expect([200, 302]).toContain(redirect.status);

      const fake = await agent
        .post('/api/v1/me/photo')
        .attach('photo', Buffer.from('MZ not an image'), {
          filename: 'virus.png',
          contentType: 'image/png',
        });
      expect(fake.status).toBe(415);
      expect(fake.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });
  });
});
