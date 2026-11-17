/**
 * Two complete sample courses for local development: units, lessons with real text, a lesson quiz
 * and a final quiz, so a student can go from "enrol" to "certificate" end to end. Teachers and admins
 * edit or hide all of it like any other course (Teach › Courses). Not loaded in staging or production.
 */
import type { PrismaClient } from '../src/generated/prisma/client';

type Node = Record<string, unknown>;
const t = (text: string, bold = false): Node => ({
  type: 'text',
  text,
  ...(bold ? { marks: [{ type: 'bold' }] } : {}),
});
const p = (...parts: (string | Node)[]): Node => ({
  type: 'paragraph',
  content: parts.map((x) => (typeof x === 'string' ? t(x) : x)),
});
const h = (text: string): Node => ({ type: 'heading', attrs: { level: 2 }, content: [t(text)] });
const ul = (items: string[]): Node => ({
  type: 'bulletList',
  content: items.map((i) => ({ type: 'listItem', content: [p(i)] })),
});
const doc = (...content: Node[]) => ({ type: 'doc', content });

interface QuizSpec {
  title: string;
  instructions: string;
  isFinal?: boolean;
  passMarkPct: number;
  questions: {
    type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER';
    text: string;
    options?: { id: string; text: string }[];
    correct: unknown;
    marks?: number;
    explanation?: string;
  }[];
}
interface LessonSpec {
  title: string;
  free?: boolean;
  blocks: Node[];
  quiz?: QuizSpec;
}
interface UnitSpec {
  title: string;
  lessons: LessonSpec[];
}

const ENGLISH: UnitSpec[] = [
  {
    title: 'Meeting people',
    lessons: [
      {
        title: 'Greeting people',
        free: true,
        blocks: [
          doc(
            p(
              'Greetings open every conversation. Choose the one that fits the person and the time of day.',
            ),
            h('Common greetings'),
            ul([
              'Hello / Hi: friendly, works anywhere.',
              'Good morning / Good afternoon / Good evening: polite and clear.',
              'How are you? / How are you doing?: ask after the person.',
              'Nice to meet you: say it when you meet someone for the first time.',
            ]),
          ),
          doc(
            h('Answering "How are you?"'),
            p('Answer briefly, then ask back: ', t('"I am fine, thank you. And you?"', true)),
            p('Other answers: "Very well, thanks", "Not bad", "I am great today".'),
          ),
        ],
        quiz: {
          title: 'Greetings check',
          instructions: 'Four short questions about greetings.',
          passMarkPct: 60,
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              text: 'It is 8 a.m. Which greeting fits best?',
              options: [
                { id: 'a', text: 'Good evening' },
                { id: 'b', text: 'Good morning' },
                { id: 'c', text: 'Good night' },
              ],
              correct: 'b',
              explanation: 'Use "Good morning" until about noon.',
            },
            {
              type: 'TRUE_FALSE',
              text: '"Nice to meet you" is said when you meet someone for the first time.',
              correct: true,
            },
            {
              type: 'FILL_BLANK',
              text: 'Complete the answer: "I am fine, thank you. And ____?"',
              correct: ['you'],
            },
            {
              type: 'SHORT_ANSWER',
              text: 'Write two sentences to greet a new classmate.',
              marks: 2,
              correct: 'Hello, nice to meet you. How are you?',
            },
          ],
        },
      },
      {
        title: 'Introducing yourself',
        blocks: [
          doc(
            p('A good introduction is short: your name, where you are from, and what you do.'),
            h('A model introduction'),
            p(
              '"Hello, my name is Hana. I am from Adama. I am a student, and I am learning English to find a better job."',
            ),
            h('Useful patterns'),
            ul([
              'My name is ... / I am ...',
              'I am from ... / I live in ...',
              'I work as ... / I study ...',
              'I like ... / I want to ...',
            ]),
          ),
        ],
      },
    ],
  },
  {
    title: 'Daily life',
    lessons: [
      {
        title: 'Asking politely',
        blocks: [
          doc(
            p(
              'Polite requests make people want to help you. Add "please" and use "could" or "can".',
            ),
            h('Patterns'),
            ul([
              'Could I have a glass of water, please?',
              'Can you help me, please?',
              'Excuse me, where is the bus station?',
              'Thank you very much. / You are welcome.',
            ]),
            p('Practise by saying each sentence aloud three times.'),
          ),
        ],
        quiz: {
          title: 'Final quiz: Everyday English',
          instructions: 'Pass this quiz and finish all lessons to earn your certificate.',
          isFinal: true,
          passMarkPct: 60,
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              text: 'Which request is the most polite?',
              options: [
                { id: 'a', text: 'Give me water.' },
                { id: 'b', text: 'Water!' },
                { id: 'c', text: 'Could I have some water, please?' },
              ],
              correct: 'c',
            },
            {
              type: 'TRUE_FALSE',
              text: '"You are welcome" is a reply to "Thank you".',
              correct: true,
            },
            {
              type: 'FILL_BLANK',
              text: 'Excuse me, ____ is the bus station?',
              correct: ['where'],
            },
            {
              type: 'SHORT_ANSWER',
              text: 'Write a polite sentence asking a teacher for help.',
              marks: 2,
              correct: 'Could you help me, please?',
            },
          ],
        },
      },
    ],
  },
];

const OROMO: UnitSpec[] = [
  {
    title: 'First words',
    lessons: [
      {
        title: 'Greetings (Nagaa)',
        free: true,
        blocks: [
          doc(
            p('Afaan Oromo greetings are warm and often ask about your health and family.'),
            h('Key words'),
            ul([
              'Akkam? : How are you?',
              'Nagaadhaa? : Are you well?',
              'Galatoomi : Thank you',
              'Nagaatti : Goodbye (go in peace)',
            ]),
            p('Reply to "Akkam jirta?" with ', t('"Nagaa dha"', true), ' (I am well).'),
          ),
        ],
        quiz: {
          title: 'Greetings check',
          instructions: 'Four short questions. The last one is marked by a teacher.',
          passMarkPct: 60,
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              text: 'Which word means "thank you"?',
              options: [
                { id: 'o1', text: 'Akkam' },
                { id: 'o2', text: 'Galatoomi' },
                { id: 'o3', text: 'Nagaatti' },
              ],
              correct: 'o2',
              explanation: 'Galatoomi means thank you.',
            },
            {
              type: 'TRUE_FALSE',
              text: 'Afaan Oromo is written with Latin letters.',
              correct: true,
            },
            {
              type: 'FILL_BLANK',
              text: 'Type the greeting "how are you": ____',
              correct: ['akkam'],
            },
            {
              type: 'SHORT_ANSWER',
              text: 'Write one sentence to greet a friend.',
              marks: 2,
              correct: 'Akkam jirta?',
            },
          ],
        },
      },
      {
        title: 'Numbers 1 to 10',
        blocks: [
          doc(
            p('Learn the numbers one to ten. Say each aloud and count real things around you.'),
            ul([
              '1 tokko · 2 lama · 3 sadii · 4 afur · 5 shan',
              '6 jaha · 7 torba · 8 saddeet · 9 sagal · 10 kudhan',
            ]),
          ),
        ],
      },
    ],
  },
  {
    title: 'Family and home',
    lessons: [
      {
        title: 'My family',
        blocks: [
          doc(
            p('Use these words to talk about the people close to you.'),
            ul(['haadha : mother', 'abbaa : father', "daa'ima : child", 'maatii : family']),
            p('Practise: "Maatii koo shan dha." (My family is five.)'),
          ),
        ],
        quiz: {
          title: 'Final quiz: Afaan Oromo Basics',
          instructions: 'Pass this quiz and finish all lessons to earn your certificate.',
          isFinal: true,
          passMarkPct: 60,
          questions: [
            {
              type: 'MULTIPLE_CHOICE',
              text: 'What does "lama" mean?',
              options: [
                { id: 'a', text: 'one' },
                { id: 'b', text: 'two' },
                { id: 'c', text: 'three' },
              ],
              correct: 'b',
            },
            { type: 'TRUE_FALSE', text: '"Maatii" means family.', correct: true },
            { type: 'FILL_BLANK', text: '"Galatoomi" means thank ____.', correct: ['you'] },
            {
              type: 'SHORT_ANSWER',
              text: 'Write one sentence about your family in English or Afaan Oromo.',
              marks: 2,
              correct: 'Maatii koo shan dha.',
            },
          ],
        },
      },
    ],
  },
];

const ARABIC_INTRO = doc(
  p('Welcome. In this course you will learn to read and write the Arabic alphabet, step by step.'),
  h('How Arabic is written'),
  ul([
    'Arabic is written from right to left.',
    'There are 28 letters, and most change shape inside a word.',
    'Short vowels are small marks above or below the letters.',
  ]),
  p('This first lesson is free to preview, so you can try the course before you register.'),
);

async function addQuiz(
  prisma: PrismaClient,
  courseId: string,
  lessonId: string,
  quiz: QuizSpec,
): Promise<void> {
  const created = await prisma.quiz.create({
    data: {
      lessonId,
      courseId,
      title: quiz.title,
      instructions: quiz.instructions,
      isFinal: quiz.isFinal ?? false,
      passMarkPct: quiz.passMarkPct,
      status: 'PUBLISHED',
    },
  });
  await prisma.question.createMany({
    data: quiz.questions.map((q, i) => ({
      quizId: created.id,
      position: i + 1,
      type: q.type,
      text: q.text,
      options: q.options,
      correct: q.correct as never,
      marks: q.marks ?? 1,
      explanation: q.explanation,
    })),
  });
}

async function addLesson(
  prisma: PrismaClient,
  courseId: string,
  unitId: string,
  position: number,
  spec: LessonSpec,
): Promise<void> {
  const lesson = await prisma.lesson.create({
    data: {
      unitId,
      courseId,
      title: spec.title,
      position,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      isFreePreview: spec.free ?? false,
    },
  });
  await prisma.lessonBlock.createMany({
    data: spec.blocks.map((textJson, i) => ({
      lessonId: lesson.id,
      type: 'TEXT' as const,
      position: i + 1,
      textJson: textJson as never,
    })),
  });
  if (spec.quiz) await addQuiz(prisma, courseId, lesson.id, spec.quiz);
}

/**
 * Turns the one-line placeholder lesson of the sample courses into a real curriculum. Runs only
 * while a course still has that placeholder alone, so it never overwrites anything edited by hand.
 */
export async function seedSampleCurriculum(prisma: PrismaClient): Promise<void> {
  const plans: [string, UnitSpec[]][] = [
    ['everyday-english', ENGLISH],
    ['afaan-oromo-basics', OROMO],
  ];
  for (const [slug, units] of plans) {
    const course = await prisma.course.findUnique({ where: { slug } });
    if (!course) continue;
    const lessons = await prisma.lesson.findMany({ where: { courseId: course.id } });
    const placeholder =
      lessons.length === 1 && /^Welcome to /.test(lessons[0]!.title) ? lessons[0]! : null;
    if (lessons.length > 1 || (lessons.length === 1 && !placeholder)) continue;

    let unitPos = 1;
    let first = true;
    for (const unit of units) {
      let unitId: string;
      if (first && placeholder) {
        // Keep the placeholder lesson (students may already have used its quiz) and fill it in.
        unitId = placeholder.unitId;
        await prisma.unit.update({ where: { id: unitId }, data: { title: unit.title } });
        const spec = unit.lessons[0]!;
        await prisma.lesson.update({
          where: { id: placeholder.id },
          data: { title: spec.title, isFreePreview: spec.free ?? false },
        });
        await prisma.lessonBlock.deleteMany({ where: { lessonId: placeholder.id } });
        await prisma.lessonBlock.createMany({
          data: spec.blocks.map((textJson, i) => ({
            lessonId: placeholder.id,
            type: 'TEXT' as const,
            position: i + 1,
            textJson: textJson as never,
          })),
        });
        if (spec.quiz && !(await prisma.quiz.findUnique({ where: { lessonId: placeholder.id } }))) {
          await addQuiz(prisma, course.id, placeholder.id, spec.quiz);
        }
        let pos = 2;
        for (const lesson of unit.lessons.slice(1)) {
          await addLesson(prisma, course.id, unitId, pos++, lesson);
        }
      } else {
        const created = await prisma.unit.create({
          data: { courseId: course.id, title: unit.title, position: unitPos, status: 'PUBLISHED' },
        });
        let pos = 1;
        for (const lesson of unit.lessons) {
          await addLesson(prisma, course.id, created.id, pos++, lesson);
        }
      }
      first = false;
      unitPos++;
    }
  }

  // Paid Arabic course: one real, free-to-preview introduction instead of the placeholder text.
  const arabic = await prisma.course.findUnique({ where: { slug: 'arabic-for-beginners' } });
  if (arabic) {
    const lesson = await prisma.lesson.findFirst({
      where: { courseId: arabic.id, title: { startsWith: 'Welcome to' } },
    });
    if (lesson) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { title: 'Welcome and the alphabet' },
      });
      await prisma.lessonBlock.updateMany({
        where: { lessonId: lesson.id, position: 1 },
        data: { textJson: ARABIC_INTRO as never },
      });
    }
  }
}
