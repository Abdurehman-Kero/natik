import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';

interface LanguageInput {
  name: string;
  code: string;
  direction: 'LTR' | 'RTL';
  active?: boolean;
}
interface LevelInput {
  name: string;
  active?: boolean;
}

/** The editable lists of languages and levels (FR-CAT-001). Nothing here is fixed in code. */
@Injectable()
export class CatalogueListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Languages ──────────────────────────────────────────────────────────

  async languages() {
    const rows = await this.prisma.language.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { courses: true } } },
    });
    return {
      items: rows.map(({ _count, ...l }) => ({ ...l, courseCount: _count.courses })),
    };
  }

  async createLanguage(actor: SessionUser, input: LanguageInput) {
    await this.assertLanguageFree(input);
    const max = await this.prisma.language.aggregate({ _max: { position: true } });
    const created = await this.prisma.language.create({
      data: { ...input, active: input.active ?? true, position: (max._max.position ?? 0) + 1 },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'LANGUAGE_CREATED',
      entityType: 'Language',
      entityId: created.id,
      details: { name: created.name },
    });
    return created;
  }

  async updateLanguage(actor: SessionUser, id: string, input: LanguageInput) {
    await this.mustExist(this.prisma.language.findUnique({ where: { id } }));
    await this.assertLanguageFree(input, id);
    const updated = await this.prisma.language.update({ where: { id }, data: input });
    await this.audit.record({
      actorId: actor.id,
      action: 'LANGUAGE_UPDATED',
      entityType: 'Language',
      entityId: id,
      details: { name: updated.name, active: updated.active },
    });
    return updated;
  }

  async reorderLanguages(ids: string[]) {
    await this.reorder('language', ids);
    return this.languages();
  }

  async deleteLanguage(actor: SessionUser, id: string) {
    await this.mustExist(this.prisma.language.findUnique({ where: { id } }));
    const used =
      (await this.prisma.course.count({ where: { languageId: id } })) +
      (await this.prisma.user.count({ where: { interestLanguageId: id } }));
    if (used > 0) throw new AppException('IN_USE', HttpStatus.CONFLICT);
    await this.prisma.language.delete({ where: { id } });
    await this.audit.record({
      actorId: actor.id,
      action: 'LANGUAGE_DELETED',
      entityType: 'Language',
      entityId: id,
    });
  }

  private async assertLanguageFree(input: LanguageInput, ignoreId?: string) {
    const clash = await this.prisma.language.findFirst({
      where: {
        OR: [{ name: { equals: input.name, mode: 'insensitive' } }, { code: input.code }],
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
    });
    if (clash) {
      const sameName = clash.name.toLowerCase() === input.name.toLowerCase();
      throw new AppException('CONFLICT', HttpStatus.CONFLICT, {
        message: sameName
          ? 'A language with this name already exists.'
          : 'A language with this code already exists.',
        fields: sameName
          ? { name: ['A language with this name already exists.'] }
          : { code: ['A language with this code already exists.'] },
      });
    }
  }

  // ── Levels ─────────────────────────────────────────────────────────────

  async levels() {
    const rows = await this.prisma.level.findMany({
      orderBy: { position: 'asc' },
      include: { _count: { select: { courses: true } } },
    });
    return { items: rows.map(({ _count, ...l }) => ({ ...l, courseCount: _count.courses })) };
  }

  async createLevel(actor: SessionUser, input: LevelInput) {
    await this.assertLevelFree(input);
    const max = await this.prisma.level.aggregate({ _max: { position: true } });
    const created = await this.prisma.level.create({
      data: {
        name: input.name,
        active: input.active ?? true,
        position: (max._max.position ?? 0) + 1,
      },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'LEVEL_CREATED',
      entityType: 'Level',
      entityId: created.id,
      details: { name: created.name },
    });
    return created;
  }

  async updateLevel(actor: SessionUser, id: string, input: LevelInput) {
    await this.mustExist(this.prisma.level.findUnique({ where: { id } }));
    await this.assertLevelFree(input, id);
    const updated = await this.prisma.level.update({
      where: { id },
      data: { name: input.name, ...(input.active === undefined ? {} : { active: input.active }) },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'LEVEL_UPDATED',
      entityType: 'Level',
      entityId: id,
      details: { name: updated.name, active: updated.active },
    });
    return updated;
  }

  async reorderLevels(ids: string[]) {
    await this.reorder('level', ids);
    return this.levels();
  }

  async deleteLevel(actor: SessionUser, id: string) {
    await this.mustExist(this.prisma.level.findUnique({ where: { id } }));
    if ((await this.prisma.course.count({ where: { levelId: id } })) > 0) {
      throw new AppException('IN_USE', HttpStatus.CONFLICT);
    }
    await this.prisma.level.delete({ where: { id } });
    await this.audit.record({
      actorId: actor.id,
      action: 'LEVEL_DELETED',
      entityType: 'Level',
      entityId: id,
    });
  }

  private async assertLevelFree(input: LevelInput, ignoreId?: string) {
    const clash = await this.prisma.level.findFirst({
      where: {
        name: { equals: input.name, mode: 'insensitive' },
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
    });
    if (clash) {
      throw new AppException('CONFLICT', HttpStatus.CONFLICT, {
        message: 'A level with this name already exists.',
        fields: { name: ['A level with this name already exists.'] },
      });
    }
  }

  // ── Shared ─────────────────────────────────────────────────────────────

  private async mustExist(lookup: Promise<unknown>) {
    if (!(await lookup)) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  /** Positions follow the order of the ids given. */
  private async reorder(table: 'language' | 'level', ids: string[]) {
    const existing =
      table === 'language'
        ? await this.prisma.language.findMany({ select: { id: true } })
        : await this.prisma.level.findMany({ select: { id: true } });
    const known = new Set(existing.map((e) => e.id));
    if (ids.length !== known.size || !ids.every((id) => known.has(id))) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        table === 'language'
          ? this.prisma.language.update({ where: { id }, data: { position: index + 1 } })
          : this.prisma.level.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
  }
}
