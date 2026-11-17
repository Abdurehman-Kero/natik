import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';

/** Checks the SQL-only parts of the schema that Prisma can't express. */
describe('database constraints (needs PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('has the partial unique indexes', async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'Enrolment_open_per_student_course_key',
        'Payment_referenceNorm_active_key',
        'Quiz_one_final_per_course_key'
      )`;
    expect(rows.map((r) => r.indexname).sort()).toEqual([
      'Enrolment_open_per_student_course_key',
      'Payment_referenceNorm_active_key',
      'Quiz_one_final_per_course_key',
    ]);
  });

  it('keeps the activity log read-only (FR-REP-004)', async () => {
    const entry = await prisma.auditLog.create({
      data: { action: 'TEST_ENTRY', entityType: 'Test', entityId: 'schema-int-spec' },
    });
    await expect(
      prisma.auditLog.update({ where: { id: entry.id }, data: { action: 'CHANGED' } }),
    ).rejects.toThrow(/read-only/);
    await expect(prisma.auditLog.delete({ where: { id: entry.id } })).rejects.toThrow(/read-only/);
  });
});
