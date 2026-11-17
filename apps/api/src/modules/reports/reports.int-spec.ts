import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';
import { RetentionService } from '../users/retention.service';

/** Reports, CSV, teacher progress, activity log, data-keeping and SMS failures (M7, AT-14). */
describe('admin dashboard, reports and operations', () => {
  let h: Harness;
  let languageId = '';
  let levelId = '';
  let retention: RetentionService;

  beforeAll(async () => {
    h = await createHarness();
    retention = h.app.get(RetentionService);
    const stamp = Date.now();
    languageId = (
      await h.prisma.language.create({
        data: { name: `M7 language ${stamp}`, code: `r${String(stamp).slice(-4)}` },
      })
    ).id;
    levelId = (await h.prisma.level.create({ data: { name: `M7 level ${stamp}` } })).id;
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(async () => {
    await h.resetLimits();
  });

  const unique = () => Math.random().toString(36).slice(2, 8);
  type Agent = Awaited<ReturnType<Harness['signIn']>>;

  async function admin() {
    const u = await h.makeUser({ role: 'ADMIN' });
    return { ...u, agent: await h.signIn(u.phone, u.password) };
  }

  async function course(price = 150_000) {
    const branch = await h.prisma.branch.findFirstOrThrow();
    const slug = `m7-${unique()}`;
    return h.prisma.course.create({
      data: {
        branchId: branch.id,
        slug,
        title: `Report course ${slug}`,
        languageId,
        levelId,
        summary: 'A course for report tests',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        access: 'PAID',
        priceSantim: price,
        accessDays: 90,
      },
    });
  }

  async function enrolled(
    courseId: string,
    options: { name?: string; progress?: number; status?: 'ACTIVE' | 'COMPLETED' } = {},
  ) {
    const user = await h.makeUser({});
    if (options.name) {
      await h.prisma.user.update({ where: { id: user.id }, data: { fullName: options.name } });
    }
    const branch = await h.prisma.branch.findFirstOrThrow();
    const enrolment = await h.prisma.enrolment.create({
      data: {
        branchId: branch.id,
        studentId: user.id,
        courseId,
        status: options.status ?? 'ACTIVE',
        startAt: new Date(),
        progressPct: options.progress ?? 0,
        completedAt: options.status === 'COMPLETED' ? new Date() : null,
      },
    });
    return { ...user, enrolmentId: enrolment.id };
  }

  async function confirmedPayment(
    enrolmentId: string,
    checkedById: string,
    amountSantim: number,
    method: 'BANK' | 'MOBILE_WALLET' | 'CASH',
    reference: string | null,
  ) {
    const branch = await h.prisma.branch.findFirstOrThrow();
    const enrolment = await h.prisma.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } });
    return h.prisma.payment.create({
      data: {
        branchId: branch.id,
        enrolmentId,
        method,
        reference,
        referenceNorm: reference ? `${reference}${unique()}`.toUpperCase() : null,
        amountSantim,
        expectedSantim: amountSantim,
        paidOn: new Date(),
        status: 'CONFIRMED',
        submittedById: enrolment.studentId,
        checkedById,
        checkedAt: new Date(),
      },
    });
  }

  const csvOf = async (agent: Agent, path: string) => {
    const res = await agent
      .get(path)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    return { res, text: (res.body as Buffer).toString('utf8') };
  };

  // ── AT-14: reports match a hand count ───────────────────────────────────

  describe('reports (AT-14)', () => {
    it('payment totals equal a hand count, per method and overall', async () => {
      const a = await admin();
      const c = await course();
      const s1 = await enrolled(c.id);
      const s2 = await enrolled(c.id);
      const s3 = await enrolled(c.id);
      await confirmedPayment(s1.enrolmentId, a.id, 150_000, 'MOBILE_WALLET', 'FT1');
      await confirmedPayment(s2.enrolmentId, a.id, 120_050, 'CASH', null);
      await confirmedPayment(s3.enrolmentId, a.id, 100_000, 'BANK', 'FT3');
      // A payment that was not confirmed never counts.
      await h.prisma.payment.create({
        data: {
          branchId: (await h.prisma.branch.findFirstOrThrow()).id,
          enrolmentId: s1.enrolmentId,
          method: 'BANK',
          reference: 'PENDING',
          referenceNorm: `PENDING${unique()}`.toUpperCase(),
          amountSantim: 999_999,
          expectedSantim: 150_000,
          paidOn: new Date(),
          submittedById: s1.id,
        },
      });

      const res = (
        await a.agent.get('/api/v1/admin/reports/payments').query({ courseId: c.id }).expect(200)
      ).body;
      expect(res.total).toBe(3);
      const summary = Object.fromEntries(
        res.summary.map((s: { label: string; value: number }) => [s.label, s.value]),
      );
      expect(summary['Confirmed total (ETB)']).toBe(370_050);
      expect(summary['Payments']).toBe(3);
      expect(summary['Cash (ETB)']).toBe(120_050);
      expect(summary['Bank (ETB)']).toBe(100_000);
      expect(summary['Mobile wallet (ETB)']).toBe(150_000);
      expect(res.rows).toHaveLength(3);
      expect(res.rows.find((r: { method: string }) => r.method === 'Cash').reference).toBeNull();
    });

    it('enrolment and progress reports count students, status and scores', async () => {
      const a = await admin();
      const c = await course();
      await enrolled(c.id, { progress: 40 });
      await enrolled(c.id, { progress: 100, status: 'COMPLETED' });
      const enrol = (
        await a.agent.get('/api/v1/admin/reports/enrolments').query({ courseId: c.id }).expect(200)
      ).body;
      expect(enrol.total).toBe(2);
      const by = Object.fromEntries(
        enrol.summary.map((s: { label: string; value: number }) => [s.label, s.value]),
      );
      expect(by).toMatchObject({ Enrolments: 2, Active: 1, Completed: 1 });
      const prog = (
        await a.agent.get('/api/v1/admin/reports/progress').query({ courseId: c.id }).expect(200)
      ).body;
      expect(prog.total).toBe(2);
      expect(prog.summary.find((s: { label: string }) => s.label === 'Completed').value).toBe(1);
      // No quiz results yet: shown as missing, never as zero (FR-REP-002).
      expect(
        prog.rows.every(
          (r: { quizAvg: unknown; finalPct: unknown }) => r.quizAvg === null && r.finalPct === null,
        ),
      ).toBe(true);
    });

    it('registrations show masked phones, and dates and courses filter the rows', async () => {
      const a = await admin();
      const s = await h.makeUser({});
      const today = new Date().toISOString().slice(0, 10);
      const res = (
        await a.agent
          .get('/api/v1/admin/reports/registrations')
          .query({ from: today, to: today })
          .expect(200)
      ).body;
      const row = res.rows.find((r: { name: string }) => r.name === 'Test STUDENT');
      expect(row).toBeTruthy();
      expect(JSON.stringify(res.rows)).not.toContain(s.phone);
      expect(row.phone).toMatch(/•/);
      const none = (
        await a.agent
          .get('/api/v1/admin/reports/registrations')
          .query({ from: '2001-01-01', to: '2001-01-02' })
          .expect(200)
      ).body;
      expect(none.total).toBe(0);
      await a.agent.get('/api/v1/admin/reports/unknown').expect(404);
      await a.agent
        .get('/api/v1/admin/reports/registrations')
        .query({ from: 'yesterday' })
        .expect(400);
    });

    it('only admins reach reports, the dashboard and the activity log', async () => {
      const s = await h.makeUser({});
      const student = await h.signIn(s.phone, s.password);
      const t = await h.makeUser({ role: 'TEACHER' });
      const teacher = await h.signIn(t.phone, t.password);
      for (const path of [
        '/api/v1/admin/reports/payments',
        '/api/v1/admin/dashboard',
        '/api/v1/admin/activity',
        '/api/v1/admin/sms',
      ]) {
        await student.get(path).expect(403);
        await teacher.get(path).expect(403);
        await h.client().get(path).expect(401);
      }
    });
  });

  describe('CSV files', () => {
    it('opens cleanly in Excel: BOM, CRLF, Arabic names, formulas defused, money with 2 decimals', async () => {
      const a = await admin();
      const c = await course();
      const arabic = await enrolled(c.id, { name: 'عبد الرحمن كدر' });
      const sneaky = await enrolled(c.id, { name: '=HYPERLINK("http://evil.example","pay")' });
      await confirmedPayment(arabic.enrolmentId, a.id, 150_000, 'BANK', 'FT-A');
      await confirmedPayment(sneaky.enrolmentId, a.id, 100_050, 'CASH', null);
      const { res, text } = await csvOf(
        a.agent,
        `/api/v1/admin/reports/payments/export?courseId=${c.id}`,
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('natik-payments-');
      expect((res.body as Buffer).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      const lines = text.slice(1).split('\r\n').filter(Boolean);
      expect(lines[0]).toBe('Date,Student,Course,Method,Reference,Amount (ETB),Checked by');
      expect(lines).toHaveLength(3);
      expect(text).toContain('عبد الرحمن كدر');
      expect(text).toContain('1500.00');
      expect(text).toContain('1000.50');
      // The formula is plain text, not something Excel would run.
      expect(text).toContain(`"'=HYPERLINK(""http://evil.example"",""pay"")"`);
      expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
      // A cash payment has no reference: shown as a dash.
      expect(lines.some((l) => l.includes('Cash,—,1000.50'))).toBe(true);
    });
  });

  // ── Teacher progress ────────────────────────────────────────────────────

  describe('teacher progress (FR-TEACH-006, BR-ROLE-002)', () => {
    async function teacherOf(courseId: string) {
      const t = await h.makeUser({ role: 'TEACHER' });
      await h.prisma.courseTeacher.create({ data: { courseId, teacherId: t.id } });
      return h.signIn(t.phone, t.password);
    }

    it('shows progress and scores with no phone or payment data, on screen and in the CSV', async () => {
      const c = await course();
      const s = await enrolled(c.id, { name: 'Abdi Kedir', progress: 50 });
      const a = await admin();
      await confirmedPayment(s.enrolmentId, a.id, 150_000, 'BANK', 'SECRETREF');
      const teacher = await teacherOf(c.id);

      const list = (await teacher.get(`/api/v1/teach/courses/${c.id}/students`).expect(200)).body;
      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toMatchObject({
        fullName: 'Abdi Kedir',
        progressPct: 50,
        quizAvgPct: null,
        finalPct: null,
      });
      const sent = JSON.stringify(list);
      expect(sent).not.toContain(s.phone);
      expect(sent).not.toMatch(/phone|payment|amount|SECRETREF/i);

      const { res, text } = await csvOf(teacher, `/api/v1/teach/courses/${c.id}/students/export`);
      expect(res.status).toBe(200);
      const header = text.slice(1).split('\r\n')[0];
      expect(header).toBe(
        'Student,Status,Progress %,Lessons done,Average quiz %,Final quiz %,Last active',
      );
      expect(text).not.toContain(s.phone);
      expect(text).not.toMatch(/SECRETREF|phone|amount/i);

      // Search by name.
      expect(
        (
          await teacher
            .get(`/api/v1/teach/courses/${c.id}/students`)
            .query({ q: 'zzz' })
            .expect(200)
        ).body.items,
      ).toHaveLength(0);
    });

    it("a teacher can't see another teacher's students", async () => {
      const mine = await course();
      const theirs = await course();
      await enrolled(theirs.id);
      const teacher = await teacherOf(mine.id);
      await teacher.get(`/api/v1/teach/courses/${theirs.id}/students`).expect(403);
      await teacher.get(`/api/v1/teach/courses/${theirs.id}/students/export`).expect(403);
    });

    it('the teacher dashboard counts courses, students and answers to mark', async () => {
      const c = await course();
      await enrolled(c.id);
      await enrolled(c.id);
      const teacher = await teacherOf(c.id);
      const home = (await teacher.get('/api/v1/teach/dashboard').expect(200)).body;
      expect(home).toMatchObject({ courseCount: 1, studentCount: 2, toMark: 0 });
    });
  });

  // ── Dashboard ───────────────────────────────────────────────────────────

  it('the admin dashboard counts what needs attention', async () => {
    const a = await admin();
    const c = await course();
    await enrolled(c.id);
    await h.prisma.inboxMessage.create({
      data: {
        type: 'CONTACT',
        name: 'Visitor',
        message: 'Hello, a question about levels',
        status: 'NEW',
      },
    });
    const home = (await a.agent.get('/api/v1/admin/dashboard').expect(200)).body;
    expect(home.students).toBeGreaterThan(0);
    expect(home.newMessages).toBeGreaterThan(0);
    expect(typeof home.paymentsToCheck).toBe('number');
    expect(Array.isArray(home.activeByCourse)).toBe(true);
  });

  // ── Activity log ────────────────────────────────────────────────────────

  describe('activity log (FR-REP-003/004)', () => {
    it('lists recorded actions, filters by group, and opens a row with its details', async () => {
      const a = await admin();
      const c = await course();
      const s = await h.makeUser({});
      await a.agent
        .post('/api/v1/admin/payments/cash')
        .send({
          studentId: s.id,
          courseId: c.id,
          amount: '1500',
          paidOn: new Date().toISOString().slice(0, 10),
        })
        .expect(201);

      const payments = (
        await a.agent
          .get('/api/v1/admin/activity')
          .query({ group: 'PAYMENTS', actorId: a.id })
          .expect(200)
      ).body;
      expect(payments.items.length).toBeGreaterThan(0);
      expect(payments.items.every((i: { action: string }) => i.action.startsWith('PAYMENT_'))).toBe(
        true,
      );
      const row = payments.items[0];
      expect(row.actor.id).toBe(a.id);
      expect(row.subject).toContain('Test STUDENT');
      expect(Array.isArray(payments.actors)).toBe(true);

      const detail = (await a.agent.get(`/api/v1/admin/activity/${row.id}`).expect(200)).body;
      expect(detail).toMatchObject({ id: row.id, action: row.action, entityType: 'Payment' });
      expect(JSON.stringify(detail.details)).toContain('amountSantim');
      await a.agent.get('/api/v1/admin/activity/not-a-number').expect(404);

      const signIns = (
        await a.agent.get('/api/v1/admin/activity').query({ group: 'SIGN_IN' }).expect(200)
      ).body;
      expect(signIns.items.some((i: { action: string }) => i.action === 'SIGN_IN')).toBe(true);
    });

    it('every action the platform records belongs to a filter group', async () => {
      const a = await admin();
      const other = (
        await a.agent
          .get('/api/v1/admin/activity')
          .query({ group: 'OTHER', pageSize: 100 })
          .expect(200)
      ).body;
      // "Other" holds only housekeeping (files, site text, announcements, settings), never the audited ones.
      const audited = /^(SIGN_IN|ROLE_|USER_|ENROLMENT_|PAYMENT_|MARK_|CERTIFICATE_|ACCOUNT_)/;
      expect(other.items.filter((i: { action: string }) => audited.test(i.action))).toEqual([]);
    });

    it('the database itself refuses to change or remove log rows', async () => {
      const a = await admin();
      const row = await h.prisma.auditLog.findFirstOrThrow({ where: { actorId: a.id } });
      await expect(
        h.prisma.$executeRaw`UPDATE "AuditLog" SET action = 'TAMPERED' WHERE id = ${row.id}`,
      ).rejects.toThrow();
      await expect(
        h.prisma.$executeRaw`DELETE FROM "AuditLog" WHERE id = ${row.id}`,
      ).rejects.toThrow();
    });
  });

  // ── Data-keeping ────────────────────────────────────────────────────────

  describe('data-keeping (SRS §8.2)', () => {
    it('an admin erases a student: personal data goes, sessions end, results and certificates stay', async () => {
      const a = await admin();
      const c = await course();
      const s = await enrolled(c.id, { name: 'Sara Erase', status: 'COMPLETED', progress: 100 });
      const agent = await h.signIn(s.phone, s.password);
      await agent.get('/api/v1/me').expect(200);
      const cert = await h.prisma.certificate.create({
        data: {
          number: `NLC-2098-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
          studentId: s.id,
          courseId: c.id,
          enrolmentId: s.enrolmentId,
          studentNameSnapshot: 'Sara Erase',
          courseTitleSnapshot: c.title,
        },
      });

      await a.agent.post(`/api/v1/admin/users/${s.id}/erase`).send({}).expect(400);
      await a.agent
        .post(`/api/v1/admin/users/${s.id}/erase`)
        .send({ reason: 'Requested by the student' })
        .expect(200);

      const user = await h.prisma.user.findUniqueOrThrow({ where: { id: s.id } });
      expect(user).toMatchObject({
        fullName: 'Former student',
        phone: null,
        email: null,
        passwordHash: null,
        status: 'DISABLED',
      });
      expect(user.anonymisedAt).toBeTruthy();
      await agent.get('/api/v1/me').expect(401);
      // Results and the certificate remain, and the certificate still verifies with the printed name.
      expect(
        (await h.prisma.enrolment.findUniqueOrThrow({ where: { id: s.enrolmentId } })).progressPct,
      ).toBe(100);
      const verified = await h
        .client()
        .get(`/api/v1/public/certificates/${cert.number}`)
        .expect(200);
      expect(verified.body).toMatchObject({ status: 'VALID', studentName: 'Sara Erase' });
      const log = await h.prisma.auditLog.findFirst({
        where: { entityId: s.id, action: 'ACCOUNT_ERASED' },
      });
      expect(log?.details).toMatchObject({ reason: 'Requested by the student' });
      // Erasing twice does nothing more; the erased person is excluded from the dashboard count.
      await a.agent
        .post(`/api/v1/admin/users/${s.id}/erase`)
        .send({ reason: 'Again please' })
        .expect(200);
    });

    it("only admins erase, and an admin account can't be erased", async () => {
      const a = await admin();
      const other = await admin();
      const s = await h.makeUser({});
      const student = await h.signIn(s.phone, s.password);
      await student.post(`/api/v1/admin/users/${s.id}/erase`).send({ reason: 'Me' }).expect(403);
      await a.agent
        .post(`/api/v1/admin/users/${other.id}/erase`)
        .send({ reason: 'No way' })
        .expect(403);
    });

    it('the daily clean-up deletes unused accounts after 30 days and erases after 3 years (moved clock)', async () => {
      const branch = await h.prisma.branch.findFirstOrThrow();
      const make = (phone: string, data: Record<string, unknown>) =>
        h.prisma.user.create({
          data: {
            branchId: branch.id,
            phone,
            fullName: `Cleanup ${unique()}`,
            role: 'STUDENT',
            ...data,
          },
        });
      const day = 86_400_000;
      const phone = () => `+2519${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
      const old = await make(phone(), { createdAt: new Date(Date.now() - 31 * day) });
      const recent = await make(phone(), { createdAt: new Date(Date.now() - 29 * day) });
      const usedOnce = await make(phone(), {
        createdAt: new Date(Date.now() - 60 * day),
        lastSignInAt: new Date(Date.now() - 59 * day),
        passwordHash: 'x',
      });
      const stale = await make(phone(), {
        passwordHash: 'x',
        createdAt: new Date(Date.now() - 4 * 365 * day),
        lastSignInAt: new Date(Date.now() - 3.5 * 365 * day),
        lastActiveAt: new Date(Date.now() - 3.2 * 365 * day),
      });
      const activeLongAgo = await make(phone(), {
        passwordHash: 'x',
        createdAt: new Date(Date.now() - 4 * 365 * day),
        lastActiveAt: new Date(Date.now() - 2 * 365 * day),
      });

      const result = await retention.cleanup();
      expect(result.deleted).toBeGreaterThanOrEqual(1);
      expect(await h.prisma.user.findUnique({ where: { id: old.id } })).toBeNull();
      expect(await h.prisma.user.findUnique({ where: { id: recent.id } })).not.toBeNull();
      expect(await h.prisma.user.findUnique({ where: { id: usedOnce.id } })).not.toBeNull();
      expect(
        (await h.prisma.user.findUniqueOrThrow({ where: { id: stale.id } })).anonymisedAt,
      ).toBeTruthy();
      expect(
        (await h.prisma.user.findUniqueOrThrow({ where: { id: activeLongAgo.id } })).anonymisedAt,
      ).toBeNull();
    });
  });

  // ── SMS failures ────────────────────────────────────────────────────────

  describe('SMS delivery (FR-NOTIF-004)', () => {
    it('lists failed messages with masked numbers and retries one', async () => {
      const a = await admin();
      const failed = await h.prisma.smsMessage.create({
        data: {
          to: '+251911223344',
          template: 'payment.confirmed',
          body: 'Natik: payment confirmed.',
          status: 'FAILED',
          attempts: 4,
          lastError: 'Gateway timed out',
        },
      });
      const list = (await a.agent.get('/api/v1/admin/sms').expect(200)).body;
      expect(list.failedCount).toBeGreaterThan(0);
      const item = list.items.find((i: { id: string }) => i.id === failed.id);
      expect(item).toMatchObject({ template: 'payment.confirmed', lastError: 'Gateway timed out' });
      expect(item.to).not.toContain('11223344');
      expect(item.to).toMatch(/•/);
      await a.agent.post(`/api/v1/admin/sms/${failed.id}/retry`).expect(200);
      expect(
        (await h.prisma.smsMessage.findUniqueOrThrow({ where: { id: failed.id } })).status,
      ).toBe('QUEUED');
    });
  });
});
