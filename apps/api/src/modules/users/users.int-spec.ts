import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UsersService } from './users.service';
import { createHarness, type Harness, randomEmail, randomPhone } from '../../test/harness';

/** Roles and permissions: BR-ROLE-001…004 and FR-ADMIN-002 (needs PostgreSQL + Redis). */
describe('admin user management and permissions', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(async () => {
    await h.resetLimits();
    // Exactly one owner per test, so "last owner" rules are predictable.
    await h.prisma.user.updateMany({ where: { isOwner: true }, data: { isOwner: false } });
  });

  const newUser = () => ({
    fullName: 'Sara Mohammed',
    phone: randomPhone(),
    email: randomEmail(),
    role: 'TEACHER',
  });

  describe('who can open what', () => {
    it('visitors get 401 and students get 403 on admin routes', async () => {
      await h.client().get('/api/v1/admin/users').expect(401);
      const student = await h.makeUser({});
      const agent = await h.signIn(student.phone, student.password);
      const res = await agent.get('/api/v1/admin/users').expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      await agent.post('/api/v1/admin/users').send(newUser()).expect(403);
    });

    it('teachers cannot manage users either', async () => {
      const teacher = await h.makeUser({ role: 'TEACHER' });
      const agent = await h.signIn(teacher.phone, teacher.password);
      await agent.get('/api/v1/admin/users').expect(403);
    });

    it('a signed-in user only ever sees their own profile (BR-ROLE-001)', async () => {
      const a = await h.makeUser({});
      const b = await h.makeUser({});
      const agent = await h.signIn(a.phone, a.password);
      const me = await agent.get('/api/v1/me').expect(200);
      expect(me.body.id).toBe(a.id);
      expect(me.body.id).not.toBe(b.id);
    });

    it('blocks writes that come from another website', async () => {
      const student = await h.makeUser({});
      const agent = await h.signIn(student.phone, student.password);
      await agent
        .patch('/api/v1/me')
        .set('Origin', 'https://evil.example')
        .send({ fullName: 'Hacked' })
        .expect(403);
      await agent
        .patch('/api/v1/me')
        .set('Origin', 'http://localhost:3000')
        .send({ fullName: 'Fine Name' })
        .expect(200);
    });
  });

  describe('admin: users', () => {
    it('searches by name or phone and filters by role and status', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const agent = await h.signIn(owner.phone, owner.password);
      const target = await h.makeUser({ role: 'TEACHER' });
      await h.prisma.user.update({
        where: { id: target.id },
        data: { fullName: 'Zerihun Quasar' },
      });

      const byName = await agent.get('/api/v1/admin/users').query({ q: 'quasar' }).expect(200);
      expect(byName.body.items.map((u: { id: string }) => u.id)).toContain(target.id);

      const national = target.phone.slice(4); // 9XXXXXXXX
      const byPhone = await agent
        .get('/api/v1/admin/users')
        .query({ q: `0${national}` })
        .expect(200);
      expect(byPhone.body.items.map((u: { id: string }) => u.id)).toContain(target.id);

      const teachers = await agent
        .get('/api/v1/admin/users')
        .query({ role: 'TEACHER', status: 'ACTIVE' })
        .expect(200);
      expect(teachers.body.items.every((u: { role: string }) => u.role === 'TEACHER')).toBe(true);
      expect(byName.body.items[0]).not.toHaveProperty('passwordHash');
    });

    it('keeps where a person is (country, city, gender) from registration, and shows it to admins', async () => {
      const phone = randomPhone();
      const created = await h
        .client()
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Hana Bekele',
          phone,
          email: randomEmail(),
          password: 'Passw0rd123',
          acceptTerms: true,
          confirmAge: true,
          gender: 'FEMALE',
          country: 'ke',
          city: '  Nairobi ',
        })
        .expect(201);
      const mine = await h.signIn(phone, 'Passw0rd123');
      const me = (await mine.get('/api/v1/me').expect(200)).body;
      expect(me).toMatchObject({ gender: 'FEMALE', country: 'KE', city: 'Nairobi' });

      // A bad country code is refused.
      await h
        .client()
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Bad Country',
          phone: randomPhone(),
          email: randomEmail(),
          password: 'Passw0rd123',
          acceptTerms: true,
          confirmAge: true,
          country: 'Ethiopia',
        })
        .expect(400);

      // They can change it, or clear the city by sending nothing.
      const changed = await mine
        .patch('/api/v1/me')
        .send({ fullName: 'Hana Bekele', country: 'ET', city: '' })
        .expect(200);
      expect(changed.body).toMatchObject({ country: 'ET', city: null, gender: 'FEMALE' });
      // Leaving the fields out leaves them as they were.
      const same = await mine.patch('/api/v1/me').send({ fullName: 'Hana B.' }).expect(200);
      expect(same.body).toMatchObject({ country: 'ET', gender: 'FEMALE' });

      // An admin sees it in the list and the detail, and can filter by country.
      const admin = await h.makeUser({ role: 'ADMIN' });
      const agent = await h.signIn(admin.phone, admin.password);
      const listed = (await agent.get('/api/v1/admin/users?country=et&pageSize=50').expect(200))
        .body.items as { id: string; country: string }[];
      expect(listed.some((u) => u.id === created.body.id || u.id === me.id)).toBe(true);
      expect(listed.every((u) => u.country === 'ET')).toBe(true);
      const detail = (await agent.get(`/api/v1/admin/users/${me.id}`).expect(200)).body;
      expect(detail).toMatchObject({ country: 'ET', gender: 'FEMALE' });
    });

    it('creates a teacher who gets an SMS link, sets a password and signs in (AT-02 admin flow)', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const admin = await h.signIn(owner.phone, owner.password);
      const body = newUser();
      const created = await admin.post('/api/v1/admin/users').send(body).expect(201);
      expect(created.body).toMatchObject({ role: 'TEACHER', phoneVerified: false });
      // No real email or SMS gateway is set up in this test (nothing leaves the server), so the admin
      // is given the link to pass on. The email that would have gone out is in the development mailbox.
      expect(created.body.sentTo).toBeNull();
      expect(created.body.passwordLink).toMatch(/\/set-password\?token=[\w-]+$/);
      const mailbox = (
        await h.client().get('/api/v1/dev/email').query({ to: body.email }).expect(200)
      ).body.items as { subject: string; text: string }[];
      expect(mailbox[0]!.subject).toBe('Your Natik account is ready');
      expect(mailbox[0]!.text).toContain(`Your sign-in email: ${body.email}`);
      expect(mailbox[0]!.text).toContain(created.body.passwordLink);
      expect(mailbox[0]!.text).toContain('teacher account');

      const sms = await h.prisma.smsMessage.findFirstOrThrow({
        where: { to: body.phone },
        orderBy: { createdAt: 'desc' },
      });
      const token = /set-password\?token=([\w-]+)/.exec(sms.body)?.[1];
      expect(token).toBeTruthy();

      await h
        .client()
        .post('/api/v1/auth/password/set')
        .send({ token, newPassword: 'TeacherPass1' })
        .expect(200);
      const teacher = await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: body.phone, password: 'TeacherPass1' });
      expect(teacher.status).toBe(200);
      expect(teacher.body.home).toBe('/teach');
    });

    it('refuses an email that already has an account, for admins and for profile changes', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const admin = await h.signIn(owner.phone, owner.password);
      const existing = await h.makeUser({});
      const res = await admin
        .post('/api/v1/admin/users')
        .send({ ...newUser(), email: existing.email.toUpperCase() })
        .expect(409);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
      // An admin must give an email: it is how the person signs in.
      const { email: _omit, ...without } = newUser();
      await admin.post('/api/v1/admin/users').send(without).expect(400);

      // Changing your own email to someone else's is refused too, and an empty email does not erase it.
      const me = await h.makeUser({});
      const mine = await h.signIn(me.phone, me.password);
      const taken = await mine
        .patch('/api/v1/me')
        .send({ fullName: 'Someone', email: existing.email })
        .expect(409);
      expect(taken.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
      const kept = await mine
        .patch('/api/v1/me')
        .send({ fullName: 'Someone', email: '' })
        .expect(200);
      expect(kept.body.email).toBe(me.email);
    });

    it('refuses a phone that already has an account', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const admin = await h.signIn(owner.phone, owner.password);
      const existing = await h.makeUser({});
      const res = await admin
        .post('/api/v1/admin/users')
        .send({ ...newUser(), phone: existing.phone })
        .expect(409);
      expect(res.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
    });

    it('disabling signs the person out and blocks sign-in; enabling restores it', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const admin = await h.signIn(owner.phone, owner.password);
      const student = await h.makeUser({});
      const studentSession = await h.signIn(student.phone, student.password);

      await admin.post(`/api/v1/admin/users/${student.id}/disable`).expect(200);
      await studentSession.get('/api/v1/me').expect(401);
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: student.phone, password: student.password })
        .expect(401);

      await admin.post(`/api/v1/admin/users/${student.id}/enable`).expect(200);
      await h
        .client()
        .post('/api/v1/auth/sign-in')
        .send({ phone: student.phone, password: student.password })
        .expect(200);
    });

    it('sends a password link', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const admin = await h.signIn(owner.phone, owner.password);
      const student = await h.makeUser({ verified: false });
      const sent = await admin.post(`/api/v1/admin/users/${student.id}/password-link`).expect(200);
      // Nothing really leaves the server in tests, so the link comes back for the admin to pass on.
      expect(sent.body).toMatchObject({ ok: true, sentTo: null });
      expect(sent.body.link).toMatch(/\/set-password\?token=/);
      const sms = await h.prisma.smsMessage.findFirstOrThrow({
        where: { to: student.phone },
        orderBy: { createdAt: 'desc' },
      });
      expect(sms.template).toBe('password.link');
    });

    it('records the important actions in the activity log (FR-REP-003)', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const admin = await h.signIn(owner.phone, owner.password);
      const student = await h.makeUser({});
      await admin
        .patch(`/api/v1/admin/users/${student.id}`)
        .send({ fullName: 'Promoted Person', role: 'TEACHER' })
        .expect(200);
      await admin.post(`/api/v1/admin/users/${student.id}/disable`).expect(200);
      await admin.post(`/api/v1/admin/users/${student.id}/enable`).expect(200);
      const entries = await h.prisma.auditLog.findMany({
        where: { entityId: student.id, actorId: owner.id },
      });
      expect(entries.map((e) => e.action)).toEqual(
        expect.arrayContaining(['ROLE_CHANGED', 'USER_DISABLED', 'USER_ENABLED']),
      );
      expect(JSON.stringify(entries.map((e) => e.details))).not.toMatch(/passw/i);
    });
  });

  describe('owner rules (BR-ROLE-004)', () => {
    it('only the Owner can create other admins', async () => {
      const plain = await h.makeUser({ role: 'ADMIN' });
      const plainAgent = await h.signIn(plain.phone, plain.password);
      const denied = await plainAgent
        .post('/api/v1/admin/users')
        .send({ ...newUser(), role: 'ADMIN' })
        .expect(403);
      expect(denied.body.error.code).toBe('OWNER_REQUIRED');

      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const ownerAgent = await h.signIn(owner.phone, owner.password);
      await ownerAgent
        .post('/api/v1/admin/users')
        .send({ ...newUser(), role: 'ADMIN' })
        .expect(201);
    });

    it('an admin cannot promote someone to admin, or touch another admin', async () => {
      const plain = await h.makeUser({ role: 'ADMIN' });
      const agent = await h.signIn(plain.phone, plain.password);
      const student = await h.makeUser({});
      const otherAdmin = await h.makeUser({ role: 'ADMIN' });

      await agent
        .patch(`/api/v1/admin/users/${student.id}`)
        .send({ fullName: 'Student', role: 'ADMIN' })
        .expect(403);
      await agent.post(`/api/v1/admin/users/${otherAdmin.id}/disable`).expect(403);
      await agent.post(`/api/v1/admin/users/${otherAdmin.id}/password-link`).expect(403);
    });

    it('nobody can change their own role or disable themselves', async () => {
      const owner = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const agent = await h.signIn(owner.phone, owner.password);
      const role = await agent
        .patch(`/api/v1/admin/users/${owner.id}`)
        .send({ fullName: 'Owner', role: 'TEACHER' });
      expect(role.status).toBe(403);
      await agent.post(`/api/v1/admin/users/${owner.id}/disable`).expect(403);
    });

    it('one of two Owners can be demoted by the other', async () => {
      const first = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const second = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const agent = await h.signIn(second.phone, second.password);
      await agent
        .patch(`/api/v1/admin/users/${first.id}`)
        .send({ fullName: 'Former Owner', role: 'TEACHER' })
        .expect(200);
      const demoted = await h.prisma.user.findUniqueOrThrow({ where: { id: first.id } });
      expect(demoted).toMatchObject({ role: 'TEACHER', isOwner: false });
      // the demoted person is signed out so old permissions can't linger
      expect(await h.prisma.session.count({ where: { userId: first.id } })).toBe(0);
    });

    it('the last Owner can never be demoted or disabled (guard)', async () => {
      const sole = await h.makeUser({ role: 'ADMIN', isOwner: true });
      const users = h.app.get(UsersService);
      // An owner-level actor who is not themselves an active owner in the database (defence in depth).
      const actor = {
        id: 'someone-else',
        fullName: 'X',
        role: 'ADMIN',
        isOwner: true,
        phone: null,
        phoneVerified: true,
      } as const;
      await expect(users.setStatus({ ...actor }, sole.id, 'DISABLED')).rejects.toMatchObject({
        code: 'LAST_OWNER',
      });
      await expect(
        users.update({ ...actor }, sole.id, { fullName: 'Owner', role: 'TEACHER' }),
      ).rejects.toMatchObject({ code: 'LAST_OWNER' });
    });
  });
});
