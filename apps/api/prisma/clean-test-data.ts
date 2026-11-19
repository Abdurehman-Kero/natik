/**
 * Removes the courses, levels and accounts that automated tests leave behind in the development
 * database, so the public catalogue, the admin lists and the numbers on the home page only show real
 * sample content. Safe to run any time: it only touches names the tests generate, and never the three
 * sample accounts from `pnpm db:seed`. Never run against production.
 *
 *   pnpm --filter @natik/api exec tsx prisma/clean-test-data.ts            (clean)
 *   pnpm --filter @natik/api exec tsx prisma/clean-test-data.ts --dry-run  (only list what would go)
 */
import { existsSync } from 'node:fs';
import { Client } from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');

const TEST_COURSES = `title ~ '^(Quiz course|Someone else''s course|Upload test|Guided course|Journey course) .+' OR title ~ '^Arabic for Beginners [0-9]+$'`;
const TEST_LEVELS = `name ~ '^Level [0-9]+$'`;
/** Accounts the tests register. The sample accounts (phones below) are always kept. */
const TEST_USERS = `role IN ('STUDENT', 'TEACHER')
  AND (phone IS NULL OR phone NOT IN ('+251911000000', '+251911000001', '+251911000002'))
  AND ("fullName" ~ '^(Abdi K[.] Kedir|Abdi Kedir)$'
    OR "fullName" ~ '^Teacher [0-9]+$'
    OR "fullName" ~ '^(Former student|Help Student|Amina Newcomer|Amina Test|Test Person|Shot Student)$'
    OR "fullName" ~ '^(Sara Group|Outsider|Abel Group|Poster Student|Screens Student) [0-9]+$'
    OR "fullName" ~ '^(Meron Place|Chat Student|Academy Student|Area Student|Bar Student|Shot Student|ENE|E2E) .+'
    OR "fullName" ~ ' [A-Z0-9]{6,8}$')`;
const DRY_RUN = process.argv.includes('--dry-run');
const wouldRemove = new Map<string, number>();

interface Fk {
  child: string;
  column: string;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required.');
  if (/prod/i.test(url)) throw new Error('Refusing to run against a production-looking database.');
  const db = new Client({ connectionString: url.replace(/\?schema=.*$/, '') });
  await db.connect();

  const fkCache = new Map<string, Fk[]>();
  async function fks(parent: string): Promise<Fk[]> {
    const cached = fkCache.get(parent);
    if (cached) return cached;
    const { rows } = await db.query<Fk>(
      `SELECT c.conrelid::regclass::text AS child, a.attname AS "column"
         FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.confrelid = $1::regclass AND array_length(c.conkey, 1) = 1`,
      [`"${parent}"`],
    );
    const list = rows.map((r) => ({ child: r.child.replace(/"/g, ''), column: r.column }));
    fkCache.set(parent, list);
    return list;
  }

  const idCache = new Map<string, boolean>();
  async function hasId(table: string): Promise<boolean> {
    const known = idCache.get(table);
    if (known !== undefined) return known;
    const { rowCount } = await db.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'id'`,
      [table],
    );
    idCache.set(table, !!rowCount);
    return !!rowCount;
  }

  /** Deletes the rows with these ids, and first everything that points at them. */
  async function remove(table: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    if (DRY_RUN) wouldRemove.set(table, (wouldRemove.get(table) ?? 0) + ids.length);
    for (const { child, column } of await fks(table)) {
      if (!(await hasId(child))) {
        if (DRY_RUN) {
          const { rows } = await db.query<{ n: string }>(
            `SELECT count(*) AS n FROM "${child}" WHERE "${column}" = ANY($1)`,
            [ids],
          );
          wouldRemove.set(child, (wouldRemove.get(child) ?? 0) + Number(rows[0]!.n));
        } else {
          await db.query(`DELETE FROM "${child}" WHERE "${column}" = ANY($1)`, [ids]);
        }
        continue;
      }
      const { rows } = await db.query<{ id: string }>(
        `SELECT id FROM "${child}" WHERE "${column}" = ANY($1)`,
        [ids],
      );
      await remove(
        child,
        rows.map((r) => r.id),
      );
    }
    if (!DRY_RUN) await db.query(`DELETE FROM "${table}" WHERE id = ANY($1)`, [ids]);
  }

  await db.query('BEGIN');
  try {
    const courses = await db.query<{ id: string }>(`SELECT id FROM "Course" WHERE ${TEST_COURSES}`);
    await remove(
      'Course',
      courses.rows.map((r) => r.id),
    );
    const chats = await db.query<{ id: string }>(
      `SELECT c.id FROM "Conversation" c JOIN "User" u ON u.id = c."ownerId" WHERE u."fullName" LIKE 'Chat Student %'`,
    );
    await remove(
      'Conversation',
      chats.rows.map((r) => r.id),
    );
    await db.query(
      `DELETE FROM "FileAsset" f WHERE f.purpose = 'CHAT_ATTACHMENT' AND NOT EXISTS (SELECT 1 FROM "ChatMessage" m WHERE m."fileId" = f.id)`,
    );
    const levels = await db.query<{ id: string }>(
      `SELECT id FROM "Level" l WHERE ${TEST_LEVELS} AND NOT EXISTS (SELECT 1 FROM "Course" c WHERE c."levelId" = l.id)`,
    );
    await remove(
      'Level',
      levels.rows.map((r) => r.id),
    );
    const users = await db.query<{ id: string }>(`SELECT id FROM "User" WHERE ${TEST_USERS}`);
    for (let i = 0; i < users.rows.length; i += 200) {
      await remove(
        'User',
        users.rows.slice(i, i + 200).map((r) => r.id),
      );
    }
    if (DRY_RUN) {
      await db.query('ROLLBACK');
      console.log(`Dry run: ${users.rowCount} test accounts would be removed, with these rows:`);
      console.table([...wouldRemove].map(([table, rows]) => ({ table, rows })));
      return;
    }
    await db.query('COMMIT');
    console.log(
      `Removed ${courses.rowCount} test courses, ${levels.rowCount} test levels and ${users.rowCount} test accounts.`,
    );
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

void main();
