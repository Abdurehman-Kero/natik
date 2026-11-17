import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { maskPhone, smsListQuerySchema } from '@natik/shared';
import { createZodDto } from 'nestjs-zod';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { Roles } from '../auth/decorators';
import { SmsService } from './sms/sms.service';

class ListQuery extends createZodDto(smsListQuerySchema) {}

/** Messages that could not be sent, with a Retry button (FR-NOTIF-004). Phone numbers are masked. */
@ApiTags('Admin · SMS')
@Roles('ADMIN')
@Controller('admin/sms')
export class AdminSmsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
  ) {}

  @Get()
  async list(@Query() query: ListQuery) {
    const where = { status: query.status };
    const [total, failed, rows] = await Promise.all([
      this.prisma.smsMessage.count({ where }),
      this.prisma.smsMessage.count({ where: { status: 'FAILED' } }),
      this.prisma.smsMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * 20,
        take: 20,
        select: {
          id: true,
          to: true,
          template: true,
          status: true,
          attempts: true,
          lastError: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      total,
      failedCount: failed,
      page: query.page,
      pageSize: 20,
      items: rows.map((r) => ({ ...r, to: maskPhone(r.to) })),
    };
  }

  @Get('count')
  async count() {
    return { count: await this.prisma.smsMessage.count({ where: { status: 'FAILED' } }) };
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  async retry(@Param('id') id: string) {
    const message = await this.prisma.smsMessage.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!message) throw new AppException('NOT_FOUND', HttpStatus.NOT_FOUND);
    await this.sms.retry(id);
    return { ok: true };
  }
}
