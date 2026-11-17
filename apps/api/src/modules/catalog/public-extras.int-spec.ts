import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from '../../test/harness';

/** Public numbers, teachers and the "Find your level" check. */
describe('public extras', () => {
  let h: Harness;
  let code = '';
  let questions: { id: string; band: number; options: { id: string; text: string }[] }[] = [];

  beforeAll(async () => {
    h = await createHarness();
    const stamp = Date.now();
    code = `p${String(stamp).slice(-4)}`;
    const language = await h.prisma.language.create({ data: { name: `Lang ${stamp}`, code } });
    // Two bands with three questions each; the right option is "ok".
    for (const band of [1, 2]) {
      for (let i = 0; i < 3; i++) {
        await h.prisma.placementQuestion.create({
          data: {
            languageId: language.id,
            band,
            position: i,
            text: `Band ${band} question ${i + 1}`,
            options: [
              { id: 'a', text: 'wrong' },
              { id: 'ok', text: 'right' },
              { id: 'c', text: 'wrong too' },
            ],
            correct: 'ok',
          },
        });
      }
    }
    await h.prisma.placementQuestion.create({
      data: {
        languageId: language.id,
        band: 1,
        text: 'Hidden question',
        options: [{ id: 'ok', text: 'right' }],
        correct: 'ok',
        active: false,
      },
    });
  });
  afterAll(async () => {
    await h?.close();
  });

  it('serves live totals and the teachers who chose to appear', async () => {
    const stats = (await h.client().get('/api/v1/public/stats').expect(200)).body;
    expect(stats).toEqual({
      courses: expect.any(Number),
      lessons: expect.any(Number),
      learners: expect.any(Number),
      languages: expect.any(Number),
    });

    const shown = await h.makeUser({ role: 'TEACHER' });
    const hidden = await h.makeUser({ role: 'TEACHER' });
    await h.prisma.user.update({
      where: { id: shown.id },
      data: { showOnWebsite: true, bio: 'A very good teacher.' },
    });
    const list = (await h.client().get('/api/v1/public/teachers').expect(200)).body.items;
    expect(list.find((t: { id: string }) => t.id === shown.id)).toMatchObject({
      bio: 'A very good teacher.',
      courses: [],
    });
    expect(list.some((t: { id: string }) => t.id === hidden.id)).toBe(false);
    // No phone numbers or other private fields.
    expect(JSON.stringify(list)).not.toContain('+251');
  });

  it('lists languages with a check, and questions without the right answers', async () => {
    const languages = (await h.client().get('/api/v1/public/placement').expect(200)).body.items;
    expect(languages.some((l: { code: string }) => l.code === code)).toBe(true);

    const body = (await h.client().get(`/api/v1/public/placement/${code}`).expect(200)).body;
    questions = body.questions;
    expect(questions).toHaveLength(6); // the hidden question is left out
    expect(JSON.stringify(body)).not.toContain('"correct"');
    expect(questions.map((q) => q.band)).toEqual([1, 1, 1, 2, 2, 2]);

    await h.client().get('/api/v1/public/placement/zz').expect(404);
  });

  it('marks the check on the server and suggests a level', async () => {
    const all = Object.fromEntries(questions.map((q) => [q.id, 'ok']));
    const best = (
      await h
        .client()
        .post(`/api/v1/public/placement/${code}/result`)
        .send({ answers: all })
        .expect(200)
    ).body;
    expect(best).toMatchObject({ score: 6, total: 6, language: { code } });
    expect(best.courses).toEqual([]);

    // Only the easy band right: stays at the first level.
    const easy = Object.fromEntries(questions.filter((q) => q.band === 1).map((q) => [q.id, 'ok']));
    const first = (
      await h
        .client()
        .post(`/api/v1/public/placement/${code}/result`)
        .send({ answers: easy })
        .expect(200)
    ).body;
    expect(first.score).toBe(3);

    // The hard band right but the easy band wrong: the easy band is the start.
    const hard = Object.fromEntries(questions.filter((q) => q.band === 2).map((q) => [q.id, 'ok']));
    const skipped = (
      await h
        .client()
        .post(`/api/v1/public/placement/${code}/result`)
        .send({ answers: hard })
        .expect(200)
    ).body;
    expect(skipped.score).toBe(3);
    expect(skipped.level).toBe(first.level);

    // Nothing answered is fine; junk is refused.
    await h
      .client()
      .post(`/api/v1/public/placement/${code}/result`)
      .send({ answers: {} })
      .expect(200);
    await h.client().post(`/api/v1/public/placement/${code}/result`).send({}).expect(400);
  });
});
