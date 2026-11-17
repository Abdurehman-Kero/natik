import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicCatalogService } from './public-catalog.service';

/** Questions asked per band, so a check takes a few minutes. */
const PER_BAND = 3;
/** Share of a band's questions that must be right to count as "reached". */
const PASS_SHARE = 0.6;

export interface PlacementOption {
  id: string;
  text: string;
}

/** Numbers, teachers and the "Find your level" check shown on the public site. Everything is counted live. */
@Injectable()
export class PublicExtrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: PublicCatalogService,
  ) {}

  /** Live totals for the home page. The page decides what is big enough to show. */
  async stats() {
    const [courses, lessons, learners, languages] = await Promise.all([
      this.prisma.course.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.lesson.count({
        where: {
          status: 'PUBLISHED',
          unit: { status: 'PUBLISHED' },
          course: { status: 'PUBLISHED' },
        },
      }),
      this.prisma.user.count({ where: { role: 'STUDENT', status: 'ACTIVE' } }),
      this.prisma.language.count({ where: { active: true } }),
    ]);
    return { courses, lessons, learners, languages };
  }

  /** Teachers who chose to appear on the website, with the languages of their published courses. */
  async teachers() {
    const rows = await this.prisma.user.findMany({
      where: { role: 'TEACHER', status: 'ACTIVE', showOnWebsite: true },
      orderBy: { fullName: 'asc' },
      take: 60,
      select: {
        id: true,
        fullName: true,
        bio: true,
        photoFileId: true,
        teachingCourses: {
          where: { course: { status: 'PUBLISHED' } },
          select: {
            course: {
              select: { slug: true, title: true, language: { select: { name: true } } },
            },
          },
        },
      },
    });
    return {
      items: rows.map((t) => ({
        id: t.id,
        name: t.fullName,
        bio: t.bio,
        photoUrl: t.photoFileId ? `/api/v1/files/${t.photoFileId}` : null,
        languages: [...new Set(t.teachingCourses.map((c) => c.course.language.name))],
        courses: t.teachingCourses.map((c) => ({ slug: c.course.slug, title: c.course.title })),
      })),
    };
  }

  /** Languages that have enough questions for a check (at least one per band they cover). */
  async placementLanguages() {
    const rows = await this.prisma.placementQuestion.groupBy({
      by: ['languageId'],
      where: { active: true, language: { active: true } },
      _count: { _all: true },
    });
    if (rows.length === 0) return { items: [] };
    const languages = await this.prisma.language.findMany({
      where: { id: { in: rows.map((r) => r.languageId) } },
      orderBy: { position: 'asc' },
      select: { name: true, code: true, direction: true },
    });
    return { items: languages };
  }

  /** The questions of a check: a few per band, in order, without the right answers. */
  async placementQuestions(languageCode: string) {
    const language = await this.prisma.language.findFirst({
      where: { code: languageCode, active: true },
      select: { id: true, name: true, code: true, direction: true },
    });
    if (!language) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    const rows = await this.prisma.placementQuestion.findMany({
      where: { languageId: language.id, active: true },
      orderBy: [{ band: 'asc' }, { position: 'asc' }],
    });
    const byBand = new Map<number, typeof rows>();
    for (const row of rows) byBand.set(row.band, [...(byBand.get(row.band) ?? []), row]);
    const picked = [...byBand.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([, list]) => list.slice(0, PER_BAND));
    if (picked.length === 0) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return {
      language,
      questions: picked.map((q) => ({
        id: q.id,
        band: q.band,
        text: q.text,
        options: q.options as unknown as PlacementOption[],
      })),
    };
  }

  /**
   * Marks the check on the server and suggests where to start: the highest band whose questions were
   * mostly right, as long as every band before it was too. Then lists real courses at that level.
   */
  async placementResult(languageCode: string, answers: Record<string, string>) {
    const { language, questions } = await this.placementQuestions(languageCode);
    const rows = await this.prisma.placementQuestion.findMany({
      where: { id: { in: questions.map((q) => q.id) } },
      select: { id: true, band: true, correct: true },
    });
    const bands = [...new Set(rows.map((r) => r.band))].sort((a, b) => a - b);
    let reached = bands[0] ?? 1;
    let score = 0;
    let stopped = false;
    for (const band of bands) {
      const inBand = rows.filter((r) => r.band === band);
      const right = inBand.filter((r) => answers[r.id] === r.correct).length;
      score += right;
      if (!stopped && right / inBand.length >= PASS_SHARE) reached = band;
      else stopped = true;
    }

    const levels = await this.prisma.level.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select: { name: true },
    });
    const level = levels[Math.min(Math.max(reached, 1), levels.length) - 1] ?? null;
    const { items } = await this.catalog.list({
      language: language.code,
      ...(level ? { level: level.name } : {}),
    });
    return {
      score,
      total: rows.length,
      level: level?.name ?? null,
      language: { name: language.name, code: language.code },
      courses: items.slice(0, 3),
    };
  }
}
