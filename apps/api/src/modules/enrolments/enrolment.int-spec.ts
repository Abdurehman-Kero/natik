import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';
import { EnrolmentsService } from './enrolments.service';
import { ProgressService } from './progress.service';

/**
 * Enrolment, payments and learning (M5): acceptance tests AT-04 … AT-09, the jobs, and the rules
 * that stop one student seeing another's records.
 */
describe('enrolment, payments and learning', () => {
  let h: Harness;
  let languageId = '';
  let levelId = '';
  let png: Buffer;
  let enrolments: EnrolmentsService;
  let progress: ProgressService;

  beforeAll(async () => {
    h = await createHarness();
    enrolments = h.app.get(EnrolmentsService);
    progress = h.app.get(ProgressService);
    const stamp = Date.now();
    languageId = (
      await h.prisma.language.create({
        data: { name: `M5 language ${stamp}`, code: `m${String(stamp).slice(-4)}` },
      })
    ).id;
    levelId = (await h.prisma.level.create({ data: { name: `M5 level ${stamp}` } })).id;
    png = await sharp({ create: { width: 800, height: 1200, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
  });
  afterAll(async () => {
    await h?.close();
  });
  beforeEach(async () => {
    await h.resetLimits();
  });

  const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();
  type Agent = Awaited<ReturnType<Harness['signIn']>>;

  /** A published course with `lessons` published lessons in one unit. */
  async function makeCourse(
    options: {
      access?: 'FREE' | 'PAID';
      price?: number;
      days?: number | null;
      lessons?: number;
    } = {},
  ) {
    const { access = 'PAID', price = 150_000, days = 90, lessons = 3 } = options;
    const branch = await h.prisma.branch.findFirstOrThrow();
    const slug = `m5-${unique().toLowerCase()}`;
    const course = await h.prisma.course.create({
      data: {
        branchId: branch.id,
        slug,
        title: `Course ${slug}`,
        languageId,
        levelId,
        summary: 'A course for tests',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        access,
        priceSantim: access === 'PAID' ? price : null,
        accessDays: days,
      },
    });
    const unit = await h.prisma.unit.create({
      data: { courseId: course.id, title: 'Unit 1', position: 1, status: 'PUBLISHED' },
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
      await h.prisma.lessonBlock.create({
        data: {
          lessonId: lesson.id,
          type: 'TEXT',
          position: 1,
          textJson: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: `Body ${i}` }] }],
          },
        },
      });
      lessonIds.push(lesson.id);
    }
    return { ...course, lessonIds };
  }

  async function student() {
    const user = await h.makeUser({});
    return { ...user, agent: await h.signIn(user.phone, user.password) };
  }
  async function admin() {
    const user = await h.makeUser({ role: 'ADMIN' });
    return { ...user, agent: await h.signIn(user.phone, user.password) };
  }
  /** Asks to join without anyone accepting: for the approval tests. */
  const ask = (agent: Agent, courseId: string) => agent.post(`/api/v1/courses/${courseId}/enrol`);
  let approver: Agent | undefined;
  /**
   * Enrols the way the rest of these tests need: a paid course waits for payment as before; a free
   * course asks to join and is accepted by an admin (a request answered twice at once is fine).
   */
  function enrol(agent: Agent, courseId: string) {
    const run = async () => {
      const res = await ask(agent, courseId);
      if (res.status !== 200 || res.body.status !== 'AWAITING_APPROVAL') return res;
      if (!approver) approver = (await admin()).agent;
      const accepted = await approver.post(`/api/v1/admin/enrolments/${res.body.id}/approve`);
      return accepted.status === 200 ? accepted : res;
    };
    const promise = run();
    return Object.assign(promise, {
      expect: async (code: number) => {
        const res = await promise;
        expect(res.status).toBe(code);
        return res;
      },
    });
  }

  function pay(
    agent: Agent,
    enrolmentId: string,
    fields: Record<string, string> = {},
    withReceipt = true,
  ) {
    let req = agent
      .post(`/api/v1/enrolments/${enrolmentId}/payments`)
      .field('method', fields.method ?? 'MOBILE_WALLET')
      .field('reference', fields.reference ?? `FT${unique()}${unique()}`)
      .field('amount', fields.amount ?? '1500')
      .field('paidOn', fields.paidOn ?? new Date().toISOString().slice(0, 10));
    if (withReceipt) {
      req = req.attach('receipt', png, { filename: 'receipt.png', contentType: 'image/png' });
    }
    return req;
  }

  /** The queue is oldest first and paged, so look through the pages for one payment. */
  async function findInQueue(agent: Agent, paymentId: string) {
    for (let page = 1; page <= 50; page++) {
      const res = await agent
        .get('/api/v1/admin/payments')
        .query({ status: 'SUBMITTED', page, pageSize: 50 })
        .expect(200);
      const found = res.body.items.find((p: { id: string }) => p.id === paymentId);
      if (found) return found;
      if (page * 50 >= res.body.total) break;
    }
    throw new Error(`payment ${paymentId} is not in the queue`);
  }

  async function paymentOf(enrolmentId: string) {
    return h.prisma.payment.findFirstOrThrow({
      where: { enrolmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── AT-04 ───────────────────────────────────────────────────────────────

  describe('free enrolment (AT-04)', () => {
    it('registering gives no access; one tap enrols and opens the course', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const s = await student();

      const before = await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(403);
      expect(before.body.error.params.reason).toBe('NOT_ENROLLED');

      const res = await enrol(s.agent, course.id).expect(200);
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.startAt).toBeTruthy();
      expect(new Date(res.body.endAt).getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);

      await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(200);
      const mine = await s.agent.get('/api/v1/me/courses').expect(200);
      expect(mine.body.items.map((c: { course: { slug: string } }) => c.course.slug)).toContain(
        course.slug,
      );
      const dashboard = await s.agent.get('/api/v1/me/dashboard').expect(200);
      expect(dashboard.body.continue.courseSlug).toBe(course.slug);
    });

    it('a free course needs an admin to accept the student; they can also turn the request down', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const s = await student();
      const a = await admin();
      const asked = (await ask(s.agent, course.id).expect(200)).body;
      expect(asked).toMatchObject({ status: 'AWAITING_APPROVAL', startAt: null });
      // Nothing opens yet, with the reason.
      const blocked = await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(403);
      expect(blocked.body.error.code).toBe('COURSE_ACCESS_DENIED');
      const outline = await s.agent.get(`/api/v1/learn/${course.slug}`).expect(200);
      expect(outline.body.access).toMatchObject({ allowed: false, reason: 'AWAITING_APPROVAL' });
      // Asking again returns the same request.
      expect((await ask(s.agent, course.id).expect(200)).body.id).toBe(asked.id);
      // The admin sees how many wait; students can't accept themselves.
      expect(
        (await a.agent.get('/api/v1/admin/enrolments/requests/count').expect(200)).body.count,
      ).toBeGreaterThanOrEqual(1);
      await s.agent.post(`/api/v1/admin/enrolments/${asked.id}/approve`).expect(403);
      const accepted = await a.agent
        .post(`/api/v1/admin/enrolments/${asked.id}/approve`)
        .expect(200);
      expect(accepted.body.status).toBe('ACTIVE');
      expect(accepted.body.startAt).toBeTruthy();
      await a.agent.post(`/api/v1/admin/enrolments/${asked.id}/approve`).expect(409);
      await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(200);

      // Another student is turned down with a reason, and can ask again later.
      const other = await student();
      const second = (await ask(other.agent, course.id).expect(200)).body;
      await a.agent.post(`/api/v1/admin/enrolments/${second.id}/decline`).send({}).expect(400);
      await a.agent
        .post(`/api/v1/admin/enrolments/${second.id}/decline`)
        .send({ reason: 'This group is full' })
        .expect(200);
      const again = (await ask(other.agent, course.id).expect(200)).body;
      expect(again.status).toBe('AWAITING_APPROVAL');
      expect(again.id).not.toBe(second.id);
    });

    it('tapping twice, even at once, makes only one enrolment', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const s = await student();
      const [a, b, c] = await Promise.all([
        enrol(s.agent, course.id),
        enrol(s.agent, course.id),
        enrol(s.agent, course.id),
      ]);
      expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
      expect(new Set([a.body.id, b.body.id, c.body.id]).size).toBe(1);
      expect(await h.prisma.enrolment.count({ where: { studentId: s.id } })).toBe(1);
    });

    it('only students enrol themselves, and only in published courses', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const a = await admin();
      await enrol(a.agent, course.id).expect(403);
      await h.client().post(`/api/v1/courses/${course.id}/enrol`).expect(401);
      const draft = await h.prisma.course.update({
        where: { id: course.id },
        data: { status: 'DRAFT' },
      });
      const s = await student();
      await enrol(s.agent, draft.id).expect(404);
    });
  });

  // ── AT-05 / AT-06 ───────────────────────────────────────────────────────

  describe('paid enrolment and the payment queue (AT-05, AT-06)', () => {
    it('submit → still blocked → admin confirms → opens with an SMS', async () => {
      const course = await makeCourse();
      await h.prisma.paymentAccount.create({
        data: {
          type: 'MOBILE_WALLET',
          provider: 'telebirr',
          accountName: 'Natik',
          accountNumber: '0911223344',
        },
      });
      const s = await student();
      const a = await admin();

      const enrolment = (await enrol(s.agent, course.id).expect(200)).body;
      expect(enrolment.status).toBe('AWAITING_PAYMENT');
      const blocked = await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(403);
      expect(blocked.body.error.params.reason).toBe('AWAITING_PAYMENT');

      const info = (await s.agent.get(`/api/v1/enrolments/${enrolment.id}/payment`).expect(200))
        .body;
      expect(info.course.priceSantim).toBe(150_000);
      expect(info.canSubmit).toBe(true);
      expect(info.accounts.length).toBeGreaterThan(0);

      await pay(s.agent, enrolment.id).expect(201);
      const stored = await paymentOf(enrolment.id);
      expect(stored.status).toBe('SUBMITTED');
      expect(stored.expectedSantim).toBe(150_000);
      expect(stored.receiptFileId).toBeTruthy();

      // Submitting is not enough: access stays closed (FR-PAY-006).
      const reviewing = await s.agent
        .get(`/api/v1/learn/lessons/${course.lessonIds[0]}`)
        .expect(403);
      expect(reviewing.body.error.params.reason).toBe('PAYMENT_UNDER_REVIEW');

      const item = await findInQueue(a.agent, stored.id);
      expect(item.matches).toBe(true);
      expect(item.student.fullName).toBeTruthy();

      await a.agent.post(`/api/v1/admin/payments/${stored.id}/confirm`).expect(200);
      await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(200);
      const after = await h.prisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } });
      expect(after.status).toBe('ACTIVE');
      expect(after.endAt!.getTime()).toBeGreaterThan(Date.now() + 80 * 86_400_000);
      const sms = await h.prisma.smsMessage.findFirst({
        where: { to: s.phone, template: 'payment.confirmed' },
      });
      expect(sms?.body).toContain(course.title);
      const events = await h.prisma.enrolmentEvent.findMany({
        where: { enrolmentId: enrolment.id },
      });
      expect(events.map((e) => e.toStatus)).toEqual([
        'AWAITING_PAYMENT',
        'PAYMENT_SUBMITTED',
        'ACTIVE',
      ]);
      expect(
        await h.prisma.auditLog.count({
          where: { entityId: stored.id, action: 'PAYMENT_CONFIRMED' },
        }),
      ).toBe(1);
    });

    it('explains mistakes in the form with field messages', async () => {
      const course = await makeCourse();
      const s = await student();
      const enrolment = (await enrol(s.agent, course.id).expect(200)).body;
      const res = await pay(
        s.agent,
        enrolment.id,
        { reference: 'x', amount: 'abc', paidOn: '2999-01-01' },
        false,
      ).expect(400);
      expect(Object.keys(res.body.error.fields)).toEqual(
        expect.arrayContaining(['reference', 'amount', 'paidOn']),
      );
    });

    it('refuses a reference that was already used, however it is typed', async () => {
      const course = await makeCourse();
      const first = await student();
      const second = await student();
      const e1 = (await enrol(first.agent, course.id)).body;
      const e2 = (await enrol(second.agent, course.id)).body;
      const ref = `DUP${unique()}${unique()}`;
      await pay(first.agent, e1.id, { reference: ref }, false).expect(201);
      const res = await pay(
        second.agent,
        e2.id,
        { reference: ` ${ref.toLowerCase().slice(0, 4)} ${ref.toLowerCase().slice(4)} ` },
        false,
      ).expect(409);
      expect(res.body.error.code).toBe('PAYMENT_REFERENCE_DUPLICATE');
    });

    it('rejecting needs a reason, tells the student, and lets them try again', async () => {
      const course = await makeCourse();
      const s = await student();
      const a = await admin();
      const enrolment = (await enrol(s.agent, course.id)).body;
      const ref = `REJ${unique()}${unique()}`;
      await pay(s.agent, enrolment.id, { reference: ref }, false).expect(201);
      const stored = await paymentOf(enrolment.id);

      await a.agent.post(`/api/v1/admin/payments/${stored.id}/reject`).send({}).expect(400);
      await a.agent
        .post(`/api/v1/admin/payments/${stored.id}/reject`)
        .send({ reason: 'Reference not found' })
        .expect(200);

      const info = (await s.agent.get(`/api/v1/enrolments/${enrolment.id}/payment`).expect(200))
        .body;
      expect(info.canSubmit).toBe(true);
      expect(info.lastRejection.rejectionReason).toBe('Reference not found');
      const row = await h.prisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } });
      expect(row.status).toBe('AWAITING_PAYMENT');
      const sms = await h.prisma.smsMessage.findFirst({
        where: { to: s.phone, template: 'payment.rejected' },
      });
      expect(sms?.body).toContain('Reference not found');
      expect(sms!.body.length).toBeLessThanOrEqual(160);

      // The corrected reference is accepted, and so is the same one (a rejected one is free again).
      await pay(s.agent, enrolment.id, { reference: ref }, false).expect(201);
    });

    it('only one of two simultaneous confirms succeeds', async () => {
      const course = await makeCourse();
      const s = await student();
      const a = await admin();
      const b = await admin();
      const enrolment = (await enrol(s.agent, course.id)).body;
      await pay(s.agent, enrolment.id, {}, false).expect(201);
      const stored = await paymentOf(enrolment.id);
      const results = await Promise.all([
        a.agent.post(`/api/v1/admin/payments/${stored.id}/confirm`),
        b.agent.post(`/api/v1/admin/payments/${stored.id}/confirm`),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(
        await h.prisma.smsMessage.count({ where: { to: s.phone, template: 'payment.confirmed' } }),
      ).toBe(1);
    });

    it('a cash payment opens the course at once, and creates the enrolment if needed', async () => {
      const course = await makeCourse();
      const s = await student();
      const a = await admin();
      const body = {
        studentId: s.id,
        courseId: course.id,
        amount: '1500',
        paidOn: new Date().toISOString().slice(0, 10),
      };
      const res = await a.agent.post('/api/v1/admin/payments/cash').send(body).expect(201);
      expect(res.body.status).toBe('CONFIRMED');
      await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(200);
      const row = await h.prisma.payment.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.method).toBe('CASH');
      // Already enrolled: a second cash payment for the same course is refused.
      await a.agent.post('/api/v1/admin/payments/cash').send(body).expect(409);
      // Free courses have nothing to pay.
      const free = await makeCourse({ access: 'FREE' });
      await a.agent
        .post('/api/v1/admin/payments/cash')
        .send({ ...body, courseId: free.id })
        .expect(400);
    });

    it('cash for a student who was waiting to pay settles their pending payment', async () => {
      const course = await makeCourse();
      const s = await student();
      const a = await admin();
      const enrolment = (await enrol(s.agent, course.id)).body;
      await pay(s.agent, enrolment.id, {}, false).expect(201);
      const pending = await paymentOf(enrolment.id);
      await a.agent
        .post('/api/v1/admin/payments/cash')
        .send({
          studentId: s.id,
          courseId: course.id,
          amount: '1500',
          paidOn: new Date().toISOString().slice(0, 10),
        })
        .expect(201);
      expect((await h.prisma.payment.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe(
        'REJECTED',
      );
      expect(
        (await h.prisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } })).status,
      ).toBe('ACTIVE');
    });

    it('students cannot use the admin queue', async () => {
      const s = await student();
      await s.agent.get('/api/v1/admin/payments').expect(403);
      await s.agent.post('/api/v1/admin/payments/x/confirm').expect(403);
      await s.agent.post('/api/v1/admin/payments/cash').send({}).expect(403);
      await s.agent.get('/api/v1/admin/enrolments').expect(403);
    });
  });

  // ── AT-07 ───────────────────────────────────────────────────────────────

  describe('no access without an enrolment (AT-07)', () => {
    it('refuses the lesson, the outline and the files with the right reason', async () => {
      const course = await makeCourse();
      const s = await student();
      const file = await h.prisma.fileAsset.create({
        data: {
          purpose: 'LESSON_PDF',
          storageKey: `lessons/${course.id}/none.pdf`,
          mime: 'application/pdf',
          sizeBytes: 10,
          originalName: 'x.pdf',
        },
      });
      await h.prisma.lessonBlock.create({
        data: { lessonId: course.lessonIds[0]!, type: 'PDF', position: 2, fileId: file.id },
      });

      const lesson = await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(403);
      expect(lesson.body.error.params).toMatchObject({
        reason: 'NOT_ENROLLED',
        courseSlug: course.slug,
      });
      const outline = await s.agent.get(`/api/v1/learn/${course.slug}`).expect(200);
      expect(outline.body.access).toMatchObject({ allowed: false, reason: 'NOT_ENROLLED' });
      expect(outline.body.units).toBeUndefined();
      await s.agent.get(`/api/v1/files/${file.id}`).expect(403);
      await h.client().get(`/api/v1/files/${file.id}`).expect(401);
      await s.agent.post(`/api/v1/learn/lessons/${course.lessonIds[0]}/complete`).expect(403);
    });

    it('closes again when access ends or the enrolment is cancelled', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const s = await student();
      const a = await admin();
      const enrolment = (await enrol(s.agent, course.id)).body;
      await h.prisma.enrolment.update({
        where: { id: enrolment.id },
        data: { endAt: new Date(Date.now() - 1000) },
      });
      const expired = await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(403);
      expect(expired.body.error.code).toBe('ACCESS_EXPIRED');
      expect(expired.body.error.params.endAt).toBeTruthy();

      await h.prisma.enrolment.update({
        where: { id: enrolment.id },
        data: { endAt: new Date(Date.now() + 86_400_000) },
      });
      await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[0]}`).expect(200);
      await a.agent
        .post(`/api/v1/admin/enrolments/${enrolment.id}/cancel`)
        .send({ reason: 'Requested by student' })
        .expect(200);
      const cancelled = await s.agent
        .get(`/api/v1/learn/lessons/${course.lessonIds[0]}`)
        .expect(403);
      expect(cancelled.body.error.params.reason).toBe('CANCELLED');
    });

    it('does not show draft or hidden lessons to enrolled students', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const s = await student();
      await enrol(s.agent, course.id).expect(200);
      await h.prisma.lesson.update({
        where: { id: course.lessonIds[1]! },
        data: { status: 'HIDDEN' },
      });
      await s.agent.get(`/api/v1/learn/lessons/${course.lessonIds[1]}`).expect(404);
      const outline = (await s.agent.get(`/api/v1/learn/${course.slug}`).expect(200)).body;
      expect(outline.totals.total).toBe(2);
    });
  });

  // ── AT-08 ───────────────────────────────────────────────────────────────

  describe("one student can't reach another's records (AT-08)", () => {
    it('payment pages, receipts, renewals and progress answer "not found"', async () => {
      const course = await makeCourse();
      const owner = await student();
      const other = await student();
      const a = await admin();
      const enrolment = (await enrol(owner.agent, course.id)).body;
      await pay(owner.agent, enrolment.id).expect(201);
      const stored = await paymentOf(enrolment.id);

      await other.agent.get(`/api/v1/enrolments/${enrolment.id}/payment`).expect(404);
      await pay(other.agent, enrolment.id, {}, false).expect(404);
      await other.agent.post(`/api/v1/enrolments/${enrolment.id}/renew`).expect(404);
      const mine = await other.agent.get('/api/v1/me/payments').expect(200);
      expect(mine.body.items).toEqual([]);

      const receipt = `/api/v1/files/${stored.receiptFileId}`;
      await other.agent.get(receipt).expect(404);
      await h.client().get(receipt).expect(404);
      await owner.agent.get(receipt).expect(200);
      await a.agent.get(receipt).expect(200);
    });
  });

  // ── AT-09 ───────────────────────────────────────────────────────────────

  describe('learning and progress (AT-09)', () => {
    it('marking complete moves progress, completes the course, and "continue" returns to the last lesson', async () => {
      const course = await makeCourse({ access: 'FREE', lessons: 3 });
      const s = await student();
      await enrol(s.agent, course.id).expect(200);
      const [l1, l2, l3] = course.lessonIds as [string, string, string];

      await s.agent.post(`/api/v1/learn/lessons/${l1}/open`).expect(200);
      const first = (await s.agent.post(`/api/v1/learn/lessons/${l1}/complete`).expect(200)).body;
      expect(first.progressPct).toBe(33);
      expect(first.nextId).toBe(l2);
      // A second tap keeps the same answer.
      expect(
        (await s.agent.post(`/api/v1/learn/lessons/${l1}/complete`).expect(200)).body.progressPct,
      ).toBe(33);

      await s.agent.post(`/api/v1/learn/lessons/${l2}/open`).expect(200);
      const dash = (await s.agent.get('/api/v1/me/dashboard').expect(200)).body;
      expect(dash.continue.lessonId).toBe(l2);
      expect(dash.courses[0].progressPct).toBe(33);

      const outline = (await s.agent.get(`/api/v1/learn/${course.slug}`).expect(200)).body;
      expect(outline.units[0].lessons.map((l: { state: string }) => l.state)).toEqual([
        'done',
        'current',
        'todo',
      ]);

      const lesson = (await s.agent.get(`/api/v1/learn/lessons/${l2}`).expect(200)).body;
      expect(lesson.nav).toMatchObject({ prevId: l1, nextId: l3, position: 2, total: 3 });
      expect(lesson.lesson.blocks[0].html).toContain('Body 2');

      await s.agent.post(`/api/v1/learn/lessons/${l2}/complete`).expect(200);
      const last = (await s.agent.post(`/api/v1/learn/lessons/${l3}/complete`).expect(200)).body;
      expect(last).toMatchObject({ progressPct: 100, courseCompleted: true });

      const done = await h.prisma.enrolment.findFirstOrThrow({ where: { studentId: s.id } });
      expect(done.status).toBe('COMPLETED');
      // Finished courses still open to read, but nothing more can be marked.
      const view = (await s.agent.get(`/api/v1/learn/lessons/${l1}`).expect(200)).body;
      expect(view.state.readOnly).toBe(true);
      await s.agent.post(`/api/v1/learn/lessons/${l1}/complete`).expect(409);
    });

    it('progress follows the lessons that are published, including after one is hidden', async () => {
      const course = await makeCourse({ access: 'FREE', lessons: 4 });
      const s = await student();
      const enrolment = (await enrol(s.agent, course.id)).body;
      await s.agent.post(`/api/v1/learn/lessons/${course.lessonIds[0]}/complete`).expect(200);
      expect(
        (await h.prisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } })).progressPct,
      ).toBe(25);

      await h.prisma.lesson.update({
        where: { id: course.lessonIds[3]! },
        data: { status: 'HIDDEN' },
      });
      await progress.recalcCourse(course.id);
      expect(
        (await h.prisma.enrolment.findUniqueOrThrow({ where: { id: enrolment.id } })).progressPct,
      ).toBe(33);

      // Results are never deleted by hiding (FR-ENR-009).
      expect(await h.prisma.lessonProgress.count({ where: { studentId: s.id } })).toBe(1);
    });

    it('"Report a problem" reaches the admin inbox with the lesson', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const s = await student();
      await enrol(s.agent, course.id).expect(200);
      await s.agent
        .post(`/api/v1/learn/lessons/${course.lessonIds[0]}/report`)
        .send({ message: 'The video does not play' })
        .expect(200);
      await s.agent
        .post(`/api/v1/learn/lessons/${course.lessonIds[0]}/report`)
        .send({ message: 'x' })
        .expect(400);
      const message = await h.prisma.inboxMessage.findFirstOrThrow({
        where: { userId: s.id, type: 'PROBLEM_REPORT' },
      });
      expect(message.lessonId).toBe(course.lessonIds[0]);
      // Someone who can't open the lesson can't report on it either.
      const stranger = await student();
      await stranger.agent
        .post(`/api/v1/learn/lessons/${course.lessonIds[0]}/report`)
        .send({ message: 'Not enrolled at all' })
        .expect(403);
    });
  });

  // ── Admin management ────────────────────────────────────────────────────

  describe('admin manages enrolments (FR-ADMIN-006, 008)', () => {
    it('enrols, extends, cancels with a reason, and renews', async () => {
      const course = await makeCourse({ days: 30 });
      const s = await student();
      const a = await admin();

      const enrolment = (
        await a.agent
          .post('/api/v1/admin/enrolments')
          .send({ studentId: s.id, courseId: course.id })
          .expect(201)
      ).body;
      expect(enrolment.status).toBe('ACTIVE');
      await a.agent
        .post('/api/v1/admin/enrolments')
        .send({ studentId: s.id, courseId: course.id })
        .expect(409);

      const before = new Date(enrolment.endAt).getTime();
      const extended = (
        await a.agent
          .post(`/api/v1/admin/enrolments/${enrolment.id}/extend`)
          .send({ days: 10 })
          .expect(200)
      ).body;
      expect(new Date(extended.endAt).getTime() - before).toBe(10 * 86_400_000);
      await a.agent
        .post(`/api/v1/admin/enrolments/${enrolment.id}/extend`)
        .send({ days: 0 })
        .expect(400);

      await a.agent.post(`/api/v1/admin/enrolments/${enrolment.id}/cancel`).send({}).expect(400);
      await a.agent
        .post(`/api/v1/admin/enrolments/${enrolment.id}/cancel`)
        .send({ reason: 'Refunded' })
        .expect(200);
      // A cancelled enrolment can't be extended or renewed; a fresh one is made instead.
      await a.agent
        .post(`/api/v1/admin/enrolments/${enrolment.id}/extend`)
        .send({ days: 5 })
        .expect(409);
      await a.agent.post(`/api/v1/admin/enrolments/${enrolment.id}/renew`).expect(409);

      const list = (
        await a.agent.get('/api/v1/admin/enrolments').query({ courseId: course.id }).expect(200)
      ).body;
      expect(list.items[0].status).toBe('CANCELLED');
      expect(list.items[0].student.id).toBe(s.id);
      const events = await h.prisma.enrolmentEvent.findMany({
        where: { enrolmentId: enrolment.id, toStatus: 'CANCELLED' },
      });
      expect(events[0]?.reason).toBe('Refunded');
      expect(events[0]?.actorId).toBe(a.id);

      // The student can enrol again after a cancellation, keeping their earlier progress rows.
      const again = (
        await a.agent
          .post('/api/v1/admin/enrolments')
          .send({ studentId: s.id, courseId: course.id })
          .expect(201)
      ).body;
      expect(again.id).not.toBe(enrolment.id);
    });

    it('renews expired access: free at once, paid through a renewal payment', async () => {
      const free = await makeCourse({ access: 'FREE', days: 30 });
      const paid = await makeCourse({ days: 30 });
      const s = await student();
      const a = await admin();
      const freeEnrolment = (await enrol(s.agent, free.id)).body;
      await a.agent
        .post('/api/v1/admin/enrolments')
        .send({ studentId: s.id, courseId: paid.id })
        .expect(201);
      const paidEnrolment = await h.prisma.enrolment.findFirstOrThrow({
        where: { studentId: s.id, courseId: paid.id },
      });
      await h.prisma.enrolment.updateMany({
        where: { id: { in: [freeEnrolment.id, paidEnrolment.id] } },
        data: { endAt: new Date(Date.now() - 86_400_000) },
      });
      expect(await enrolments.expireDue()).toBeGreaterThanOrEqual(2);

      // Free: the student renews themselves, instantly (Q4).
      const renewed = (
        await s.agent.post(`/api/v1/enrolments/${freeEnrolment.id}/renew`).expect(200)
      ).body;
      expect(renewed).toMatchObject({ status: 'ACTIVE', needsPayment: false });
      await s.agent.get(`/api/v1/learn/lessons/${free.lessonIds[0]}`).expect(200);

      // Paid: the student must pay; the course stays closed until an admin confirms.
      const wait = (await s.agent.post(`/api/v1/enrolments/${paidEnrolment.id}/renew`).expect(200))
        .body;
      expect(wait).toMatchObject({ status: 'EXPIRED', needsPayment: true });
      const info = (await s.agent.get(`/api/v1/enrolments/${paidEnrolment.id}/payment`).expect(200))
        .body;
      expect(info).toMatchObject({ kind: 'RENEWAL', canSubmit: true });
      await pay(s.agent, paidEnrolment.id, {}, false).expect(201);
      const renewal = await paymentOf(paidEnrolment.id);
      expect(renewal.kind).toBe('RENEWAL');
      expect(
        (await h.prisma.enrolment.findUniqueOrThrow({ where: { id: paidEnrolment.id } })).status,
      ).toBe('EXPIRED');
      await s.agent.get(`/api/v1/learn/lessons/${paid.lessonIds[0]}`).expect(403);

      await a.agent.post(`/api/v1/admin/payments/${renewal.id}/confirm`).expect(200);
      const open = await h.prisma.enrolment.findUniqueOrThrow({ where: { id: paidEnrolment.id } });
      expect(open.status).toBe('ACTIVE');
      expect(open.endAt!.getTime()).toBeGreaterThan(Date.now() + 25 * 86_400_000);
      await s.agent.get(`/api/v1/learn/lessons/${paid.lessonIds[0]}`).expect(200);
    });

    it('finds students by name or phone for the enrol and cash dialogs', async () => {
      const a = await admin();
      const s = await student();
      const byPhone = await a.agent
        .get('/api/v1/admin/students')
        .query({ q: s.phone.slice(-7) })
        .expect(200);
      expect(byPhone.body.items.map((x: { id: string }) => x.id)).toContain(s.id);
      const teacher = await h.makeUser({ role: 'TEACHER' });
      const none = await a.agent
        .get('/api/v1/admin/students')
        .query({ q: teacher.phone.slice(-7) })
        .expect(200);
      expect(none.body.items.map((x: { id: string }) => x.id)).not.toContain(teacher.id);
    });
  });

  // ── Jobs ────────────────────────────────────────────────────────────────

  describe('scheduled jobs', () => {
    it('cancels enrolments unpaid for 7 days, but not newer ones or ones under review', async () => {
      const course = await makeCourse();
      const old = await student();
      const fresh = await student();
      const reviewing = await student();
      const oldE = (await enrol(old.agent, course.id)).body;
      const freshE = (await enrol(fresh.agent, course.id)).body;
      const reviewE = (await enrol(reviewing.agent, course.id)).body;
      await pay(reviewing.agent, reviewE.id, {}, false).expect(201);

      const now = new Date();
      await h.prisma.enrolment.updateMany({
        where: { id: { in: [oldE.id, reviewE.id] } },
        data: { statusChangedAt: new Date(now.getTime() - 8 * 86_400_000) },
      });
      await enrolments.cancelUnpaid(now);
      const status = async (id: string) =>
        (await h.prisma.enrolment.findUniqueOrThrow({ where: { id } })).status;
      expect(await status(oldE.id)).toBe('CANCELLED');
      expect(await status(freshE.id)).toBe('AWAITING_PAYMENT');
      expect(await status(reviewE.id)).toBe('PAYMENT_SUBMITTED');
    });

    it('a rejection restarts the 7-day timer', async () => {
      const course = await makeCourse();
      const s = await student();
      const a = await admin();
      const e = (await enrol(s.agent, course.id)).body;
      await pay(s.agent, e.id, {}, false).expect(201);
      await h.prisma.enrolment.update({
        where: { id: e.id },
        data: { statusChangedAt: new Date(Date.now() - 30 * 86_400_000) },
      });
      await a.agent
        .post(`/api/v1/admin/payments/${(await paymentOf(e.id)).id}/reject`)
        .send({ reason: 'Amount short' })
        .expect(200);
      await enrolments.cancelUnpaid();
      expect((await h.prisma.enrolment.findUniqueOrThrow({ where: { id: e.id } })).status).toBe(
        'AWAITING_PAYMENT',
      );
    });

    it('expires access after the end date, and sends the 3-day reminder exactly once', async () => {
      const course = await makeCourse({ access: 'FREE', days: 30 });
      const soon = await student();
      const later = await student();
      const ended = await student();
      const soonE = (await enrol(soon.agent, course.id)).body;
      const laterE = (await enrol(later.agent, course.id)).body;
      const endedE = (await enrol(ended.agent, course.id)).body;
      const now = new Date();
      await h.prisma.enrolment.update({
        where: { id: soonE.id },
        data: { endAt: new Date(now.getTime() + 2 * 86_400_000) },
      });
      await h.prisma.enrolment.update({
        where: { id: laterE.id },
        data: { endAt: new Date(now.getTime() + 10 * 86_400_000) },
      });
      await h.prisma.enrolment.update({
        where: { id: endedE.id },
        data: { endAt: new Date(now.getTime() - 60_000) },
      });

      await enrolments.expireDue(now);
      expect(
        (await h.prisma.enrolment.findUniqueOrThrow({ where: { id: endedE.id } })).status,
      ).toBe('EXPIRED');
      expect((await h.prisma.enrolment.findUniqueOrThrow({ where: { id: soonE.id } })).status).toBe(
        'ACTIVE',
      );

      await enrolments.remindExpiring(now);
      await enrolments.remindExpiring(now);
      const count = (phone: string) =>
        h.prisma.smsMessage.count({ where: { to: phone, template: 'access.expiring' } });
      expect(await count(soon.phone)).toBe(1);
      expect(await count(later.phone)).toBe(0);
      expect(await count(ended.phone)).toBe(0);
    });
  });

  // ── Announcements feed ──────────────────────────────────────────────────

  describe('student announcements (FR-NOTIF-002)', () => {
    it('shows what the student may read, marks unread, and refuses other announcements', async () => {
      const course = await makeCourse({ access: 'FREE' });
      const other = await makeCourse({ access: 'FREE' });
      const s = await student();
      const a = await admin();
      await enrol(s.agent, course.id).expect(200);
      const tag = unique();
      const post = (title: string, audience: string, courseId?: string) =>
        a.agent
          .post('/api/v1/admin/announcements')
          .send({ title, text: 'Hello students', audience, courseId });
      await post(`All ${tag}`, 'ALL_STUDENTS').expect(201);
      await post(`Mine ${tag}`, 'COURSE', course.id).expect(201);
      await post(`Other ${tag}`, 'COURSE', other.id).expect(201);

      const feed = (await s.agent.get('/api/v1/me/announcements').expect(200)).body;
      const titles = feed.items.map((i: { title: string }) => i.title);
      expect(titles).toContain(`All ${tag}`);
      expect(titles).toContain(`Mine ${tag}`);
      expect(titles).not.toContain(`Other ${tag}`);

      const before = (await s.agent.get('/api/v1/me/announcements/unread-count').expect(200)).body
        .count;
      expect(before).toBeGreaterThanOrEqual(2);
      const target = feed.items.find((i: { title: string }) => i.title === `All ${tag}`);
      await s.agent.post(`/api/v1/me/announcements/${target.id}/read`).expect(200);
      expect(
        (await s.agent.get('/api/v1/me/announcements/unread-count').expect(200)).body.count,
      ).toBe(before - 1);

      const hidden = await h.prisma.announcement.findFirstOrThrow({
        where: { title: `Other ${tag}` },
      });
      await s.agent.post(`/api/v1/me/announcements/${hidden.id}/read`).expect(404);
      await s.agent.post('/api/v1/me/announcements/read-all').expect(200);
      expect(
        (await s.agent.get('/api/v1/me/announcements/unread-count').expect(200)).body.count,
      ).toBe(0);
    });
  });

  describe('course page state', () => {
    it('tells each person which button to show', async () => {
      const course = await makeCourse();
      const s = await student();
      const a = await admin();
      const none = (await s.agent.get(`/api/v1/me/course-state/${course.slug}`).expect(200)).body;
      expect(none.enrolment).toBeNull();
      const e = (await enrol(s.agent, course.id)).body;
      await pay(s.agent, e.id, {}, false).expect(201);
      const reviewing = (await s.agent.get(`/api/v1/me/course-state/${course.slug}`).expect(200))
        .body;
      expect(reviewing.enrolment.status).toBe('PAYMENT_SUBMITTED');
      expect(
        (await a.agent.get(`/api/v1/me/course-state/${course.slug}`).expect(200)).body,
      ).toMatchObject({
        canEdit: true,
        enrolment: null,
      });
      await h.client().get(`/api/v1/me/course-state/${course.slug}`).expect(401);
      await s.agent.get('/api/v1/me/course-state/does-not-exist').expect(404);
    });
  });
});
