import { HttpStatus, Injectable } from '@nestjs/common';
import type { PaymentAccountInput } from '@natik/shared';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { SessionUser } from '../auth/decorators';

const select = {
  id: true,
  type: true,
  provider: true,
  accountName: true,
  accountNumber: true,
  note: true,
  position: true,
  active: true,
} as const;

/** The bank and mobile-wallet accounts students pay into (FR-PAY-001). Admin-managed. */
@Injectable()
export class PaymentAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.paymentAccount
      .findMany({ orderBy: { position: 'asc' }, select })
      .then((items) => ({ items }));
  }

  /** What students see on the payment screen: active accounts only. */
  active() {
    return this.prisma.paymentAccount.findMany({
      where: { active: true },
      orderBy: { position: 'asc' },
      select,
    });
  }

  async create(actor: SessionUser, input: PaymentAccountInput) {
    const last = await this.prisma.paymentAccount.aggregate({ _max: { position: true } });
    const account = await this.prisma.paymentAccount.create({
      data: { ...this.data(input), position: (last._max.position ?? 0) + 1 },
      select,
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'PAYMENT_ACCOUNT_CREATED',
      entityType: 'PaymentAccount',
      entityId: account.id,
      details: { provider: account.provider },
    });
    return account;
  }

  async update(actor: SessionUser, id: string, input: PaymentAccountInput) {
    await this.mustFind(id);
    const account = await this.prisma.paymentAccount.update({
      where: { id },
      data: this.data(input),
      select,
    });
    await this.audit.record({
      actorId: actor.id,
      action: 'PAYMENT_ACCOUNT_UPDATED',
      entityType: 'PaymentAccount',
      entityId: id,
      details: { provider: account.provider, active: account.active },
    });
    return account;
  }

  async remove(actor: SessionUser, id: string): Promise<void> {
    await this.mustFind(id);
    await this.prisma.paymentAccount.delete({ where: { id } });
    await this.audit.record({
      actorId: actor.id,
      action: 'PAYMENT_ACCOUNT_DELETED',
      entityType: 'PaymentAccount',
      entityId: id,
    });
  }

  async reorder(ids: string[]) {
    const existing = await this.prisma.paymentAccount.findMany({ select: { id: true } });
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
        this.prisma.paymentAccount.update({ where: { id }, data: { position: index + 1 } }),
      ),
    );
    return this.list();
  }

  private data(input: PaymentAccountInput) {
    return {
      type: input.type,
      provider: input.provider,
      accountName: input.accountName,
      accountNumber: input.accountNumber,
      note: input.note || null,
      active: input.active,
    };
  }

  private async mustFind(id: string) {
    const account = await this.prisma.paymentAccount.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!account) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    return account;
  }
}
