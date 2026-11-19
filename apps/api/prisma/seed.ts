/**
 * Seeds reference data. Safe to run repeatedly: it upserts and never overwrites passwords.
 *   - "Main Centre" branch
 *   - Languages (Arabic RTL, English, Afaan Oromo) and levels
 *   - The first Owner admin, from SEED_OWNER_* variables
 *   - Local development only: one teacher and one student
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import sharp from 'sharp';
import { hashPassword } from '../src/common/security/password-hasher';
import { PrismaClient, Role, TextDirection } from '../src/generated/prisma/client';
import { seedPlacementQuestions } from './placement-questions';
import { seedSampleCurriculum } from './sample-lessons';

if (existsSync('.env')) process.loadEnvFile('.env');

const E164_ETHIOPIA_MOBILE = /^\+251[79]\d{8}$/;

const LANGUAGES = [
  { code: 'ar', name: 'Arabic', direction: TextDirection.RTL, position: 1 },
  { code: 'en', name: 'English', direction: TextDirection.LTR, position: 2 },
  { code: 'om', name: 'Afaan Oromo', direction: TextDirection.LTR, position: 3 },
];

const LEVELS = [
  { name: 'Beginner', position: 1 },
  { name: 'Intermediate', position: 2 },
  { name: 'Upper Intermediate', position: 3 },
  { name: 'Advanced', position: 4 },
];

const DEV_USERS = [
  {
    fullName: 'Ustaz Ahmed',
    phone: '+251911000001',
    email: 'teacher@natik.test',
    password: 'Teacher2026',
    role: Role.TEACHER,
  },
  {
    fullName: 'Abdi Kedir',
    phone: '+251911000002',
    email: 'student@natik.test',
    password: 'Student2026',
    role: Role.STUDENT,
  },
  {
    fullName: 'Abdushakur Mohammed',
    phone: '+251911000003',
    email: 'abdushakur@natik.test',
    password: 'Teacher2026',
    role: Role.TEACHER,
  },
  {
    fullName: 'Mohammed Ammin',
    phone: '+251911000004',
    email: 'ammin@natik.test',
    password: 'Teacher2026',
    role: Role.TEACHER,
  },
];

/** Teachers shown on the website (sample data: edit or hide them in Admin › Users). */
const SAMPLE_TEACHERS = [
  {
    phone: '+251911000003',
    bio: 'Arabic and Afaan Oromo teacher. Helps learners read, write and speak with confidence.',
  },
  {
    phone: '+251911000004',
    bio: 'English teacher. Focuses on clear speaking, writing and real conversations.',
  },
];

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for seeding (see apps/api/.env.example).`);
  return value;
}

async function upsertUser(
  prisma: PrismaClient,
  branchId: string,
  user: {
    fullName: string;
    phone: string;
    email?: string;
    password: string;
    role: Role;
    isOwner?: boolean;
  },
): Promise<'created' | 'kept'> {
  if (!E164_ETHIOPIA_MOBILE.test(user.phone)) {
    throw new Error(`Phone ${user.phone} must look like +2519XXXXXXXX or +2517XXXXXXXX.`);
  }
  const existing = await prisma.user.findUnique({ where: { phone: user.phone } });
  if (existing) {
    // People sign in with their email: give an older sample account one if it has none yet.
    if (!existing.email && user.email) {
      await prisma.user.update({ where: { id: existing.id }, data: { email: user.email } });
    }
    return 'kept';
  }
  const now = new Date();
  await prisma.user.create({
    data: {
      branchId,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email ?? null,
      passwordHash: await hashPassword(user.password),
      role: user.role,
      isOwner: user.isOwner ?? false,
      phoneVerifiedAt: now,
      termsAcceptedAt: now,
      ageConfirmedAt: now,
    },
  });
  return 'created';
}

const SAMPLE_COURSES = [
  {
    slug: 'arabic-for-beginners',
    title: 'Arabic for Beginners',
    language: 'ar',
    level: 'Beginner',
    summary:
      'Read and write the Arabic alphabet, learn short vowels and greet people with confidence.',
    outcomes: ['Read all 28 letters', 'Use short vowels correctly', 'Greet and introduce yourself'],
    durationText: '8 weeks',
    access: 'PAID' as const,
    priceSantim: 150_000,
    accessDays: 90,
    featuredPosition: 1,
  },
  {
    slug: 'everyday-english',
    title: 'Everyday English',
    language: 'en',
    level: 'Intermediate',
    summary: 'Speak and write clearly about daily life, work and study with practical phrases.',
    outcomes: ['Hold everyday conversations', 'Write short emails', 'Understand common phrases'],
    durationText: '10 weeks',
    access: 'FREE' as const,
    priceSantim: null,
    accessDays: null,
    featuredPosition: 2,
  },
  {
    slug: 'afaan-oromo-basics',
    title: 'Afaan Oromo Basics',
    language: 'om',
    level: 'Beginner',
    summary: 'Start speaking Afaan Oromo: greetings, numbers, family and everyday words.',
    outcomes: ['Greet people politely', 'Count and tell the time', 'Talk about family and home'],
    durationText: '6 weeks',
    access: 'FREE' as const,
    priceSantim: null,
    accessDays: null,
    featuredPosition: 3,
  },
  // Premium (paid) sample courses. All of this can be edited later in Admin › Courses.
  {
    slug: 'afaan-oromo-conversation',
    title: 'Afaan Oromo Conversation',
    language: 'om',
    level: 'Intermediate',
    summary:
      'Speak Afaan Oromo naturally: daily conversations, the market, travel and talking about your work.',
    outcomes: [
      'Hold longer conversations',
      'Use past and future forms',
      'Understand native speakers',
    ],
    durationText: '12 weeks',
    access: 'PAID' as const,
    priceSantim: 180_000,
    accessDays: 120,
    featuredPosition: 4,
    teachers: ['+251911000003'],
  },
  {
    slug: 'arabic-grammar-and-reading',
    title: 'Arabic Grammar & Reading',
    language: 'ar',
    level: 'Upper Intermediate',
    summary:
      'Build solid Arabic grammar and read real texts with understanding, with vowels and without.',
    outcomes: ['Read unvowelled texts', 'Use verb forms correctly', 'Write clear paragraphs'],
    durationText: '14 weeks',
    access: 'PAID' as const,
    priceSantim: 220_000,
    accessDays: 150,
    featuredPosition: 5,
    teachers: ['+251911000003'],
  },
  {
    slug: 'professional-english',
    title: 'Professional English',
    language: 'en',
    level: 'Advanced',
    summary: 'English for work: meetings, emails, presentations and interviews with confidence.',
    outcomes: [
      'Write professional emails',
      'Present and take part in meetings',
      'Prepare for interviews',
    ],
    durationText: '10 weeks',
    access: 'PAID' as const,
    priceSantim: 250_000,
    accessDays: 120,
    featuredPosition: 6,
    teachers: ['+251911000004'],
  },
];

/**
 * Stand-in photos (free-licence stock, see plan/assets/IMAGE-CREDITS.md). They are stored and served
 * exactly like images teachers will upload in M3, and are replaced with Natik's own before launch.
 */
async function ensureCourseImage(
  prisma: PrismaClient,
  courseId: string,
  slug: string,
): Promise<void> {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.imageFileId) return;
  const source = path.join(__dirname, 'sample-images', `${slug}.jpg`);
  if (!existsSync(source)) return;

  const webp = await sharp(readFileSync(source))
    .resize(1200, 675, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80 })
    .toBuffer();
  const key = `courses/${slug}.webp`;
  if (process.env.STORAGE_DRIVER === 'database') {
    // The free pilot keeps files inside PostgreSQL, like the API does.
    const data = new Uint8Array(webp);
    await prisma.storedObject.upsert({
      where: { key },
      create: { key, contentType: 'image/webp', size: webp.length, data },
      update: { contentType: 'image/webp', size: webp.length, data },
    });
  } else {
    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9010',
      region: process.env.S3_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? 'natik',
        secretAccessKey: process.env.S3_SECRET_KEY ?? 'natik-dev-secret',
      },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET ?? 'natik-private',
        Key: key,
        Body: webp,
        ContentType: 'image/webp',
      }),
    );
  }
  const file = await prisma.fileAsset.create({
    data: {
      purpose: 'COURSE_IMAGE',
      storageKey: key,
      mime: 'image/webp',
      sizeBytes: webp.length,
      originalName: `${slug}.jpg`,
    },
  });
  await prisma.course.update({ where: { id: courseId }, data: { imageFileId: file.id } });
}

/** Local development only: sample courses and news so the public pages have something to show. */
async function seedSampleContent(prisma: PrismaClient, branchId: string): Promise<void> {
  const teacher = await prisma.user.findUnique({ where: { phone: DEV_USERS[0]!.phone } });
  if (teacher && !teacher.bio) {
    // The sample teacher appears on the website so the teacher sections have someone to show.
    await prisma.user.update({
      where: { id: teacher.id },
      data: {
        showOnWebsite: true,
        bio: 'Teaches Arabic and English to beginners, with ten years of classroom experience.',
      },
    });
  }
  for (const t of SAMPLE_TEACHERS) {
    await prisma.user.updateMany({
      where: { phone: t.phone, bio: null },
      data: { showOnWebsite: true, bio: t.bio },
    });
  }
  const owner = await prisma.user.findFirst({ where: { isOwner: true } });
  for (const sample of SAMPLE_COURSES) {
    const language = await prisma.language.findUniqueOrThrow({ where: { code: sample.language } });
    const level = await prisma.level.findUniqueOrThrow({ where: { name: sample.level } });
    const course = await prisma.course.upsert({
      where: { slug: sample.slug },
      update: {},
      create: {
        branchId,
        slug: sample.slug,
        title: sample.title,
        languageId: language.id,
        levelId: level.id,
        summary: sample.summary,
        outcomes: sample.outcomes,
        durationText: sample.durationText,
        access: sample.access,
        priceSantim: sample.priceSantim,
        // Premium sample courses are paid monthly: the price stays off the public site.
        showPrice: sample.access !== 'PAID',
        accessDays: sample.accessDays,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        featured: true,
        featuredPosition: sample.featuredPosition,
      },
    });
    try {
      await ensureCourseImage(prisma, course.id, sample.slug);
    } catch (error) {
      console.warn(
        `! Could not upload the sample image for ${sample.slug} (is storage running?)`,
        error instanceof Error ? error.message : error,
      );
    }
    const phones = (sample as { teachers?: string[] }).teachers ?? [DEV_USERS[0]!.phone];
    for (const phone of phones) {
      const assigned = await prisma.user.findUnique({ where: { phone } });
      if (!assigned) continue;
      await prisma.courseTeacher.upsert({
        where: { courseId_teacherId: { courseId: course.id, teacherId: assigned.id } },
        update: {},
        create: { courseId: course.id, teacherId: assigned.id },
      });
    }
  }
  if (owner && (await prisma.announcement.count({ where: { audience: 'PUBLIC' } })) === 0) {
    await prisma.announcement.create({
      data: {
        branchId,
        authorId: owner.id,
        audience: 'PUBLIC',
        title: 'New term registration is open',
        body: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Register now to join this term’s Arabic, English and Afaan Oromo courses.',
                },
              ],
            },
          ],
        },
      },
    });
  }
  // One free sample lesson per course, so the Free lessons page has something to show.
  for (const sample of SAMPLE_COURSES) {
    const course = await prisma.course.findUniqueOrThrow({ where: { slug: sample.slug } });
    if ((await prisma.unit.count({ where: { courseId: course.id } })) > 0) continue;
    const unit = await prisma.unit.create({
      data: { courseId: course.id, title: 'Getting started', position: 1, status: 'PUBLISHED' },
    });
    const lesson = await prisma.lesson.create({
      data: {
        unitId: unit.id,
        courseId: course.id,
        title: `Welcome to ${sample.title}`,
        position: 1,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isFreePreview: true,
      },
    });
    await prisma.lessonBlock.create({
      data: {
        lessonId: lesson.id,
        type: 'TEXT',
        position: 1,
        textJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: `This is a sample lesson for ${sample.title}. Real lessons are added by the teachers.`,
                },
              ],
            },
          ],
        },
      },
    });
  }
  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: [
        {
          name: 'Sample student',
          quote: 'The lessons are short and clear, and I can study from my phone after work.',
          courseLabel: 'Sample quote',
          position: 1,
        },
        {
          name: 'Sample student',
          quote: 'My teacher answers my questions quickly. I finally feel confident speaking.',
          courseLabel: 'Sample quote',
          position: 2,
        },
        {
          name: 'Sample student',
          quote: 'Paying by bank transfer was easy, and I got a text as soon as my course opened.',
          courseLabel: 'Sample quote',
          position: 3,
        },
      ],
    });
  }
  // More sample quotes, so the testimonial slider on the home page has enough to show.
  if ((await prisma.testimonial.count()) < 6) {
    const have = await prisma.testimonial.count();
    await prisma.testimonial.createMany({
      data: [
        {
          name: 'Selam T.',
          quote:
            'I learned the Arabic letters in three weeks. The slides and the quiz made it easy to remember.',
          courseLabel: 'Arabic for Beginners',
          position: have + 1,
        },
        {
          name: 'Dawit M.',
          quote:
            'Professional English helped me write better emails at work. My manager noticed the difference.',
          courseLabel: 'Professional English',
          position: have + 2,
        },
        {
          name: 'Hana A.',
          quote:
            'Finally I can speak Afaan Oromo with my grandparents. The conversation lessons are wonderful.',
          courseLabel: 'Afaan Oromo Conversation',
          position: have + 3,
        },
      ],
    });
  }
  // Stand-in payment accounts so the payment screen can be tried. Replaced by Natik's real ones in
  // Admin › Settings › Payment accounts before launch.
  if ((await prisma.paymentAccount.count()) === 0) {
    await prisma.paymentAccount.createMany({
      data: [
        {
          type: 'BANK',
          provider: 'CBE (sample)',
          accountName: 'Natik Language Centre',
          accountNumber: '1000123456789',
          position: 1,
        },
        {
          type: 'MOBILE_WALLET',
          provider: 'telebirr (sample)',
          accountName: 'Natik Language Centre',
          accountNumber: '0911223344',
          position: 2,
        },
      ],
    });
  }
  await seedSampleCurriculum(prisma);
  // A small sample quiz on the Afaan Oromo lesson, so quizzes can be tried straight away. Passing it
  // finishes that course (it has no final quiz), which issues a certificate.
  const oromo = await prisma.course.findUnique({ where: { slug: 'afaan-oromo-basics' } });
  const oromoLesson = oromo
    ? await prisma.lesson.findFirst({ where: { courseId: oromo.id }, orderBy: { position: 'asc' } })
    : null;
  if (
    oromo &&
    oromoLesson &&
    (await prisma.quiz.count({ where: { lessonId: oromoLesson.id } })) === 0
  ) {
    const quiz = await prisma.quiz.create({
      data: {
        lessonId: oromoLesson.id,
        courseId: oromo.id,
        title: 'Greetings check',
        instructions: 'Four short questions. The last one is marked by a teacher.',
        passMarkPct: 60,
        status: 'PUBLISHED',
      },
    });
    const options = [
      { id: 'o1', text: 'Akkam' },
      { id: 'o2', text: 'Galatoomi' },
      { id: 'o3', text: 'Nagaatti' },
    ];
    await prisma.question.createMany({
      data: [
        {
          quizId: quiz.id,
          position: 1,
          type: 'MULTIPLE_CHOICE',
          text: 'Which word means "thank you"?',
          options,
          correct: 'o2',
          explanation: 'Galatoomi means thank you.',
        },
        {
          quizId: quiz.id,
          position: 2,
          type: 'TRUE_FALSE',
          text: 'Afaan Oromo is written with Latin letters.',
          correct: true,
        },
        {
          quizId: quiz.id,
          position: 3,
          type: 'FILL_BLANK',
          text: 'Type the greeting "hello" (how are you): ____',
          correct: ['akkam'],
        },
        {
          quizId: quiz.id,
          position: 4,
          type: 'SHORT_ANSWER',
          text: 'Write one sentence to greet a friend.',
          marks: 2,
          correct: 'Akkam jirta?',
        },
      ],
    });
  }
  const placement = await seedPlacementQuestions(prisma);
  console.log(
    `✓ Dev sample courses (${SAMPLE_COURSES.length}), free lessons, quotes and news, ${placement} level-check questions`,
  );
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required('DATABASE_URL') }),
  });

  try {
    const branch = await prisma.branch.upsert({
      where: { name: 'Main Centre' },
      update: {},
      create: { name: 'Main Centre' },
    });

    for (const language of LANGUAGES) {
      await prisma.language.upsert({
        where: { code: language.code },
        update: {},
        create: language,
      });
    }
    for (const level of LEVELS) {
      await prisma.level.upsert({
        where: { name: level.name },
        update: { position: level.position },
        create: level,
      });
    }

    // The owner signs in with this email. Only local development may fall back to a sample address.
    const ownerEmail =
      process.env.SEED_OWNER_EMAIL?.trim().toLowerCase() ||
      ((process.env.APP_ENV ?? 'local') === 'local'
        ? 'owner@natik.test'
        : required('SEED_OWNER_EMAIL'));
    const owner = await upsertUser(prisma, branch.id, {
      fullName: process.env.SEED_OWNER_NAME?.trim() || 'Natik Owner',
      phone: required('SEED_OWNER_PHONE'),
      email: ownerEmail,
      password: required('SEED_OWNER_PASSWORD'),
      role: Role.ADMIN,
      isOwner: true,
    });
    console.log(`✓ Branch, ${LANGUAGES.length} languages, ${LEVELS.length} levels`);

    // Natik's real contact details (from Natik). Only set when nothing is saved yet, so changes made
    // later in Admin › Website are never overwritten.
    const contact = await prisma.siteContent.findUnique({ where: { key: 'contact' } });
    if (!contact) {
      await prisma.siteContent.create({
        data: {
          key: 'contact',
          value: {
            phone: '+251 93 591 5874',
            telegram: 'https://t.me/natikfluent',
            telegramContact: 'https://t.me/Natikfluency',
          },
        },
      });
      console.log('✓ Contact details (phone, Telegram)');
    }
    console.log(`✓ Owner admin ${owner}`);

    if ((process.env.APP_ENV ?? 'local') === 'local') {
      for (const user of DEV_USERS) {
        const result = await upsertUser(prisma, branch.id, user);
        console.log(`✓ Dev ${user.role.toLowerCase()} ${user.phone} ${result}`);
      }
      await seedSampleContent(prisma, branch.id);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
