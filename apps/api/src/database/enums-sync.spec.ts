import { ALL_ENUMS } from '@natik/shared';
import { describe, expect, it } from 'vitest';
import * as PrismaEnums from '../generated/prisma/enums';

/**
 * packages/shared/src/enums.ts mirrors the Prisma enums so the web app can use them
 * without the database client. This fails if the two ever drift apart.
 */
describe('shared enums match the Prisma schema', () => {
  const prismaEnums = PrismaEnums as unknown as Record<string, Record<string, string>>;

  it.each(Object.keys(ALL_ENUMS))('%s has the same values', (name) => {
    expect(prismaEnums[name], `Prisma enum ${name} is missing`).toBeDefined();
    const shared = Object.values(ALL_ENUMS[name as keyof typeof ALL_ENUMS]).sort();
    const prisma = Object.values(prismaEnums[name] ?? {}).sort();
    expect(shared).toEqual(prisma);
  });

  it('covers every Prisma enum', () => {
    const prismaNames = Object.keys(prismaEnums).filter(
      (key) => typeof prismaEnums[key] === 'object' && prismaEnums[key] !== null,
    );
    expect(Object.keys(ALL_ENUMS).sort()).toEqual(prismaNames.sort());
  });
});
