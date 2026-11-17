import { HttpStatus, Injectable } from '@nestjs/common';
import { type SiteContentKey, siteContentSchemas } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { zodFieldErrors } from '../../common/errors/to-error-response';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';
import { isValidRichText, renderRichText } from '../content/rich-text';

type Ordered = 'faqItem' | 'testimonial';

/**
 * The text and lists admins edit without a developer (FR-WEB-005): headline, about text, contact
 * details, FAQ, testimonials, policies and the featured courses.
 */
@Injectable()
export class SiteContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Public reads ───────────────────────────────────────────────────────

  /** Home, About and contact text. A missing entry means "use the built-in wording". */
  async publicSite() {
    const rows = await this.prisma.siteContent.findMany({
      where: { key: { in: ['home', 'about', 'contact'] } },
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { home: byKey.home ?? null, about: byKey.about ?? null, contact: byKey.contact ?? null };
  }

  async publicFaq() {
    const rows = await this.prisma.faqItem.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
      select: { id: true, question: true, answer: true },
    });
    return { items: rows };
  }

  async publicTestimonials() {
    const rows = await this.prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
      take: 12,
      select: { id: true, name: true, quote: true, courseLabel: true },
    });
    return { items: rows };
  }

  async publicPolicy(slug: string) {
    if (slug !== 'privacy' && slug !== 'terms') {
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const policy = await this.prisma.policyPage.findUnique({ where: { slug } });
    if (!policy) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return { title: policy.title, html: renderRichText(policy.body), updatedAt: policy.updatedAt };
  }

  // ── Site text blocks ───────────────────────────────────────────────────

  async getSite(key: SiteContentKey) {
    const row = await this.prisma.siteContent.findUnique({ where: { key } });
    return { key, value: row?.value ?? null };
  }

  async putSite(actor: SessionUser, key: SiteContentKey, input: unknown) {
    const result = siteContentSchemas[key].safeParse(input);
    if (!result.success) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        fields: zodFieldErrors(result.error),
      });
    }
    const parsed = result.data;
    // Empty values are dropped so a blank field falls back to the built-in wording.
    const value = Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v !== undefined && v !== ''),
    ) as Prisma.InputJsonObject;
    await this.prisma.siteContent.upsert({
      where: { key },
      create: { key, value, updatedById: actor.id },
      update: { value, updatedById: actor.id },
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'SITE_CONTENT_UPDATED',
      entityType: 'SiteContent',
      entityId: key,
    });
    return { key, value };
  }

  /** Goes back to the built-in wording for one block (Home, About or Contact). */
  async resetSite(actor: SessionUser, key: SiteContentKey) {
    await this.prisma.siteContent.deleteMany({ where: { key } });
    await this.audit.record({
      actorId: actor.id,
      action: 'SITE_CONTENT_RESET',
      entityType: 'SiteContent',
      entityId: key,
    });
  }

  // ── FAQ and testimonials (ordered lists) ───────────────────────────────

  private model(kind: Ordered) {
    return kind === 'faqItem' ? this.prisma.faqItem : this.prisma.testimonial;
  }

  async listFaq() {
    return { items: await this.prisma.faqItem.findMany({ orderBy: { position: 'asc' } }) };
  }

  async createFaq(
    actor: SessionUser,
    input: { question: string; answer: string; published: boolean },
  ) {
    const max = await this.prisma.faqItem.aggregate({ _max: { position: true } });
    const item = await this.prisma.faqItem.create({
      data: { ...input, position: (max._max.position ?? 0) + 1 },
    });
    await this.log(actor, 'FAQ_CREATED', 'FaqItem', item.id);
    return item;
  }

  async updateFaq(
    actor: SessionUser,
    id: string,
    input: { question: string; answer: string; published: boolean },
  ) {
    await this.mustExist(this.prisma.faqItem.findUnique({ where: { id } }));
    const item = await this.prisma.faqItem.update({ where: { id }, data: input });
    await this.log(actor, 'FAQ_UPDATED', 'FaqItem', id);
    return item;
  }

  async deleteFaq(actor: SessionUser, id: string) {
    await this.mustExist(this.prisma.faqItem.findUnique({ where: { id } }));
    await this.prisma.faqItem.delete({ where: { id } });
    await this.log(actor, 'FAQ_DELETED', 'FaqItem', id);
  }

  async listTestimonials() {
    return { items: await this.prisma.testimonial.findMany({ orderBy: { position: 'asc' } }) };
  }

  async createTestimonial(
    actor: SessionUser,
    input: { name: string; quote: string; courseLabel?: string; published: boolean },
  ) {
    const max = await this.prisma.testimonial.aggregate({ _max: { position: true } });
    const item = await this.prisma.testimonial.create({
      data: {
        ...input,
        courseLabel: input.courseLabel ?? null,
        position: (max._max.position ?? 0) + 1,
      },
    });
    await this.log(actor, 'TESTIMONIAL_CREATED', 'Testimonial', item.id);
    return item;
  }

  async updateTestimonial(
    actor: SessionUser,
    id: string,
    input: { name: string; quote: string; courseLabel?: string; published: boolean },
  ) {
    await this.mustExist(this.prisma.testimonial.findUnique({ where: { id } }));
    const item = await this.prisma.testimonial.update({
      where: { id },
      data: { ...input, courseLabel: input.courseLabel ?? null },
    });
    await this.log(actor, 'TESTIMONIAL_UPDATED', 'Testimonial', id);
    return item;
  }

  async deleteTestimonial(actor: SessionUser, id: string) {
    await this.mustExist(this.prisma.testimonial.findUnique({ where: { id } }));
    await this.prisma.testimonial.delete({ where: { id } });
    await this.log(actor, 'TESTIMONIAL_DELETED', 'Testimonial', id);
  }

  async reorder(kind: Ordered, ids: string[]) {
    const model = this.model(kind);
    const existing = await (model as typeof this.prisma.faqItem).findMany({ select: { id: true } });
    const known = new Set(existing.map((e) => e.id));
    if (
      ids.length !== known.size ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => known.has(id))
    ) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST, {
        message: 'The list changed while you were editing. Refresh and try again.',
      });
    }
    await this.prisma.$transaction(
      ids.map((id, index) =>
        kind === 'faqItem'
          ? this.prisma.faqItem.update({ where: { id }, data: { position: index + 1 } })
          : this.prisma.testimonial.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return kind === 'faqItem' ? this.listFaq() : this.listTestimonials();
  }

  // ── Policies ───────────────────────────────────────────────────────────

  async getPolicy(slug: string) {
    this.assertPolicySlug(slug);
    const policy = await this.prisma.policyPage.findUnique({ where: { slug } });
    return policy
      ? { slug, title: policy.title, body: policy.body, updatedAt: policy.updatedAt }
      : null;
  }

  async putPolicy(actor: SessionUser, slug: string, input: { title: string; body: unknown }) {
    this.assertPolicySlug(slug);
    if (!isValidRichText(input.body)) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        fields: { body: ['This text could not be saved. Please edit it and try again.'] },
      });
    }
    const body = input.body as Prisma.InputJsonValue;
    const policy = await this.prisma.policyPage.upsert({
      where: { slug },
      create: { slug, title: input.title, body },
      update: { title: input.title, body },
    });
    await this.log(actor, 'POLICY_UPDATED', 'PolicyPage', slug);
    return { slug, title: policy.title, body: policy.body, updatedAt: policy.updatedAt };
  }

  private assertPolicySlug(slug: string) {
    if (slug !== 'privacy' && slug !== 'terms')
      throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  // ── Featured courses ───────────────────────────────────────────────────

  async featured() {
    const [chosen, choices] = await Promise.all([
      this.prisma.course.findMany({
        where: { featured: true },
        orderBy: [{ featuredPosition: 'asc' }, { title: 'asc' }],
        select: { id: true, title: true, status: true },
      }),
      this.prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { title: 'asc' },
        select: { id: true, title: true, status: true },
      }),
    ]);
    return { featured: chosen, choices };
  }

  async setFeatured(actor: SessionUser, ids: string[]) {
    const unique = [...new Set(ids)];
    const courses = await this.prisma.course.findMany({
      where: { id: { in: unique }, status: 'PUBLISHED' },
      select: { id: true },
    });
    if (courses.length !== unique.length) {
      throw new AppException('VALIDATION_FAILED', HttpStatus.BAD_REQUEST, {
        fields: { ids: ['Only published courses can be featured.'] },
      });
    }
    await this.prisma.$transaction([
      this.prisma.course.updateMany({
        where: { featured: true },
        data: { featured: false, featuredPosition: null },
      }),
      ...unique.map((id, index) =>
        this.prisma.course.update({
          where: { id },
          data: { featured: true, featuredPosition: index + 1 },
        }),
      ),
    ]);
    await this.log(actor, 'FEATURED_COURSES_CHANGED', 'Course', 'featured');
    return this.featured();
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async mustExist(lookup: Promise<unknown>) {
    if (!(await lookup)) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
  }

  private log(actor: SessionUser, action: string, entityType: string, entityId: string) {
    return this.audit.record({ actorId: actor.id, action, entityType, entityId });
  }
}
