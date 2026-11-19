/**
 * Moves the files kept inside the database (STORAGE_DRIVER=database, the free pilot) into an
 * S3-compatible bucket, for the day the pilot becomes the real site. It only copies: nothing is
 * deleted from the database, and running it twice is harmless.
 *
 *   1. Create the bucket and its access keys.
 *   2. Set DATABASE_URL (the pilot database) and S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY,
 *      S3_SECRET_KEY (the bucket) in the environment.
 *   3. cd apps/api && pnpm exec tsx prisma/copy-files-to-s3.ts
 *   4. Set STORAGE_DRIVER=s3 on the API (and the same S3_* values) and restart it.
 *
 * The file records in the database already hold the same keys, so nothing else changes.
 */
import { existsSync } from 'node:fs';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

if (existsSync('.env')) process.loadEnvFile('.env');

const BATCH = 20;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set.`);
  return value;
}

async function exists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const bucket = required('S3_BUCKET');
  const s3 = new S3Client({
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION ?? 'auto',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY'),
      secretAccessKey: required('S3_SECRET_KEY'),
    },
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
  });

  let copied = 0;
  let skipped = 0;
  try {
    const keys = await prisma.storedObject.findMany({
      select: { key: true },
      orderBy: { createdAt: 'asc' },
    });
    console.warn(`${keys.length} files in the database. Copying to bucket "${bucket}"…`);
    for (let i = 0; i < keys.length; i += BATCH) {
      const rows = await prisma.storedObject.findMany({
        where: { key: { in: keys.slice(i, i + BATCH).map((k) => k.key) } },
      });
      for (const row of rows) {
        if (await exists(s3, bucket, row.key)) {
          skipped += 1;
          continue;
        }
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: row.key,
            Body: Buffer.from(row.data),
            ContentType: row.contentType,
          }),
        );
        copied += 1;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  console.warn(`Done: ${copied} copied, ${skipped} were already there.`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
