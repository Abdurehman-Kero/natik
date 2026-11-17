/**
 * Removes the courses and levels that automated browser tests leave behind in the development
 * database, so the public catalogue only shows real sample content. Safe to run any time:
 * it only touches names the tests generate. Never run against production.
 *
 *   pnpm --filter @natik/api exec tsx prisma/clean-test-data.ts
 */
import { Client } from 'pg';

const TEST_COURSES = `title ~ '^(Quiz course|Someone else''s course|Upload test|Guided course|Journey course) .+' OR title ~ '^Arabic for Beginners [0-9]+$'`;
const TEST_LEVELS = `name ~ '^Level [0-9]+$'`;

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
    for (const { child, column } of await fks(table)) {
      if (!(await hasId(child))) {
        await db.query(`DELETE FROM "${child}" WHERE "${column}" = ANY($1)`, [ids]);
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
    await db.query(`DELETE FROM "${table}" WHERE id = ANY($1)`, [ids]);
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
    await db.query('COMMIT');
    console.log(`Removed ${courses.rowCount} test courses and ${levels.rowCount} test levels.`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

void main();
