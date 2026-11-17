/**
 * Starter questions for the public "Find your level" check, written as real language questions so the
 * check works from the first day. Admins can add, change or hide them later. `band` 1 is the
 * easiest; the check suggests the level of the highest band answered well.
 */
import type { PrismaClient } from '../src/generated/prisma/client';

interface Q {
  band: number;
  text: string;
  /** The first option is the right one; they are shuffled by their ids when stored. */
  options: [string, string, string, string];
}

const ENGLISH: Q[] = [
  {
    band: 1,
    text: 'Choose the correct sentence.',
    options: ['She is a teacher.', 'She are a teacher.', 'She am a teacher.', 'Her is a teacher.'],
  },
  { band: 1, text: 'I ___ a student.', options: ['am', 'is', 'are', 'be'] },
  {
    band: 1,
    text: 'What do you say when you meet someone in the morning?',
    options: ['Good morning', 'Good night', 'Goodbye', 'Thank you'],
  },
  { band: 2, text: 'Yesterday I ___ to the market.', options: ['went', 'go', 'goes', 'going'] },
  {
    band: 2,
    text: 'She ___ breakfast every day at seven.',
    options: ['has', 'have', 'having', 'haves'],
  },
  { band: 2, text: "There aren't ___ apples left.", options: ['any', 'some', 'a', 'an'] },
  {
    band: 3,
    text: 'If I ___ more time, I would learn Arabic.',
    options: ['had', 'have', 'will have', 'am having'],
  },
  {
    band: 3,
    text: 'The report ___ by the manager before noon.',
    options: ['was finished', 'finished', 'has finish', 'finishing'],
  },
  {
    band: 3,
    text: 'He asked me where ___.',
    options: ['I lived', 'did I live', 'do I live', 'I do live'],
  },
  {
    band: 4,
    text: 'Hardly had she arrived ___ the phone rang.',
    options: ['when', 'than', 'then', 'as soon'],
  },
  {
    band: 4,
    text: 'Which sentence has the right formal tone?',
    options: [
      'I would be grateful if you could send me the details.',
      'Send me the details now.',
      'Give me the details.',
      'You must to send details.',
    ],
  },
  {
    band: 4,
    text: 'The committee insisted that he ___ the proposal.',
    options: ['withdraw', 'withdraws', 'withdrew', 'is withdrawing'],
  },
];

const ARABIC: Q[] = [
  { band: 1, text: 'ما معنى كلمة «كتاب»؟', options: ['Book', 'House', 'Water', 'Car'] },
  { band: 1, text: 'ما معنى «ماء»؟', options: ['Water', 'Bread', 'Moon', 'Door'] },
  {
    band: 1,
    text: 'كيف تقول “Good morning” بالعربية؟',
    options: ['صباح الخير', 'مساء الخير', 'شكرًا', 'مع السلامة'],
  },
  {
    band: 2,
    text: 'اختر الجملة الصحيحة.',
    options: ['هذا كتاب جديد', 'هذه كتاب جديد', 'هذا كتابة جديد', 'هذي كتاب جديدة'],
  },
  { band: 2, text: 'ما جمع كلمة «كتاب»؟', options: ['كتب', 'كاتبون', 'كتّاب', 'مكتبة'] },
  { band: 2, text: 'ما ضد كلمة «كبير»؟', options: ['صغير', 'طويل', 'جميل', 'قديم'] },
  {
    band: 3,
    text: 'في جملة «ذهبَ الطلابُ إلى المدرسة»، ما الفعل؟',
    options: ['ذهبَ', 'الطلابُ', 'إلى', 'المدرسة'],
  },
  {
    band: 3,
    text: 'ما إعراب «الطلابُ» في «ذهبَ الطلابُ»؟',
    options: ['فاعل مرفوع', 'مفعول به منصوب', 'مبتدأ', 'خبر'],
  },
  {
    band: 3,
    text: 'أيُّ الجمل صحيحة؟',
    options: ['الطالباتُ مجتهداتٌ', 'الطالباتُ مجتهدون', 'الطالباتُ مجتهدٌ', 'الطالباتَ مجتهداتٌ'],
  },
];

const OROMO: Q[] = [
  { band: 1, text: "'Galatoomi' means…", options: ['Thank you', 'Hello', 'Water', 'Goodbye'] },
  { band: 1, text: "Which word means 'two'?", options: ['lama', 'sadii', 'afur', 'tokko'] },
  {
    band: 1,
    text: "How do you ask 'How are you?'",
    options: ['Akkam jirta?', 'Eessa deemta?', 'Maqaan kee eenyu?', 'Galatoomi'],
  },
  {
    band: 2,
    text: "'Maqaan kee eenyu?' means…",
    options: ['What is your name?', 'Where are you going?', 'How old are you?', 'What time is it?'],
  },
  { band: 2, text: "'Bishaan' means…", options: ['water', 'bread', 'house', 'road'] },
  {
    band: 2,
    text: "Which word means 'mother'?",
    options: ['haadha', 'abbaa', 'obboleessa', 'ijoollee'],
  },
];

const SETS: [string, Q[]][] = [
  ['en', ENGLISH],
  ['ar', ARABIC],
  ['om', OROMO],
];

/** Adds the starter questions once per language that has none yet. */
export async function seedPlacementQuestions(prisma: PrismaClient): Promise<number> {
  let added = 0;
  for (const [code, questions] of SETS) {
    const language = await prisma.language.findUnique({ where: { code } });
    if (!language) continue;
    if ((await prisma.placementQuestion.count({ where: { languageId: language.id } })) > 0)
      continue;
    for (const [index, q] of questions.entries()) {
      const options = q.options.map((text, i) => ({ id: `o${i + 1}`, text }));
      // Put the right answer in a different place each time so it is not always first.
      const shift = index % options.length;
      const shuffled = [...options.slice(shift), ...options.slice(0, shift)];
      await prisma.placementQuestion.create({
        data: {
          languageId: language.id,
          band: q.band,
          position: index,
          text: q.text,
          options: shuffled,
          correct: 'o1',
        },
      });
      added++;
    }
  }
  return added;
}
