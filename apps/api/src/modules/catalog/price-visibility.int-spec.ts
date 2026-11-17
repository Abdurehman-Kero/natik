import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

/** Paid courses can keep their price off the public site; messages stop counting once seen. */
describe('price visibility and seen messages', () => {
  let h: Harness;
  let admin: Awaited<ReturnType<Harness['signIn']>>;
  let shown = '';
  let hidden = '';
  let code = '';
  let languageId = '';
  let levelId = '';

  beforeAll(async () => {
    h = await createHarness();
    await h.resetLimits();
    const stamp = Date.now();
    const branch = await h.prisma.branch.findFirstOrThrow();
    const language = await h.prisma.language.create({
      data: { name: `Lang ${stamp}`, code: `v${String(stamp).slice(-4)}` },
    });
    const level = await h.prisma.level.create({ data: { name: `Level ${stamp}` } });
    code = language.code;
    languageId = language.id;
    levelId = level.id;
    const make = async (suffix: string, showPrice: boolean) =>
      (
        await h.prisma.course.create({
          data: {
            branchId: branch.id,
            slug: `price-${suffix}-${stamp}`,
            title: `Price ${suffix} ${stamp}`,
            summary: 'A course used by the price visibility tests.',
            languageId: language.id,
            levelId: level.id,
            access: 'PAID',
            priceSantim: 150_000,
            showPrice,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        })
      ).slug;
    shown = await make('shown', true);
    hidden = await make('hidden', false);
    const a = await h.makeUser({ role: 'ADMIN' });
    admin = await h.signIn(a.phone, a.password);
  });
  afterAll(async () => {
    await h?.close();
  });

  it('the public site shows a price only when the admin chose to', async () => {
    const visible = (await h.client().get(`/api/v1/public/courses/${shown}`).expect(200)).body;
    expect(visible).toMatchObject({ access: 'PAID', priceSantim: 150_000, showPrice: true });
    const secret = (await h.client().get(`/api/v1/public/courses/${hidden}`).expect(200)).body;
    expect(secret).toMatchObject({ access: 'PAID', priceSantim: null, showPrice: false });

    const list = (await h.client().get(`/api/v1/public/courses?language=${code}`).expect(200)).body
      .items;
    const row = list.find((c: { slug: string }) => c.slug === hidden);
    expect(row.priceSantim).toBeNull();
    expect(JSON.stringify(list.filter((c: { slug: string }) => c.slug === hidden))).not.toContain(
      '150000',
    );
  });

  it('an admin chooses it on the course form', async () => {
    const form = {
      title: `Form course ${Date.now()}`,
      languageId,
      levelId,
      summary: 'A course made by the price visibility test.',
      outcomes: [],
      access: 'PAID',
      priceSantim: 120_000,
      showPrice: false,
    };
    const created = (await admin.post('/api/v1/admin/courses').send(form).expect(201)).body;
    expect(created).toMatchObject({ showPrice: false, priceSantim: 120_000 }); // admins still see it
    const changed = (
      await admin
        .patch(`/api/v1/admin/courses/${created.id}`)
        .send({ ...form, showPrice: true })
        .expect(200)
    ).body;
    expect(changed.showPrice).toBe(true);
  });

  it('opening the Messages page takes the messages off the unread count', async () => {
    await h
      .client()
      .post('/api/v1/public/contact')
      .send({
        name: 'Seen Visitor',
        phone: '+251911223344',
        message: 'Hello, I have a question about the course.',
      })
      .expect(200);
    const mine = await h.prisma.inboxMessage.findFirstOrThrow({
      where: { name: 'Seen Visitor' },
      orderBy: { createdAt: 'desc' },
    });
    const before = (await admin.get('/api/v1/admin/messages/count').expect(200)).body.count;
    await admin
      .post('/api/v1/admin/messages/seen')
      .send({ ids: [mine.id] })
      .expect(200);
    const after = (await admin.get('/api/v1/admin/messages/count').expect(200)).body.count;
    expect(after).toBe(before - 1);
    // Seeing it twice changes nothing, and the message is still open until an admin closes it.
    await admin
      .post('/api/v1/admin/messages/seen')
      .send({ ids: [mine.id] })
      .expect(200);
    expect((await admin.get('/api/v1/admin/messages/count').expect(200)).body.count).toBe(after);
    expect((await h.prisma.inboxMessage.findUniqueOrThrow({ where: { id: mine.id } })).status).toBe(
      'NEW',
    );
  });
});
