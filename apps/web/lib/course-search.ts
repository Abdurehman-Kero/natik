import type { PublicCourse } from '@/lib/api/public';

/** Lower-case, no accents, so "Arabi" finds "arabī" and capitals never matter. */
const plain = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const wordsOf = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Finds courses the way people expect: every word typed must start a word in the title, language or
 * level ("eng" finds English, "adv eng" finds English for advanced level). The long summary is not
 * searched, because common words in it made nearly every course match. Best matches come first:
 * the title starting with what was typed, then a title word, then language or level.
 */
export function searchCourses<T extends Pick<PublicCourse, 'title' | 'language' | 'level'>>(
  courses: T[],
  query: string,
): T[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return courses;
  const scored: { course: T; score: number }[] = [];
  for (const course of courses) {
    const title = plain(course.title);
    const titleWords = wordsOf(title);
    const otherWords = wordsOf(plain(`${course.language.name} ${course.level.name}`));
    let score = 0;
    let all = true;
    for (const word of words) {
      if (title.startsWith(word)) score += 3;
      else if (titleWords.some((w) => w.startsWith(word))) score += 2;
      else if (otherWords.some((w) => w.startsWith(word))) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ course, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.course);
}
