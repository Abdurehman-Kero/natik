import type { LessonStageName, LessonViewBlock, LessonViewModel } from '@/lib/api/types';

export type LessonStepKey = 'INTRO' | 'PREPARE' | 'MAIN' | LessonStageName;

export interface LessonStep {
  key: LessonStepKey;
  blocks: LessonViewBlock[];
}

/** The order of a guided lesson. "MAIN" holds blocks the teacher did not put in a stage. */
const ORDER: LessonStepKey[] = ['INTRO', 'PREPARE', 'MAIN', 'WATCH', 'REVISE', 'EXAMPLES'];

/**
 * Splits a lesson into the steps a student walks through. Steps with nothing in them are skipped, so a
 * lesson built the old way (no stages) is a single step and looks exactly as it always did.
 */
export function lessonSteps(lesson: LessonViewModel): LessonStep[] {
  const steps: LessonStep[] = [];
  const hasIntro =
    Boolean(lesson.description) || lesson.objectives.length > 0 || lesson.estimatedMinutes !== null;
  for (const key of ORDER) {
    if (key === 'INTRO') {
      if (hasIntro) steps.push({ key, blocks: [] });
      continue;
    }
    const blocks = lesson.blocks.filter((b) =>
      key === 'MAIN' ? b.stage === null : b.stage === key,
    );
    if (blocks.length > 0) steps.push({ key, blocks });
  }
  return steps;
}

/** A lesson with a single step is shown flat, without the step bar. */
export function isGuided(steps: LessonStep[]): boolean {
  return steps.length > 1;
}
